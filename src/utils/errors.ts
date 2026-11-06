/** utils/errors：从宿主入口拆出的独立职责模块。 */
import { QUOTA_HINTS, CONTENT_HINTS, PRICE_HINTS } from '../config.js';

function upstreamMessage(data) {
  if (data && typeof data === 'object') {
    const error = data.error;
    if (error && typeof error === 'object') {
      const message = String(error.message || '').trim();
      const code = String(error.code || '').trim();
      if (message) return code ? `${message}（${code}）` : message;
    } else if (typeof error === 'string' && error.trim()) {
      return error.trim();
    }
    for (const key of ['message', 'detail', 'msg', 'fail_reason']) {
      const value = data[key];
      if (typeof value === 'string' && value.trim()) return data.code ? `${value.trim()}（${data.code}）` : value.trim();
    }
  }
  const text = typeof data === 'string' ? data : JSON.stringify(data ?? {});
  return text || '上游未返回错误详情';
}

function quotaDetail(text) {
  const parts = [];
  const remain = /(?:remain(?:ing)? quota|剩余额度)\D{0,6}([¥$]?\d[\d.,]*)/i.exec(text);
  const need = /(?:need quota|需要预扣费额度|需要额度)\D{0,6}([¥$]?\d[\d.,]*)/i.exec(text);
  if (remain) parts.push(`剩余 ${remain[1]}`);
  if (need) parts.push(`需要 ${need[1]}`);
  return parts.length ? `（${parts.join('，')}）` : '';
}

/** 仅匹配明确的真人/人脸限制，普通内容审核失败不触发改图。 */
function isRealPersonRejection(value) {
  const text = String(value || '');
  return /真人|real[ _-]?person|real[ _-]?human|photorealistic[ _-]?(?:person|human)|human[ _.-]?face|realperson|humanface/i.test(text);
}

/** 把上游报错（HTTP 错误或任务失败详情）归类成可读的 code + message。 */
export function classifyError(statusCode, data) {
  const raw = upstreamMessage(data);
  const lowered = raw.toLowerCase();
  if (
    statusCode === 402
    || QUOTA_HINTS.some((hint) => lowered.includes(hint))
    || lowered.includes('quota_exceeded')
  ) {
    return {
      code: 'provider_quota_exceeded',
      message: `中转站额度不足${quotaDetail(raw)}，请充值后再试：${raw}`,
    };
  }
  if (statusCode === 401 || statusCode === 403) {
    return { code: 'provider_auth', message: `中转站鉴权失败（${statusCode}）：${raw}` };
  }
  if (statusCode === 429) {
    return { code: 'provider_rate_limited', message: `中转站限流（429）：${raw}` };
  }
  if (isRealPersonRejection(raw)) return { code: 'real_person_rejected', message: raw };
  if (CONTENT_HINTS.some((hint) => lowered.includes(hint))) {
    return { code: 'content_rejected', message: raw };
  }
  if (PRICE_HINTS.some((hint) => lowered.includes(hint))) {
    return {
      code: 'provider_price_config_error',
      message:
        `中转站该模型的计价配置异常，与本次请求参数无关，重试也不会成功：${raw}。`
        + '请在插件 config 里换用其它可用模型。',
    };
  }
  return { code: 'provider_failed', message: raw };
}

export function isContentRejection(text) {
  const lowered = String(text || '').toLowerCase();
  return CONTENT_HINTS.some((hint) => lowered.includes(hint));
}

/** 归一化后的错误：统一带一个 code，调用方按 code 分流。 */
export interface CodedError extends Error {
  code?: string;
}

export function abortError(): CodedError {
  const error: CodedError = new Error('已取消');
  error.code = 'ABORTED';
  return error;
}

/**
 * 轮询查询失败里哪些值得重试：网络中断、超时、5xx、限流、以及最像「API密钥抖了一下」的 401/403。
 * 4xx 里那些明确的请求错误（比如路径不对、任务 ID 非法）重试也没用，重试只是白等。
 */
export function isRetryablePollError(failure): boolean {
  if (!failure || failure.code === 'ABORTED') return false;
  const status = Number(failure.status);
  if (!Number.isFinite(status)) return true;
  if (status >= 500) return true;
  return status === 401 || status === 403 || status === 408 || status === 429;
}
