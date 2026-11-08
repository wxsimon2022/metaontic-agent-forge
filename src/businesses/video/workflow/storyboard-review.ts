/** 监听当前会话的真实展示事件；审核提问不能仅凭 present 登记放行。 */
import path from 'node:path';
import { stat, readdir } from 'node:fs/promises';
import { appendRequestLog } from '../../../core/utils/logging.js';

/** 分镜图：png/jpg/webp/svg，且文件名或描述里带「分镜/示意/storyboard」。 */
const STORYBOARD_FILE = /storyboard|分镜|示意/i;
const IMAGE_FILE = /\.(png|jpe?g|webp|svg)$/i;

export function createStoryboardReviewGuard({ log = appendRequestLog } = {}) {
  const sessions = new WeakMap<object, { turn: number; active: boolean; files: string[]; shown: Set<string>; awaitingReview: boolean; text: string }>();
  /** 上一轮展示过本版脚本却没弹审核窗时留痕：正文单独成一条消息时助手常直接结束回合。 */
  async function reportMissing(state) {
    state.awaitingReview = false;
    await log({ event: 'storyboard_review_missing', reason: 'turn_ended_without_review_ask', turn: state.turn });
  }
  function stateFor(session, turn) {
    let state = sessions.get(session);
    if (state && Number.isInteger(turn) && turn !== state.turn && state.awaitingReview) void reportMissing(state);
    if (!state || (Number.isInteger(turn) && turn !== state.turn)) {
      state = { turn, active: false, files: [], shown: new Set(), awaitingReview: false, text: '' };
      sessions.set(session, state);
    }
    return state;
  }
  function observe(session, event) {
    if (!session || typeof session !== 'object') return;
    const data = event?.data || {};
    if (!Number.isInteger(data.turn)) return;
    const state = stateFor(session, data.turn);
    if (event.type === 'turn/end') {
      if (state.awaitingReview) void reportMissing(state);
      return;
    }
    if (event.type === 'tool/call' && ['video_estimate', 'video_stage', 'video_project'].includes(data.name)) state.active = true;
    if (event.type === 'deliverables/presented') {
      // present 只登记最终成片，分镜图不走卡片；这里仅把登记过的分镜图留作提示用。
      const files = (data.files || []).filter(file => typeof file.path === 'string'
        && IMAGE_FILE.test(file.path) && STORYBOARD_FILE.test(file.path + ' ' + (file.description || ''))).map(file => file.path);
      if (files.length) { state.active = true; state.files = files; }
    }
    if (event.type === 'assistant/message') {
      // reasoning、工具参数、工具看图结果都不是用户可见正文。
      const content = data.message?.content;
      const text = Array.isArray(content) ? content.filter(block => block.type === 'text').map(block => block.text || '').join('\n') : '';
      state.text = (state.text + '\n' + text).slice(-250000);
      let storyboard = false;
      for (const match of text.matchAll(/!\[[^\]]*\]\(\s*(?:<([^>]+)>|([^\s)]+))\s*\)/g)) {
        const target = match[1] || match[2];
        try {
          const full = path.resolve(session.header?.cwd || process.cwd(), decodeURI(target));
          state.shown.add(full);
          if (STORYBOARD_FILE.test(path.basename(full))) storyboard = true;
        } catch { /* malformed image target */ }
      }
      // 正文已经发出分镜图：这一轮再不弹审核窗就要留痕，下一轮补弹。
      if (storyboard) state.awaitingReview = true;
    }
  }

  /**
   * 改稿后必须展示当前版：同目录里还有比已内嵌那张更新的分镜图，就说明新版没发出来。
   * 只看分镜图所在目录，避免把别的项目或别的素材算进来。
   */
  async function newerVersion(embedded: string[]): Promise<string> {
    const fresh = new Map<string, number>();
    for (const file of embedded) {
      try { const info = await stat(file); if (info.isFile()) fresh.set(file, info.mtimeMs); } catch { /* 文件没了按未展示处理 */ }
    }
    const byDir = new Map<string, number>();
    for (const [file, time] of fresh) byDir.set(path.dirname(file), Math.max(byDir.get(path.dirname(file)) || 0, time));
    for (const [dir, time] of byDir) {
      let entries: string[];
      try { entries = await readdir(dir); } catch { continue; }
      let newest = '';
      for (const entry of entries) {
        if (!IMAGE_FILE.test(entry) || !STORYBOARD_FILE.test(entry)) continue;
        const full = path.join(dir, entry);
        if (fresh.has(full)) continue;
        try {
          const info = await stat(full);
          if (!info.isFile()) continue;
          if (info.mtimeMs > time && info.mtimeMs > (newest ? (await stat(newest)).mtimeMs : 0)) newest = full;
        } catch { /* 读不到的文件不算新版 */ }
      }
      if (newest) return newest;
    }
    return '';
  }

  const linkHint = (target: string) => target
    ? `请先在独立的用户可见正文内嵌 ![分镜示意图](<${target}>) 并附 [打开原图](<${target}>)。`
    : '请先确认本版分镜图文件存在，再在独立正文内嵌图片并附原图链接。';

  async function gate(exec) {
    if (exec?.name !== 'ask_user_question' || !exec.agent?.session) return null;
    let args = exec.arguments;
    if (typeof args === 'string') { try { args = JSON.parse(args); } catch { return null; } }
    const questions = args?.questions || [];
    const review = questions.some(question => /script[_-]?review|脚本.*(?:审核|可以|通过|确认)|(?:审核|确认).*脚本/i.test([question.id, question.header, question.question].join(' ')));
    const state = sessions.get(exec.agent.session);
    // 只要真的发起了审核提问就不再算漏问；放行与否仍由下面的展示检查决定。
    if (review && state) state.awaitingReview = false;
    if (!review || (!args.requireStoryboard && !state?.active)) return null;
    const normalized = value => String(value || '').replace(/\s+/g, '');
    if (args.requiredScriptText && !normalized(state?.text).includes(normalized(args.requiredScriptText))) return { kind: 'deny', reason: '请先在本轮用户可见正文完整展示script.md正文，再调用review；文件链接或摘要不能代替完整脚本。' };
    const embedded = [...(state?.shown || [])].filter(target => STORYBOARD_FILE.test(path.basename(target)));
    let ready = embedded.length > 0;
    if (ready) {
      for (const file of embedded) {
        try { if (!(await stat(file)).isFile()) ready = false; } catch { ready = false; }
      }
    }
    const stale = ready ? await newerVersion(embedded) : '';
    if (ready && !stale) return null;
    const target = stale || state?.files[0] || '';
    await appendRequestLog({ event: 'storyboard_review_blocked', reason: !ready ? 'missing_inline_storyboard' : 'stale_storyboard_version' });
    return { kind: 'deny', reason: (!ready
      ? '脚本审核暂未打开：本版分镜图还没有在用户可见正文里内嵌展示。交付卡片只登记最终成片，分镜图不走卡片，'
      : `脚本审核暂未打开：改稿后的新版分镜图还没展示（${stale}）。`)
      + linkHint(target)
      + 'present 与模型看图都不等于用户看到图，只有正文里真实渲染的图片才算；'
      + '正文发送完成后再单独调用 ask_user_question，不能与展示并行；不要重画或调用付费生成。' };
  }
  return { observe, gate };
}
