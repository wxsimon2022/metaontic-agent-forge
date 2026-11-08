/** 阶段计时只写固定字段，不记录输入、响应正文或错误消息。 */
import { randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { appendRequestLog, requestLogContext } from './logging.js';

export async function timedStage(stage, operation) {
  const spanId = randomUUID();
  const startedAt = new Date().toISOString();
  const start = performance.now();
  await appendRequestLog({ event: 'stage_started', stage, spanId, startedAt });
  let outcome = 'error';
  try {
    const result = await operation();
    outcome = ['failed', 'unknown', 'timeout', 'cancelled', 'pending', 'review_required'].includes(result?.status) ? result.status : 'success';
    return result;
  } catch (error) {
    outcome = error?.name === 'AbortError' || error?.code === 'ABORTED' ? 'cancelled' : 'error';
    throw error;
  } finally {
    await appendRequestLog({ event: 'stage_finished', stage, spanId, startedAt,
      finishedAt: new Date().toISOString(), elapsedMs: Math.round((performance.now() - start) * 1000) / 1000, outcome });
  }
}

export function withStageTiming(tool) {
  return { ...tool, async execute(args, exec) {
    const context = { ...requestLogContext.getStore(), callId: exec?.callId || randomUUID(), tool: tool.name };
    return requestLogContext.run(context, () => timedStage(`tool:${tool.name}`, () => tool.execute(args, exec)));
  } };
}
