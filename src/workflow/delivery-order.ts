/** workflow/delivery-order：把「交付卡片只登记最终成片」从提示词要求升级成提交前的真实校验。 */
import path from 'node:path';
import { stat } from 'node:fs/promises';
import { appendRequestLog } from '../utils/logging.js';

type Video = { path: string; size: number };
type Group = { dir: string; merges: Video[]; segments: Video[]; finished: boolean };
type Mark = { role: 'film' | 'segment'; path: string };

/**
 * 录制本次会话真实交付过的分段与合并成片，并在 present 提交前校验。
 *
 * 宿主的交付卡片是**按本轮首次出现顺序**排列、按路径去重的（超过四个还会折叠隐藏），
 * 所以中途登记过的脚本、分镜、参考图、分段预览、部分合并都会把成片挤到后面，
 * 事后无论怎么补发 present 都挪不回来。这里只放行一种 present：
 * 整条视频已经生成完、成片已在本机合并成功，且这次只登记「最新成片 + 各分段」（成片第一）。
 * 其余情况一律拦下，让助手改走正文内联展示；交付时成片被改名或换目录也能靠字节数认领。
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
    if (!group) { group = { dir, merges: [], segments: [], finished: false }; state.groups.push(group); }
    for (const target of segments) {
      if (!group.segments.some(item => item.path === target)) group.segments.push({ path: target, size: await sizeOf(target) });
    }
    if (distinct && !group.merges.some(item => item.path === distinct)) {
      group.merges.push({ path: distinct, size: await sizeOf(distinct) });
    }
    // 只有「整条视频生成完 + 本机合并成功」才算最终交付；暂停、待查、部分交付都不许登记卡片。
    group.finished = value?.status === 'succeeded' && value?.merged === true
      && value?.paused !== true && value?.partial !== true && !value?.pendingTaskId;
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
    // 没有合并成片（合并失败或只是取上游链接）时不拦分段交付。
    if (!latest || !latest.path) return null;
    const isLatest = (mark: Mark | null) => Boolean(mark && mark.role === 'film' && mark.path === latest.path);
    const filmIndex = marks.findIndex(isLatest);
    const others = marks.map((mark, index) => (mark && !isLatest(mark) ? index : -1)).filter(index => index >= 0);
    const order = () => `正确顺序：1. ${latest.path}\n${group.segments.map((item, index) => `${index + 2}. ${item.path}`).join('\n')}`;
    const inlineHint = '过程材料（脚本、分镜示意图、参考图、转换图片、单段预览、暂停时的部分合并）只用正文展示：'
      + '宿主的交付卡片按本轮首次出现顺序排列、超过四个还会折叠，中途登记会把成片挤到后面，事后补发也挪不回来。';
    if (!group.finished) {
      await appendRequestLog({ event: 'delivery_order_blocked', reason: 'run_not_finished', files: paths });
      return { kind: 'deny', reason: '这次还不是最终交付（还在续段、等待查询或暂停），现在登记会占掉卡片里成片的位置。'
        + '请只用正文内联可点击链接交付本次成果，等整条视频生成结束、成片在本机合并成功后再调用一次 present。'
        + `\n${inlineHint}` };
    }
    // 部分合并、上一版成片这类中间产物最容易被忽略：它们会排在最终成片之前，必须先拦。
    if (others.some(index => marks[index]?.role === 'film')) {
      await appendRequestLog({ event: 'delivery_order_blocked', reason: 'intermediate_merge_listed', files: paths });
      return { kind: 'deny', reason: '这次登记里带了中间版本的成片（部分合并或上一版），交付卡片只放最终成片。'
        + '请去掉中间版本，只登记「最终合并成片 + 各分段」，成片放第一个，再按段号依次放第一段、第二段……'
        + `\n${order()}` };
    }
    if (filmIndex > 0 && others.some(index => index < filmIndex)) {
      await appendRequestLog({ event: 'delivery_order_blocked', reason: 'merged_not_first', files: paths });
      return { kind: 'deny', reason: '成片展示顺序不对：合并成片必须排在所有分段之前。'
        + '请立即重新调用 present，把合并成片放在 files 数组第一个，再按段号依次放第一段、第二段……'
        + `\n${order()}` };
    }
    if (filmIndex === -1) {
      // 成片本轮已经登记过（卡片里就排在前面）时，再补一次分段不会改变顺序，放行。
      if (Number.isInteger(state.mergedShownTurn) && state.mergedShownTurn === state.turn) return null;
      await appendRequestLog({ event: 'delivery_order_blocked', reason: 'merged_missing', files: paths });
      return { kind: 'deny', reason: '交付卡片里成片必须排在第一个位置，这次却没有登记成片。'
        + '请立即重新调用 present，files 数组只登记「合并成片 + 各分段」，成片放第一个，再按段号依次放第一段、第二段……'
        + `\n${order()}` };
    }
    return null;
  }

  return { remember, observe, gate };
}
