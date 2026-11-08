import { assertSegmentReviewed } from './segment-review.js';
/** 项目身份、真实审核答复与制作参数的持久化。无密钥、无付费调用。 */
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile, rename, rm } from 'node:fs/promises';
import path from 'node:path';
import { dshHome } from '../media/references.js';
import { ref, resolveResolution } from '../config.js';
import { resolveBaseUrl, resolveModel, resolveSubmitPath } from '../providers/connection.js';
import { resumeDirOf, readPauseFile } from './resume.js';

const locks = new Set<string>();
const hash = value => createHash('sha256').update(value).digest('hex');
function stable(value): any {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().filter(k => value[k] !== undefined).map(k => [k, stable(value[k])]));
  return value;
}
export function sessionOwner(exec) {
  const session = exec?.agent?.session;
  const id = session?.id || session?.header?.id;
  if (typeof id !== 'string' || !id) throw new Error('项目操作需要可识别的会话，尚未提交视频。');
  return hash(id);
}
function projectFile(id) {
  if (!/^[a-f0-9-]{36}$/.test(String(id || ''))) throw new Error('缺少有效 projectId，请先调用 video_project(action:prepare)。');
  return path.join(dshHome(), 'metaontic-agent-forge', 'projects', `${id}.json`);
}
export async function readProject(id, exec) {
  const data = JSON.parse(await readFile(projectFile(id), 'utf8'));
  if (data.version !== 1 || data.owner !== sessionOwner(exec)) throw new Error('此项目不属于当前会话。');
  return data;
}
export async function writeProject(data) {
  const file = projectFile(data.id);
  await mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
  const temp = `${file}.${randomUUID()}.tmp`;
  try { await writeFile(temp, JSON.stringify(data), { mode: 0o600, flag: 'wx' }); await rename(temp, file); }
  finally { await rm(temp, { force: true }).catch(() => {}); }
}
export async function lockProject(id, fn) {
  if (locks.has(id)) throw new Error('此项目有操作正在等待，请先完成当前操作。');
  locks.add(id);
  try { return await fn(); } finally { locks.delete(id); }
}
export async function createProject(exec, subjectType) {
  const data = { version: 1, id: randomUUID(), owner: sessionOwner(exec), subjectType, choice: '', approved: null };
  await writeProject(data);
  return data;
}
export function hasProjectImages(args) {
  return [args?.firstFrameUrl, ...(Array.isArray(args?.referenceImages) ? args.referenceImages : [args?.referenceImages]), ...(args?.characterReferenceImages || [])].some(v => typeof v === 'string' && v.trim());
}
/** 绑定全部生成字段与实际非敏感配置；审批、交付控制参数不影响内容审核。 */
export function productionFingerprint(config, name, args) {
  const ignore = new Set(['projectId', 'resume', 'merge', 'cumulativePreview', 'outputDir', 'keepSegments', 'resetCharacterChoice', 'resumeWithCurrentConfig', 'referenceImagesReviewed', 'inputVideoSeconds']);
  const parameters = Object.fromEntries(Object.entries(args || {}).filter(([k]) => !ignore.has(k)));
  return hash(JSON.stringify(stable({ name, parameters, model: resolveModel(config), baseUrl: resolveBaseUrl(config), submitPath: resolveSubmitPath(config),
    mode: ref(config, 'connectionMode', 'metaontic'), ratio: args.ratio ?? ref(config, 'ratio', '9:16'), resolution: resolveResolution(config, args),
    audio: args.generateAudio ?? ref(config, 'generateAudio', true), watermark: args.watermark ?? ref(config, 'watermark', false), extra: ref(config, 'extraParams', '') })));
}
export async function scriptDigest(file) { return hash(await readFile(file)); }
export async function assertProjectApproved(config, exec, args) {
  let candidate = args;
  if (resumeDirOf(args?.resume)) {
    const saved = await readPauseFile(resumeDirOf(args.resume));
    if (args.cumulativePreview === true) {
      if (Object.keys(args).some(k => !['resume', 'cumulativePreview'].includes(k))) throw new Error('累计预览只传resume和cumulativePreview，不改变生成参数。');
      return;
    }
    // 原任务查询与交付恢复不产生新费用，兼容旧断点。
    if (saved.pendingTask || saved.deliveryPending) return;
    if (!saved.options?.projectId) {
      const changed = Object.keys(args).some(k => !['resume', 'cumulativePreview', 'merge', 'outputDir', 'referenceImagesReviewed'].includes(k));
      if (changed) throw new Error('旧进度只可沿原参数续做；变更方案请新建项目并审核。');
      return;
    }
    candidate = { ...saved.options, prompt: saved.prompt, ...args };
  }
  const data = await readProject(candidate.projectId, exec);
  if (!resumeDirOf(args?.resume) && args.duration == null) throw new Error('生成前必须传入用户已确认的视频时长duration，不得使用默认15秒。');
  if (data.approved?.resumeDir && resumeDirOf(args.resume) !== data.approved.resumeDir) throw new Error('此次审核绑定了原续做目录，请使用原resume。');
  if (!data.approved) throw new Error('本项目脚本尚未审核通过，请先展示脚本和分镜，再调用 video_project(action:review)。');
  if (await scriptDigest(data.approved.scriptPath) !== data.approved.scriptHash) throw new Error('脚本已修改，请重新审核当前版本。');
  // 续做时沿用完整审核参数，只覆盖用户本次明确传入的字段。
  const parameters = args.resume ? { ...data.approved.specification, ...args } : candidate;
  if (productionFingerprint(config, exec.name, parameters) !== data.approved.fingerprint) throw new Error('制作参数或接入配置已变化，请重新审核脚本和本次完整 specification。');
  if (data.choice === 'generate_first' && !hasProjectImages(parameters)) throw new Error('请先生成或提供角色图、展示审核后再制作。');
}
export async function projectCharacterGate(config, exec, args) {
  if (!args?.projectId || args.resume) return null;
  const data = await readProject(args.projectId, exec);
  if (data.subjectType === 'scenery' || data.choice === 'text_only' || hasProjectImages(args)) return null;
  return { kind: 'deny', reason: '本项目需要先完成角色图选择及图片审核，请在需求阶段调用 video_project(action:prepare)，再展示最终脚本审核。' };
}

/** 宿主审批后执行前再核验，避免等待审批期间脚本/配置变化，亦覆盖直接工具执行。 */
export function withProjectApproval(tool, config) {
  return { ...tool, async execute(args, exec) {
    await assertSegmentReviewed(exec, args || {});
    await assertProjectApproved(config, { ...exec, name: tool.name }, args || {});
    return tool.execute(args, exec);
  } };
}
