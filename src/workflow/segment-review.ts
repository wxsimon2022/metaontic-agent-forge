/** 分段结果审核在视频工具返回、正文展示之后单独执行，不能阻塞生成工具输出。 */
import path from 'node:path';
import { readFile, writeFile, rename, rm, stat } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { readPauseFile, resumeDirOf } from './resume.js';
import { sessionOwner, lockProject } from './project.js';
import { appendRequestLog } from '../utils/logging.js';

async function segmentSnapshot(dir) {
  const saved = await readPauseFile(dir);
  const done = Number(saved.done) || 0;
  const last = saved.steps?.at(-1);
  if (!done || !last?.taskId) throw new Error('这份进度没有可审核的已完成分段，请先查询原任务。');
  return { saved, key: `${done}:${last.taskId}`, done, last,
    file: path.join(dir, `${String(last.index).padStart(2, '0')}-${last.kind}.mp4`) };
}
const reviewFile = dir => path.join(dir, 'segment-review.json');
async function accepted(dir, key, exec) {
  try {
    const data = JSON.parse(await readFile(reviewFile(dir), 'utf8'));
    return data.version === 1 && data.owner === sessionOwner(exec) && data.key === key && data.approved === true;
  } catch { return false; }
}
export async function assertSegmentReviewed(exec, args) {
  const dir = resumeDirOf(args?.resume);
  if (!dir || args.cumulativePreview === true) return;
  const saved = await readPauseFile(dir);
  if (saved.pendingTask || saved.deliveryPending || !(Number(saved.done) > 0)) return;
  const done = Number(saved.done);
  // 纯读取最终成果不需要重新审核；追加任务仍需要上一段的效果确认。
  const appending = Number(args.duration) > Number(saved.cursor) || args.segments != null;
  if (done >= saved.plan.length && !appending) return;
  const snap = await segmentSnapshot(dir);
  if (!await accepted(dir, snap.key, exec)) throw new Error('上一段视频尚未通过结果审核，未提交下一段。请先在正文展示本段视频的可点击链接，再调用video_project(action:review_segment,resume:原resumeDir)弹出结果确认窗；不能用文字问句或制作费用审批替代。');
}
export function createSegmentReview(ctx) {
  const shown = new WeakMap<object, Set<string>>();
  function observe(session, event) {
    if (!session || event?.type !== 'assistant/message') return;
    const content = event.data?.message?.content;
    const text = (Array.isArray(content) ? content : []).filter(x => x.type === 'text').map(x => x.text || '').join('\n');
    let links = shown.get(session);
    if (!links) { links = new Set(); shown.set(session, links); }
    for (const match of text.matchAll(/\[[^\]]*\]\(\s*(?:<([^>]+)>|([^\s)]+))\s*\)/g)) {
      const target = match[1] || match[2];
      try { links.add(/^https?:\/\//i.test(target) ? target : path.resolve(session.header?.cwd || process.cwd(), decodeURI(target))); } catch { /* malformed link */ }
    }
  }
  async function review(args, exec) {
    const dir = resumeDirOf(args?.resume);
    if (!dir) throw new Error('分段审核需要原resumeDir，不重新生成。');
    return lockProject(`segment:${dir}`, async () => {
      const snap = await segmentSnapshot(dir);
      const owner = sessionOwner(exec);
      if (await accepted(dir, snap.key, exec)) return { status: 'approved', done: snap.done, resumeDir: dir, reused: true };
      const links = shown.get(exec?.agent?.session);
      let localReady = false;
      try { localReady = (await stat(snap.file)).isFile(); } catch { /* use upstream link */ }
      if (!(localReady && links?.has(snap.file)) && !links?.has(snap.last.videoUrl)) return { status: 'blocked', resumeDir: dir, reason: '请先在用户可见正文用可点击链接展示刚完成的分段，再调用review_segment；文件登记、工具看视频或纯文字路径不算展示。', videoPath: localReady ? snap.file : undefined, videoUrl: snap.last.videoUrl };
      const service = exec.agent?.ctx?.get?.('userQuestions') || ctx.get?.('userQuestions');
      if (typeof service?.ask !== 'function') return { status: 'pending', resumeDir: dir, reason: '结果确认弹窗不可用，未授权下一段，请恢复交互能力后重试审核。' };
      const id = 'segment_result_review';
      const result = await service.ask({ agent: exec.agent, signal: exec.signal, ...(exec.callId ? { wait: { callId: exec.callId } } : {}), questions: [{ id, header: '分段结果确认', question: `请先看第${snap.done}段视频，效果是否可以？通过后才能进入下一段的费用确认。`, multiSelect: false, options: [{ label: '效果可以，继续下一段', description: '认可这段效果，随后单独确认下一段费用。' }, { label: '先暂停，暂不继续', description: '保留现有视频，不提交新任务；不满意可说明修改要求。' }] }] });
      const answer = result?.answers?.find(a => a.id === id);
      const approved = !exec.signal?.aborted && !answer?.custom && answer?.selected?.length === 1 && answer.selected[0] === '效果可以，继续下一段';
      if (!approved) return { status: 'paused', resumeDir: dir, reason: '未通过本段结果审核，不提交下一段，不自动重做已完成视频。' };
      if ((await segmentSnapshot(dir)).key !== snap.key) throw new Error('等待审核期间分段进度已改变，请展示最新一段并重新确认。');
      const temp = `${reviewFile(dir)}.${randomUUID()}.tmp`;
      try { await writeFile(temp, JSON.stringify({ version: 1, owner, key: snap.key, approved: true, reviewedAt: new Date().toISOString() }), { mode: 0o600, flag: 'wx' }); await rename(temp, reviewFile(dir)); }
      finally { await rm(temp, { force: true }).catch(() => {}); }
      await appendRequestLog({ event: 'segment_review_approved', done: snap.done, resumeDir: dir });
      return { status: 'approved', done: snap.done, resumeDir: dir, nextAction: `使用${snap.saved.toolName || 'video_generate'}的原resume继续；下一段仍需费用审批，不重复生成首段。` };
    });
  }
  return { observe, review };
}
