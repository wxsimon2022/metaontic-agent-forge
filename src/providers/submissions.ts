/** 提交前写入防重记录；未知结果不重发。只承诺本机防重，不假设上游支持幂等。 */
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile, rename, rm, open, readdir } from 'node:fs/promises';
import { dshHome } from '../media/references.js';
import { imageConfig, resolveApiKey, resolveBaseUrl, isVolcengine, isMetaontic } from './connection.js';
import { relayRequest } from './transport.js';
import { extractTaskId } from './response.js';
import { abortError } from '../utils/errors.js';

const hash = (value) => createHash('sha256').update(value).digest('hex');
export function submissionIdentity(config) {
  return hash(JSON.stringify([isVolcengine(config) ? 'volcengine' : isMetaontic(config) ? 'metaontic' : 'service', resolveBaseUrl(config), hash(resolveApiKey(config))]));
}
function directory() { return path.join(dshHome(), 'state', 'metaontic-video', 'submissions'); }
async function save(file, record) {
  const temporary = `${file}.${randomUUID()}.tmp`;
  try { await writeFile(temporary, JSON.stringify(record), { mode: 0o600 }); await rename(temporary, file); }
  finally { await rm(temporary, { force: true }).catch(() => {}); }
}
function blocked(record) {
  return Object.assign(new Error(`提交结果尚不确定，已阻止重复提交。记录 ID：${record.id}。请先在渠道记录中核对，再用 media_submission 关联原任务 ID，或在确认未创建后解锁；不要直接重新生成。`), { code: 'submission_unknown', submissionId: record.id });
}
export async function guardedSubmit(config, requestPath, body, signal, scope = '') {
  if (signal?.aborted) throw abortError();
  const identity = submissionIdentity(config);
  // scope 不参与文件名：同一请求即使另开调用，在未确认提交结果时也不能再提交。
  const id = hash(JSON.stringify([identity, requestPath, body]));
  await mkdir(directory(), { recursive: true, mode: 0o700 });
  const file = path.join(directory(), `${id}.json`);
  let handle;
  try { handle = await open(file, 'wx', 0o600); }
  catch (error) {
    if (error?.code !== 'EEXIST') throw error;
    const old = await readSubmission(id);
    if (old.taskId && (!scope || old.scope === scope)) return { task_id: old.taskId, id: old.taskId };
    throw blocked(old);
  }
  const record: Record<string, any> = { id, identity, requestPath, scope, model: body?.model, status: 'submitting', createdAt: new Date().toISOString() };
  try { await handle.writeFile(JSON.stringify(record)); } finally { await handle.close(); }
  try {
    const result = await relayRequest(config, requestPath, { method: 'POST', body, signal });
    const taskId = extractTaskId(result);
    if (!taskId) throw new Error('提交响应缺少任务 ID');
    record.taskId = taskId; record.status = 'created';
    await save(file, record); // 先持久化，再交回调用者写业务断点。
    return result;
  } catch (error) {
    // 明确的参数、额度、鉴权和内容拒绝没有创建任务；5xx/超时/断网均按未知处理。
    if (error?.code === 'request_too_large') { await rm(file, { force: true }); throw error; }
    if (error?.status >= 400 && error.status < 500 && error.status !== 408) {
      await rm(file, { force: true }); throw error;
    }
    record.status = 'uncertain';
    await save(file, record).catch(() => {});
    throw blocked(record);
  }
}
export async function finishSubmission(config, requestPath, body) {
  const id = hash(JSON.stringify([submissionIdentity(config), requestPath, body]));
  await rm(path.join(directory(), `${id}.json`), { force: true });
}
export async function finishKnownTask(config, taskId) {
  const identity = submissionIdentity(config);
  for (const name of await readdir(directory()).catch(error => { if (error.code === 'ENOENT') return []; throw error; })) {
    if (!/^[a-f0-9]{64}\.json$/.test(name)) continue;
    const file = path.join(directory(), name);
    const raw = await readFile(file, 'utf8').catch(error => { if (error.code === 'ENOENT') return null; throw error; });
    if (raw === null) continue;
    const record = JSON.parse(raw);
    if (record.identity === identity && record.taskId === taskId && record.status === 'created') await rm(file, { force: true });
  }
}
export async function readSubmission(id) {
  if (!/^[a-f0-9]{64}$/.test(String(id))) throw new Error('提交记录 ID 格式不正确。');
  const record = JSON.parse(await readFile(path.join(directory(), `${id}.json`), 'utf8'));
  if (record.id !== id) throw new Error('提交记录损坏，已停止。');
  return record;
}
export async function reconcileSubmission(config, id, taskId, confirmedNotCreated) {
  const record = await readSubmission(id);
  if (/\/tasks\/doubao$/.test(record.requestPath)) config = imageConfig(config);
  if (record.identity !== submissionIdentity(config)) throw new Error('请恢复原接入方式、地址和 API密钥后核对提交。');
  const file = path.join(directory(), `${id}.json`);
  // 防止运行中的提交被另一工具解锁；进程崩溃残留需等请求超时预算过去。
  if (record.status === 'submitting' && Date.now() - Date.parse(record.createdAt) < 150000) throw new Error('原提交仍可能正在执行，请等待其返回后再核对。');
  if (taskId) {
    const image = /\/tasks\/doubao$/.test(record.requestPath);
    const queryPath = image ? record.requestPath.replace(/\/doubao$/, '') + '/' + encodeURIComponent(taskId)
      : (await import('./connection.js')).resolveQueryPath(config, taskId);
    await relayRequest(config, queryPath); // 确认原渠道能查询此任务，不创建新任务。
    record.taskId = taskId; record.status = 'created';
    await save(file, record);
    return { submissionId: id, taskId, status: 'linked' };
  }
  if (record.taskId) throw new Error('此记录已有明确任务 ID，请先查询原任务，不能按未创建解锁。');
  if (confirmedNotCreated !== true) throw new Error('必须提供原任务 ID，或由用户在渠道侧核对并明确确认未创建。');
  await rm(file);
  return { submissionId: id, status: 'unlocked', note: '仅解除本机防重，未提交新任务；下一次生成仍需费用确认。' };
}
