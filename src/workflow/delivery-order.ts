/** workflow/delivery-order：把「合并成片排第一」从提示词要求升级成提交前的真实校验。 */
import path from 'node:path';
import { stat } from 'node:fs/promises';
import { appendRequestLog } from '../utils/logging.js';

type Video = { path: string; size: number };
type Group = { dir: string; merges: Video[]; segments: Video[] };
type Mark = { role: 'film' | 'segment'; path: string };

/**
 * 录制本次会话真实交付过的分段与合并成片，并在 present 提交前校验顺序。
 * 交付时助手常把成片改名、把分段换成交付目录里的副本，光比绝对路径会整批漏判，
 * 所以按「绝对路径 → 同名 → 文件字节数」逐级认领，认领不到才放行。
 * 只拦「成片没有排在分段之前」这一种错法；单文件、无成片、非视频文件都不受影响。
 */
export function createDeliveryOrderGuard() {
  const sessions = new WeakMap<object, { turn?: number; mergedShownTurn?: number; groups: Group[] }>();

  function stateFor(session) {
    let state = sessions.get(session);
    if (!state) { state = { turn: undefined, mergedShownTurn: undefined, groups: [] }; sessions.set(session, state); }
    return state;
  }

  function absolute(session, target) {
    const value = String(target ?? '').trim();
    if (!value) return '';
    try { return path.resolve(session?.header?.cwd || process.cwd(), value); } catch { return ''; }
  }

  const nameOf = (target: string) => { try { return path.basename(target).toLowerCase(); } catch { return ''; } };

  async function sizeOf(target) {
    try { const info = await stat(target); return info.isFile() ? info.size : 0; } catch { return 0; }
  }

  /** 工具真实返回过哪些分段与成片：只认下载成功的分段和与分段不同的合并文件。 */
  async function remember(session, value) {
    if (!session || typeof session !== 'object') return;
    const segments = (value?.segments || [])
      .filter(segment => segment?.status === 'succeeded' && segment?.localPath)
      .map(segment => absolute(session, segment.localPath)).filter(Boolean);
    const film = value?.merged && value?.videoPath ? absolute(session, value.videoPath) : '';
    const distinct = film && !segments.includes(film) ? film : '';
    if (!distinct && !segments.length) return;
    // 同一次生成（同一 segmentsDir）的多轮续做要并进同一组，才能在最后分辨「哪条才是本次的成片」。
    const dir = String(value?.segmentsDir || value?.resumeDir || '').trim() || distinct || segments[0];
    const state = stateFor(session);
    let group = state.groups.find(item => item.dir === dir);
    if (!group) { group = { dir, merges: [], segments: [] }; state.groups.push(group); }
    for (const target of segments) {
      if (!group.segments.some(item => item.path === target)) group.segments.push({ path: target, size: await sizeOf(target) });
    }
    if (distinct && !group.merges.some(item => item.path === distinct)) {
      group.merges.push({ path: distinct, size: await sizeOf(distinct) });
    }
  }

  function observe(session, event) {
    if (!session || typeof session !== 'object') return;
    const data = event?.data || {};
    const state = stateFor(session);
    if (Number.isInteger(data.turn)) state.turn = data.turn;
    if (event.type !== 'deliverables/presented') return;
    const shown = (data.files || []).map(file => absolute(session, file?.path)).filter(Boolean);
    if (shown.some(target => state.groups.some(group => group.merges.some(item => item.path === target || nameOf(item.path) === nameOf(target))))) {
      state.mergedShownTurn = data.turn;
    }
  }

  /** 认领一个交付文件：先比路径与文件名，再比字节数（改名后的副本只能靠大小认）。 */
  function identify(group: Group, target: string, size: number): Mark | null {
    const name = nameOf(target);
    const role = (item: Video): Mark => ({ role: group.merges.includes(item) ? 'film' : 'segment', path: item.path });
    const samePath = (item: Video) => item.path === target || nameOf(item.path) === name;
    const byPath = group.merges.find(samePath) || group.segments.find(samePath);
    if (byPath) return role(byPath);
    if (!size) return null;
    const bySize = group.merges.find(item => item.size === size) || group.segments.find(item => item.size === size);
    return bySize ? role(bySize) : null;
  }

  async function gate(exec) {
    if (exec?.name !== 'present' || !exec.agent?.session) return null;
    const session = exec.agent.session;
    const state = sessions.get(session);
    if (!state?.groups.length) return null;
    let args = exec.arguments;
    if (typeof args === 'string') { try { args = JSON.parse(args); } catch { return null; } }
    const files = Array.isArray(args?.files) ? args.files : [];
    const paths = files.map(file => absolute(session, typeof file === 'string' ? file : file?.path)).filter(Boolean);
    if (!paths.length) return null;
    const sizes = new Map<string, number>();
    for (const target of paths) sizes.set(target, await sizeOf(target));
    // 命中条数最多的那一组，才是本次交付对应的那次生成。
    let best: { group: Group; marks: Array<Mark | null> } | null = null;
    for (const group of state.groups) {
      const marks = paths.map(target => identify(group, target, sizes.get(target) || 0));
      const hit = marks.filter(Boolean).length;
      if (hit && hit > (best?.marks.filter(Boolean).length || 0)) best = { group, marks };
    }
    if (!best) return null;
    const { group, marks } = best;
    const latest = group.merges[group.merges.length - 1];
    if (!latest || !latest.path) return null;
    const isLatest = (mark: Mark | null) => Boolean(mark && mark.role === 'film' && mark.path === latest.path);
    const filmIndex = marks.findIndex(isLatest);
    const others = marks.map((mark, index) => (mark && !isLatest(mark) ? index : -1)).filter(index => index >= 0);
    const order = () => `正确顺序：1. ${latest.path}\n${group.segments.map((item, index) => `${index + 2}. ${item.path}`).join('\n')}`;
    if (filmIndex > 0 && others.some(index => index < filmIndex)) {
      await appendRequestLog({ event: 'delivery_order_blocked', reason: 'merged_not_first', files: paths });
      return { kind: 'deny', reason: '成片展示顺序不对：合并成片必须排在所有分段之前。'
        + '请立即重新调用 present，把合并成片放在 files 数组第一个，再按段号依次放第一段、第二段……'
        + `\n${order()}` };
    }
    if (filmIndex >= 0) return null;
    if (!others.length) return null;
    if (Number.isInteger(state.turn) && state.mergedShownTurn === state.turn) return null;
    await appendRequestLog({ event: 'delivery_order_blocked', reason: 'merged_missing', files: paths });
    return { kind: 'deny', reason: '这次只展示了分段，成片要排在第一个位置。'
      + '请立即重新调用 present，把合并成片放在 files 数组第一个，再按段号依次放分段。'
      + `\n${order()}` };
  }

  return { remember, observe, gate };
}
