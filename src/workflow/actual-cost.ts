import { timedStage } from '../utils/timing.js';
/** A/B视频完成后的真实结算查询。只读本Key日志，绝不用预扣或估价冒充实际金额。 */
import { snapshotConfig, isVolcengine, resolveApiKey, resolveBaseUrl } from '../providers/connection.js';

function number(value) {
  if ((typeof value !== 'number' && typeof value !== 'string') || (typeof value === 'string' && !value.trim())) return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : null;
}
function object(value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value;
  if (typeof value === 'string') { try { return object(JSON.parse(value)); } catch {} }
  return {};
}
export function settledTaskCosts(logs, taskIds) {
  return [...new Set(taskIds)].map(taskId => {
    const matches = logs.filter(row => Number(row.type) === 2 && object(row.other).task_id === taskId
      && number(object(row.other).actual_quota) !== null)
      .sort((a, b) => Number(b.created_at || 0) - Number(a.created_at || 0) || Number(b.id || 0) - Number(a.id || 0));
    if (!matches.length) return { taskId, status: 'pending', quota: null };
    // actual_quota已是该任务最终总额，不与预扣、补扣、重复日志相加。
    return { taskId, status: 'settled', quota: number(object(matches[0].other).actual_quota) };
  });
}

export async function fetchActualCost(config, taskIds, signal) {
  if (isVolcengine(config)) return undefined;
  const tasks = settledTaskCosts([], taskIds);
  if (!tasks.length) return undefined;
  const pending = (reason) => ({ status: 'pending', source: 'relay_settlement', tasks, amount: null, currency: null, reason });
  if (signal?.aborted) return pending('费用待查询：本次操作已停止，可稍后用video_status补查。');
  const key = resolveApiKey(config);
  const base = resolveBaseUrl(config).replace(/\/v1\/?$/, '');
  if (!key || !base) return pending('费用待查询：原调用连接不可用。');
  const requestSignal = signal ? AbortSignal.any([signal, AbortSignal.timeout(8000)]) : AbortSignal.timeout(8000);
  async function get(path, authenticated) {
    const response = await fetch(`${base}${path}`, { method: 'GET', redirect: 'error', signal: requestSignal,
      headers: { accept: 'application/json', ...(authenticated ? { Authorization: `Bearer ${key}` } : {}) } });
    if (!response.ok) throw Error(`HTTP ${response.status}`);
    const body = await response.json();
    if (body.success === false || (body.code !== undefined && body.code !== 0)) throw Error('查询不可用');
    return body;
  }
  try {
    // 与生成共用同一连接快照和视频Key，绝不读取图片Key或管理端凭证。
    const body = await get('/api/log/token', true);
    const rows = Array.isArray(body.data) ? body.data : body.data?.items;
    if (!Array.isArray(rows)) return pending('费用待查询：中转站未返回有效消费日志。');
    const settled = settledTaskCosts(rows, taskIds);
    const known = settled.filter(x => x.status === 'settled');
    if (!known.length) return pending('待结算：本Key最近日志中尚未找到该任务的最终结算，可用video_status补查。');
    let conversion;
    try {
      const settings = (await get('/api/status', false)).data;
      const perUnit = number(settings?.quota_per_unit);
      const exchange = number(settings?.usd_exchange_rate);
      // 此接口明确给出单位额度与USD换算率才换成人民币，缺值不硬编码猜价。
      if (perUnit && exchange) conversion = { quotaPerUnit: perUnit, usdExchangeRate: exchange, currency: 'CNY' };
    } catch { /* 已结算额度仍可交付，不让展示设置查询影响视频。 */ }
    const quota = known.reduce((sum, task) => sum + task.quota, 0);
    const taskCosts = settled.map(task => ({ ...task,
      amount: task.quota !== null && conversion ? Math.round(task.quota / conversion.quotaPerUnit * conversion.usdExchangeRate * 1e6) / 1e6 : null,
    }));
    return { status: known.length === settled.length ? 'settled' : 'partial', source: 'relay_settlement',
      tasks: taskCosts, quota, amount: conversion ? Math.round(quota / conversion.quotaPerUnit * conversion.usdExchangeRate * 1e6) / 1e6 : null,
      currency: conversion?.currency ?? null, conversion: conversion ?? null,
      reason: known.length !== settled.length ? '部分任务待结算；当前金额仅为已结算小计，不是整条视频最终费用。' : conversion ? '' : '已获取实际消耗额度，金额换算设置暂不可用。',
    };
  } catch {
    return pending('费用待查询：中转站消费日志查询失败或无权限；视频结果不受影响，可稍后用video_status补查。');
  }
}

export function actualCostText(cost, partialVideo = false) {
  if (!cost) return '';
  const amount = (value) => `¥${value.toFixed(value >= 1 ? 2 : 4)}`;
  if (cost.status === 'pending') return `实际消耗：${cost.reason}`;
  const totalLabel = cost.status === 'partial' ? '已结算小计' : partialVideo ? '已生成部分实际消耗' : '实际消耗合计';
  const lines = cost.tasks.map(task => task.status === 'settled'
    ? `任务 ${task.taskId} 实际消耗：${task.amount !== null ? amount(task.amount) : `${task.quota}额度`}`
    : `任务 ${task.taskId}：待结算`);
  lines.push(`${totalLabel}：${cost.amount !== null ? amount(cost.amount) : `${cost.quota}额度`}（中转站实际结算，视频费用）`);
  if (cost.reason) lines.push(cost.reason);
  return lines.join('\n');
}

export const ACTUAL_COST_SCHEMA = { type: 'object', properties: {
  status: { type: 'string', enum: ['pending', 'partial', 'settled'] }, source: { type: 'string' },
  quota: { type: 'number' }, amount: { oneOf: [{ type: 'number' }, { type: 'null' }] }, currency: { oneOf: [{ type: 'string' }, { type: 'null' }] },
  reason: { type: 'string' }, conversion: { oneOf: [{ type: 'object' }, { type: 'null' }] },
  tasks: { type: 'array', items: { type: 'object', properties: {
    taskId: { type: 'string' }, status: { type: 'string' }, quota: { oneOf: [{ type: 'number' }, { type: 'null' }] }, amount: { oneOf: [{ type: 'number' }, { type: 'null' }] },
  } } },
} };

/** 执行结束后补充费用，包含暂停交付和交付失败时已成功的分段；不改变生成/恢复状态。 */
export function withActualCost(tool, liveConfig) {
  return { ...tool,
    output: { ...tool.output, schema: { ...tool.output.schema, properties: { ...tool.output.schema.properties, actualCost: ACTUAL_COST_SCHEMA } },
      render(args, value) {
        const rendered = tool.output.render(args, value);
        const text = actualCostText(value?.actualCost, Boolean(value?.paused || value?.status !== 'succeeded'));
        return text ? [...rendered, { type: 'text', text }] : rendered;
      },
    },
    async execute(args, exec) {
      const config = snapshotConfig(liveConfig);
      const result = await tool.execute(args, exec);
      if (isVolcengine(config)) return result;
      const ids = result?.segments
        ? result.segments.filter(s => s.status === 'succeeded' && s.taskId).map(s => s.taskId)
        : result?.status === 'succeeded' && result?.taskId ? [result.taskId] : [];
      if (!ids.length) return result;
      try {
        const actualCost = await timedStage('actual_cost_query', () => fetchActualCost(config, ids, exec?.signal));
        return actualCost ? { ...result, actualCost } : result;
      } catch { return result; } // 费用展示异常绝不能触发付费视频重做。
    },
  };
}
