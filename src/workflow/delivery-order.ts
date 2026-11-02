/** workflow/delivery-order：把「合并成片排第一」从提示词要求升级成提交前的真实校验。 */
import path from 'node:path';
import { appendRequestLog } from '../utils/logging.js';

/**
 * 录制本次会话真实交付过的分段与合并成片，并在 present 提交前校验顺序。
 * 只拦「成片没有排在分段之前」这一种错法；单文件、无成片、非视频文件都不受影响。
 */
export function createDeliveryOrderGuard() {
  const sessions = new WeakMap<object, { turn?: number; mergedShownTurn?: number; records: Array<{ key: string; merged: string; segments: string[] }> }>();

  function stateFor(session) {
    let state = sessions.get(session);
    if (!state) { state = { turn: undefined, mergedShownTurn: undefined, records: [] }; sessions.set(session, state); }
    return state;
  }

  function absolute(session, target) {
    const value = String(target ?? '').trim();
    if (!value) return '';
    try { return path.resolve(session?.header?.cwd || process.cwd(), value); } catch { return ''; }
  }

  /** 工具真实返回过哪些分段与成片：只认下载成功的分段和与分段不同的合并文件。 */
  function remember(session, value) {
    if (!session || typeof session !== 'object') return;
    const segments = (value?.segments || [])
      .filter(segment => segment?.status === 'succeeded' && segment?.localPath)
      .map(segment => absolute(session, segment.localPath)).filter(Boolean);
    const merged = value?.merged && value?.videoPath ? absolute(session, value.videoPath) : '';
    const distinct = merged && !segments.includes(merged) ? merged : '';
    if (!distinct) return;
    const key = [distinct, ...segments].join('\u0000');
    const state = stateFor(session);
    if (state.records.some(record => record.key === key)) return;
    state.records.push({ key, merged: distinct, segments });
  }

  function observe(session, event) {
    if (!session || typeof session !== 'object') return;
    const data = event?.data || {};
    const state = stateFor(session);
    if (Number.isInteger(data.turn)) state.turn = data.turn;
    if (event.type !== 'deliverables/presented') return;
    const shown = (data.files || []).map(file => absolute(session, file?.path)).filter(Boolean);
    if (shown.some(target => state.records.some(record => record.merged === target))) state.mergedShownTurn = data.turn;
  }

  function pickRecord(state, paths) {
    let best = null;
    let score = 0;
    for (const record of state.records) {
      const current = paths.filter(target => target === record.merged || record.segments.includes(target)).length;
      if (current > score) { best = record; score = current; }
    }
    return best;
  }

  async function gate(exec) {
    if (exec?.name !== 'present' || !exec.agent?.session) return null;
    const session = exec.agent.session;
    const state = sessions.get(session);
    if (!state?.records.length) return null;
    let args = exec.arguments;
    if (typeof args === 'string') { try { args = JSON.parse(args); } catch { return null; } }
    const files = Array.isArray(args?.files) ? args.files : [];
    const paths = files.map(file => absolute(session, typeof file === 'string' ? file : file?.path)).filter(Boolean);
    if (!paths.length) return null;
    const record = pickRecord(state, paths);
    if (!record?.merged) return null;
    const mergedIndex = paths.indexOf(record.merged);
    const order = () => `正确顺序：1. ${record.merged}\n${record.segments.map((segment, index) => `${index + 2}. ${segment}`).join('\n')}`;
    const segmentsBeforeMerged = mergedIndex > 0 && paths.slice(0, mergedIndex).some(target => record.segments.includes(target));
    if (segmentsBeforeMerged) {
      await appendRequestLog({ event: 'delivery_order_blocked', reason: 'merged_not_first', files: paths });
      return { kind: 'deny', reason: '成片展示顺序不对：合并成片必须排在所有分段之前。'
        + '请立即重新调用 present，把合并成片放在 files 数组第一个，再按段号依次放第一段、第二段……'
        + `\n${order()}` };
    }
    if (mergedIndex >= 0) return null;
    const shownSegments = paths.filter(target => record.segments.includes(target)).length;
    if (!shownSegments) return null;
    if (Number.isInteger(state.turn) && state.mergedShownTurn === state.turn) return null;
    await appendRequestLog({ event: 'delivery_order_blocked', reason: 'merged_missing', files: paths });
    return { kind: 'deny', reason: '这次只展示了分段，成片要排在第一个位置。'
      + '请立即重新调用 present，把合并成片放在 files 数组第一个，再按段号依次放分段。'
      + `\n${order()}` };
  }

  return { remember, observe, gate };
}
