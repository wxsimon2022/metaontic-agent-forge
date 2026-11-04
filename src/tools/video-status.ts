import { artifactLink } from './results.js';
/** tools/video-status：从宿主入口拆出的独立职责模块。 */
import { resolveApiKey, assertConfigured, resolveModel, snapshotConfig } from '../providers/connection.js';
import { getTask } from '../providers/transport.js';
import { extractStatus, findKey, extractVideoUrl, extractImageUrl } from '../providers/response.js';
import { SUCCESS_STATES, FAILED_STATES, CONTENT_REJECTION_HINT } from '../config.js';
import { classifyError, isContentRejection } from '../utils/errors.js';

export function taskTool(liveConfig) {
  return {
    name: 'video_status',
    description:
      '按任务 ID 查询 Seedance 视频任务（生成、延长与合并）的状态；'
      + '任务完成（status 为 succeeded）时返回视频下载链接（约 24 小时内有效）。'
      + 'video_generate / video_extend 返回 timeout 或某段 unknown（查询失败、任务已提交）时，'
      + '用它们给出的 taskId 在这里继续等——unknown 只表示「没查到」，任务很可能还在生成，'
      + '不要因此重新提交同一段任务。A/B接入在任务成功后还会查询中转站最终结算；待结算或费用查询失败可用同一taskId补查，不重新生成。',
    parameters: {
      type: 'object',
      properties: {
        taskId: {
          type: 'string',
          description: '由 video_generate / video_extend 返回的任务 ID。',
        },
      },
      required: ['taskId'],
    },
    output: {
      schema: {
        type: 'object',
        properties: {
          taskId: { type: 'string' },
          status: { type: 'string' },
          model: { type: 'string' },
          videoUrl: { type: 'string' },
          error: { type: 'string' },
          errorCode: { type: 'string' },
        },
      },
      render(_args, value) {
        const { taskId, status, videoUrl, error, model } = value || {};
        if (status === 'succeeded') {
          return [
            {
              type: 'text',
              text: [
                '视频任务已完成。',
                `任务 ID：${taskId}`,
                `模型：${model || '-'}`,
                `视频链接（约 24 小时内有效）：${artifactLink('观看视频', '', videoUrl) || '（无）'}`,
                '正文须保留上述可点击链接，有卡片也不能省略；查询不会重新生成视频。',
              ].join('\n'),
            },
          ];
        }
        if (status === 'failed') {
          return [{ type: 'text', text: `视频任务失败（任务 ${taskId}）：${error || '未知错误'}` }];
        }
        if (status === 'unknown') {
          const detail = String(error || '查询失败').replace(/。+$/, '');
          return [
            {
              type: 'text',
              text: `任务 ${taskId} 这次没查到状态：${detail}。`
                + '这不代表任务没有生成——稍后重试，或检查 Key / 额度后再查一次，不要重新提交。',
            },
          ];
        }
        return [{ type: 'text', text: `任务 ${taskId} 当前状态：${status || '未知'}。` }];
      },
    },
    timeoutMs: 60000,
    isConcurrencySafe() {
      return true;
    },
    async execute(args, exec) {
      const config = snapshotConfig(liveConfig);
      const apiKey = resolveApiKey(config);
      assertConfigured(config, apiKey);

      const taskId = String(args?.taskId ?? '').trim();
      if (!taskId) throw new Error('taskId 不能为空。');

      // 查询失败（401、限流、网络抖动）只说明「这次没查到」，不代表任务没生成：
      // 返回 unknown + 提示，让用户/模型稍后重试，而不是弹一个看起来像「任务失败」的报错。
      let task;
      try {
        task = await getTask(config, taskId, exec?.signal);
      } catch (failure) {
        return {
          taskId,
          status: 'unknown',
          errorCode: failure?.code || 'provider_poll_error',
          error: `查询失败：${failure?.message || failure}`,
        };
      }
      const status = extractStatus(task) || 'unknown';
      const model = findKey(task, ['model']) || resolveModel(config);
      const videoUrl = extractVideoUrl(task);

      if (SUCCESS_STATES.has(status) && videoUrl) {
        return { taskId, status: 'succeeded', model, videoUrl };
      }
      // 上游说成功、但没有可下载的视频链接：当成失败并说明原因，别让 render 显示「已完成 /（无）」。
      if (SUCCESS_STATES.has(status) && !videoUrl) {
        const imageUrl = extractImageUrl(task);
        return {
          taskId,
          status: 'failed',
          model,
          errorCode: 'provider_bad_response',
          error: imageUrl
            ? `上游返回的是图片而不是视频（${imageUrl.split('?')[0].slice(-60)}）。`
            : '上游报告成功但没有返回视频地址。',
        };
      }
      if (FAILED_STATES.has(status)) {
        const detail = findKey(task, ['error', 'fail_reason', 'message', 'detail']);
        const classified = classifyError(
          400,
          typeof detail === 'string' ? { message: detail } : (detail || task),
        );
        const raw = status === 'cancelled' || status === 'canceled' ? 'cancelled' : 'failed';
        return {
          taskId,
          status: raw,
          model,
          errorCode: classified.code,
          error: isContentRejection(classified.message)
            ? `${CONTENT_REJECTION_HINT}上游详情：${classified.message}`
            : classified.message,
        };
      }
      return { taskId, status, model, videoUrl };
    },
  };
}
