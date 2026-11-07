/** providers/transport：从宿主入口拆出的独立职责模块。 */
import { uniqueSuffix } from '../utils/files.js';
import { isMetaontic, isVolcengine, resolveModel, resolveBaseUrl, resolveApiKey, resolveSubmitPath, resolveQueryPath } from './connection.js';
import { appendRequestLog } from '../utils/logging.js';
import { extractTaskId, extractStatus, findKey, extractVideoUrl, extractImageUrl } from './response.js';
import { finiteNumber } from '../utils/validation.js';
import { abortError, classifyError, isRetryablePollError } from '../utils/errors.js';
import { type TaskResult } from './types.js';
import { ref, SUCCESS_STATES, FAILED_STATES, CANCEL_STATES } from '../config.js';

/* ---------------- 请求与轮询 ---------------- */

/** 中转站单次请求的超时（毫秒）：卡住的连接不要拖到宿主工具超时才结束。 */
export const RELAY_TIMEOUT_MS = 120000;

export async function relayRequest(config, requestPath, options: { method?: string; body?: any; signal?: AbortSignal } = {}) {
  const method = options.method || 'GET';
  const requestId = uniqueSuffix('request');
  const started = Date.now();
  const trace: Record<string, any> = {};
  const body = options.body;
  const operation = method === 'POST' ? 'create_task' : 'query_task';
  const info: Record<string, any> = {
    requestId, operation, method,
    provider: isVolcengine(config) ? 'volcengine' : 'metaontic',
    model: body?.model || resolveModel(config),
    ...(method === 'POST' ? {
      duration: body?.duration, resolution: body?.resolution,
      imageCount: Array.isArray(body?.content) ? body.content.filter((item) => item.type === 'image_url').length : 0,
      videoCount: Array.isArray(body?.content) ? body.content.filter((item) => item.type === 'video_url').length : 0,
    } : { taskId: String(requestPath).split('?')[0].split('/').at(-1) }),
  };
  await appendRequestLog({ ...info, event: 'request_started' });
  try {
    const data = await relayRequestCore(config, requestPath, options, trace);
    await appendRequestLog({ ...info, ...trace, event: 'request_completed', elapsedMs: Date.now() - started,
      taskId: extractTaskId(data) || info.taskId, taskStatus: extractStatus(data),
      completionTokens: finiteNumber(data?.usage?.completion_tokens),
    });
    return data;
  } catch (error) {
    await appendRequestLog({ ...info, ...trace, event: 'request_failed', elapsedMs: Date.now() - started,
      errorCode: String(error?.code || 'request_error'), cancelled: Boolean(options.signal?.aborted),
    });
    throw error;
  }
}

