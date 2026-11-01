/** 监听当前会话的真实展示事件；审核提问不能仅凭 present 登记放行。 */
import path from 'node:path';
import { stat } from 'node:fs/promises';
import { appendRequestLog } from '../utils/logging.js';

export function createStoryboardReviewGuard() {
  const sessions = new WeakMap<object, { turn: number; active: boolean; files: string[]; shown: Set<string> }>();
  function stateFor(session, turn) {
    let state = sessions.get(session);
    if (!state || (Number.isInteger(turn) && turn !== state.turn)) {
      state = { turn, active: false, files: [], shown: new Set() };
      sessions.set(session, state);
    }
    return state;
  }
  function observe(session, event) {
    if (!session || typeof session !== 'object') return;
    const data = event?.data || {};
    if (!Number.isInteger(data.turn)) return;
    const state = stateFor(session, data.turn);
    if (event.type === 'tool/call' && ['video_estimate', 'video_stage'].includes(data.name)) state.active = true;
    if (event.type === 'deliverables/presented') {
      const files = (data.files || []).filter(file => typeof file.path === 'string' && /\.(png|jpe?g|webp|svg)$/i.test(file.path)
        && /storyboard|分镜|示意/i.test(file.path + ' ' + (file.description || ''))).map(file => file.path);
      if (files.length) { state.active = true; state.files = files; state.shown.clear(); }
    }
    if (event.type === 'assistant/message') {
      // reasoning、工具参数、工具看图结果都不是用户可见正文。
      const content = data.message?.content;
      const text = Array.isArray(content) ? content.filter(block => block.type === 'text').map(block => block.text || '').join('\n') : '';
      for (const match of text.matchAll(/!\[[^\]]*\]\(\s*(?:<([^>]+)>|([^\s)]+))\s*\)/g)) {
        const target = match[1] || match[2];
        try { state.shown.add(path.resolve(session.header?.cwd || process.cwd(), decodeURI(target))); } catch { /* malformed image target */ }
      }
    }
  }
  async function gate(exec) {
    if (exec?.name !== 'ask_user_question' || !exec.agent?.session) return null;
    let args = exec.arguments;
    if (typeof args === 'string') { try { args = JSON.parse(args); } catch { return null; } }
    const questions = args?.questions || [];
    const review = questions.some(question => /script[_-]?review|脚本.*(?:审核|可以|通过|确认)|(?:审核|确认).*脚本/i.test([question.id, question.header, question.question].join(' ')));
    const state = sessions.get(exec.agent.session);
    if (!review || !state?.active) return null;
    let ready = state.files.length > 0 && state.files.every(file => state.shown.has(path.resolve(file)));
    if (ready) {
      for (const file of state.files) {
        try { if (!(await stat(file)).isFile()) ready = false; } catch { ready = false; }
      }
    }
    if (ready) return null;
    await appendRequestLog({event:'storyboard_review_blocked',reason:state.files.length?'missing_inline_image':'missing_presented_storyboard'});
    const target = state.files[0];
    return {kind:'deny',reason:'脚本审核暂未打开：分镜图尚未完成正文展示。present只登记交付，卡片在轮次结束后才出现，不能当作审核时已展示。'
      + (target ? `请先在独立的用户可见正文输出 ![分镜示意图](<${target}>) 和 [打开原图](<${target}>)。` : '请先确认本版分镜图文件存在并用present登记，再在独立正文内嵌图片并附原图链接。')
      + '正文发送完成后再单独调用ask_user_question，不能与展示并行；不要重画或调用付费生成。'};
  }
  return {observe,gate};
}
