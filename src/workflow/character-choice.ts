import { readProject, writeProject, projectCharacterGate } from './project.js';
/** 文生视频提交前强制取得角色图选择；不依赖模型是否遵守提示词。 */
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, rename, rm } from 'node:fs/promises';
import path from 'node:path';
import { dshHome } from '../media/references.js';
import { isVolcengine } from '../providers/connection.js';
import { timedStage } from '../utils/timing.js';

const waiting = new Map<string, Promise<string | null>>();
const localIds = new WeakMap<object, string>();
let nextId = 0;
const IMAGE = '先生成角色图（单独计费）';
const TEXT = '直接文生视频';
function hasImages(args) {
  return [args?.firstFrameUrl, ...(Array.isArray(args?.referenceImages) ? args.referenceImages : [args?.referenceImages]), ...(Array.isArray(args?.characterReferenceImages) ? args.characterReferenceImages : [])]
    .some(value => typeof value === 'string' && Boolean(value.trim()));
}
export async function characterChoiceGate(ctx, config, exec, args) {
  if (exec.name !== 'video_generate' || String(args?.resume || '').trim() || hasImages(args)) return null;
  if (args?.projectId && !args.preparation) return projectCharacterGate(config, exec, args);
  const project = args?.projectId ? await readProject(args.projectId, exec) : null;
  const session = exec.agent?.session;
  const deny = reason => ({ kind: 'deny', reason });
  if (!session || typeof session !== 'object') return deny('提交已停止：纯文生视频须先询问是否生成角色参考图，当前缺少可交互会话。');
  const stableId = typeof session.id === 'string' ? session.id : typeof session.header?.id === 'string' ? session.header.id : null;
  if (!localIds.has(session)) localIds.set(session, `live-${++nextId}`);
  const key = createHash('sha256').update(JSON.stringify(project ? [project.id] : [stableId || localIds.get(session), args?.prompt || '', args?.duration, args?.resolution, args?.ratio])).digest('hex');
  const file = path.join(dshHome(), 'metaontic-video', 'character-choices', key + '.json');
  try {
    async function choose() {
      if (project?.choice && args?.resetCharacterChoice !== true) return project.choice;
      if (!project && stableId && args?.resetCharacterChoice !== true) {
        try { const saved = JSON.parse(await readFile(file, 'utf8')); if (saved.version === 1 && ['text_only', 'generate_first'].includes(saved.choice)) return saved.choice; }
        catch (error) { if (error?.code !== 'ENOENT') return null; }
      }
      const service = ctx.get?.('userQuestions') || exec.agent?.ctx?.get?.('userQuestions');
      if (typeof service?.ask !== 'function') return null;
      const first = isVolcengine(config) ? '使用我提供的角色图' : IMAGE;
      const result = await timedStage('character_choice_wait', () => service.ask({
        agent: exec.agent, signal: exec.signal, ...(exec.callId ? { wait: { callId: exec.callId } } : {}),
        questions: [{ id: 'metaontic_character_reference', header: '角色参考图',
          question: isVolcengine(config) ? '是否先准备角色参考图？当前火山直连不提供代生成图片通道，可使用你提供的角色图，或直接文生视频。' : '是否先生成角色参考图？图片调用单独计费，生成后先看图确认，再用于视频和后续续拍。',
          multiSelect: false, options: [{ label: first, description: isVolcengine(config) ? '提供角色图并确认后再生成视频。' : '先生成并审核角色图，图片费用与视频分开。' }, { label: TEXT, description: '不生成角色图，按纯文生方案制作视频。' }] }],
      }));
      if (exec.signal?.aborted) return null;
      const answer = result?.answers?.find(item => item.id === 'metaontic_character_reference');
      const selected = answer?.custom ? answer.custom.trim() : answer?.selected?.length === 1 ? answer.selected[0] : '';
      const choice = selected === first ? 'generate_first' : selected === TEXT ? 'text_only' : null;
      if (!choice) return null;
      if (project) { project.choice = choice; project.approved = null; await writeProject(project); }
      else if (stableId) {
        await mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
        const temp = file + '.' + Date.now() + '.tmp';
        try { await writeFile(temp, JSON.stringify({ version: 1, choice, time: new Date().toISOString() }), { mode: 0o600, flag: 'wx' }); await rename(temp, file); }
        finally { await rm(temp, { force: true }).catch(() => {}); }
      }
      return choice;
    }
    let pending = waiting.get(key);
    if (!pending) { pending = choose(); waiting.set(key, pending); }
    let choice;
    try { choice = await pending; } finally { if (waiting.get(key) === pending) waiting.delete(key); }
    if (choice === 'text_only') return null;
    if (choice === 'generate_first') return deny(isVolcengine(config)
      ? '用户选择先使用角色图，已停止纯文生视频提交。请先取得并审核用户提供的角色图，再传referenceImages/characterReferenceImages；不要重复询问或直接生成视频。'
      : '用户已明确选择先生成角色图，已停止纯文生视频提交。请先用video_prepare_image(operation:create_character)按已确认设定出图，图片单独计费；展示审核后将图片传入referenceImages和characterReferenceImages，再单独确认视频费用与制作。不要重复询问此选择，不要直接重提纯文生视频；用户明确改变方案时，传resetCharacterChoice:true重新取得选择。');
    return deny('角色图选择尚未取得明确答复，已停止提交。取消、跳过、pending、交互不可用或记录失败都不等于选择直接文生视频；恢复询问能力后再继续，不得默认跳过。');
  } catch { return deny('角色图选择未完成，未提交视频。请恢复询问与选择记录能力后再继续，不要自动跳过或重提。'); }
}