export async function relayRequestCore(
  config,
  path,
  { method = 'GET', body, signal }: { method?: string; body?: unknown; signal?: AbortSignal } = {},
  trace: Record<string, any> = {},
): Promise<any> {
  const url = `${resolveBaseUrl(config)}${path}`;
  const timeout = AbortSignal.timeout(RELAY_TIMEOUT_MS);
  const requestSignal = signal ? AbortSignal.any([signal, timeout]) : timeout;
  const serialized = body === undefined ? undefined : JSON.stringify(body);
  if (serialized && Buffer.byteLength(serialized, 'utf8') > 64 * 1024 * 1024) {
    throw Object.assign(new Error('视频请求体超过64 MB，请减少内联图片或改用公网 URL；火山直连也可使用 asset:// 素材。'), { code: 'request_too_large' });
  }
  let response;
  let text: string;
  try {
    response = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${resolveApiKey(config)}`,
        'Content-Type': 'application/json',
      },
      ...(serialized !== undefined ? { body: serialized } : {}),
      signal: requestSignal,
    });
    trace.httpStatus = response.status;
    trace.upstreamRequestId = response.headers.get('x-request-id') || response.headers.get('x-tt-logid') || undefined;
    text = await response.text();
  } catch (error) {
    if (signal?.aborted) throw abortError();
    throw Object.assign(new Error(`中转站请求失败：${error?.message || error}`), {
      code: 'provider_network_error',
    });
  }

  let data: any = {};
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }
  }

  const upstreamError = data && typeof data === 'object' && data.error;
  // 查询终态失败任务时 error 是任务详情，交给 waitForCompletion 归类，不能当作查询失败。
  const failedTaskResponse = method === 'GET' && FAILED_STATES.has(extractStatus(data));
  if (!response.ok || (upstreamError && !failedTaskResponse)) {
    const httpStatus = response.status >= 400 ? response.status : 400;
    const classified = classifyError(
      httpStatus,
      data,
    );
    // 带上 HTTP 状态：轮询用得上——5xx / 429 / 401 这类要重试，400 这类是终局。
    throw Object.assign(new Error(classified.message), {
      code: classified.code,
      status: httpStatus,
    });
  }
  return data;
}

export function sleep(ms, signal): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) { reject(abortError()); return; }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    function onAbort() {
      clearTimeout(timer);
      reject(abortError());
    }
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

export function createTask(config, body, signal) {
  return relayRequest(config, resolveSubmitPath(config), { method: 'POST', body, signal });
}

export function getTask(config, taskId, signal) {
  return relayRequest(config, resolveQueryPath(config, taskId), { signal });
}

/**
 * 轮询直到任务成功、失败、取消，或等待预算耗尽。
 * 中转站的状态字段可能是 success/completed 等别名，这里统一归一化。
 *
 * 关键点：**查询失败 ≠ 任务失败**。任务已经建好，网络抖动、中转站限流、
 * API密钥在生成途中被判无效都会让查询报错，但任务在上游照常跑完。所以这里对查询错误
 * 做有限次重试（`pollErrorRetries`，默认 5）——连续失败到上限才放弃，
 * 放弃时返回 `unknown`（不是 `failed`），任务 ID 由调用方保留，
 * 交给 `video_status` 事后补拉，绝不把「没查到」当成「没生成」。
 */
export async function waitForCompletion(config, taskId, signal): Promise<TaskResult> {
  const deadline = Date.now() + ref(config, 'maxWaitMs', 600000);
  const maxPollErrors = Math.max(1, Math.round(ref(config, 'pollErrorRetries', 5)));
  let pollErrors = 0;

  for (;;) {
    if (signal?.aborted) throw abortError();

    let task;
    try {
      task = await getTask(config, taskId, signal);
      pollErrors = 0;
    } catch (failure) {
      if (failure?.code === 'ABORTED') throw failure;
      // 明确是请求本身的问题（不是网络抖动）：别白等 5 轮，直接按「查询返回失败」结束，
      // 但任务 ID 照样保留——上游报的是这次查询失败，不是「没生成」。
      if (!isRetryablePollError(failure)) {
        return {
          taskId,
          status: 'unknown',
          errorCode: failure?.code || 'provider_poll_error',
          error: `任务已提交（${taskId}），查询返回失败：${failure?.message || failure}。`
            + '可用 video_status 按这个 ID 复查确认。',
        };
      }
      pollErrors += 1;
      if (pollErrors >= maxPollErrors || Date.now() > deadline) {
        return {
          taskId,
          status: 'unknown',
          errorCode: failure?.code || 'provider_poll_error',
          error: `任务已提交（${taskId}），但连续 ${pollErrors} 次查询状态失败：${
            failure?.message || failure
          }。任务可能仍在生成，可用 video_status 按这个 ID 再查，不要重复提交。`,
        };
      }
      await sleep(ref(config, 'pollIntervalMs', 5000), signal);
      continue;
    }

    const status = extractStatus(task) || 'unknown';
    const model = findKey(task, ['model']) || resolveModel(config);

    if (SUCCESS_STATES.has(status)) {
      const videoUrl = extractVideoUrl(task);
      if (videoUrl) return { taskId, status: 'succeeded', model, videoUrl };
      const imageUrl = extractImageUrl(task);
      return {
        taskId,
        status: 'failed',
        model,
        errorCode: 'provider_bad_response',
        error: imageUrl
          ? `上游返回的是图片而不是视频（${imageUrl.split('?')[0].slice(-60)}），`
            + '可能是中转站把视频请求路由到了图片渠道。'
          : '上游报告成功但没有返回视频地址。',
      };
    }
    if (FAILED_STATES.has(status)) {
      const data = findKey(task, ['error', 'fail_reason', 'message', 'detail']);
      const classified = classifyError(400, typeof data === 'string' ? { message: data } : (data || task));
      return {
        taskId,
        status: CANCEL_STATES.has(status) ? 'cancelled' : 'failed',
        model,
        errorCode: classified.code,
        error: classified.message,
      };
    }
    if (Date.now() > deadline) {
      return { taskId, status: 'timeout' };
    }
    await sleep(ref(config, 'pollIntervalMs', 5000), signal);
  }
}
