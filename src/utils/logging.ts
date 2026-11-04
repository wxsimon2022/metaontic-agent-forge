/** utils/logging：从宿主入口拆出的独立职责模块。 */
import { AsyncLocalStorage } from 'node:async_hooks';
import path from 'node:path';
import { dshHome } from '../media/references.js';
import { mkdir, appendFile } from 'node:fs/promises';
import { PLUGIN_VERSION } from '../config.js';

/** 日志仅包含白名单字段；每日一个JSONL文件，不写请求体、鉴权头或输出URL。 */
export const requestLogContext = new AsyncLocalStorage<Record<string, unknown>>();

function requestLogPath() {
  const now = new Date();
  const date = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  return path.join(dshHome(), 'logs', 'metaontic-video', date, 'requests.jsonl');
}

/**
 * 日志是逐段、逐阶段写入的热路径：目录按天固定，建过一次就不用再 mkdir（省掉一半系统调用）。
 * 只记住「已经建好」的目录；建失败时不记，下一次还会重试。
 */
const preparedDirs = new Set<string>();

async function ensureLogDir(dir: string) {
  if (preparedDirs.has(dir)) return;
  await mkdir(dir, { recursive: true, mode: 0o700 });
  // 一天一个目录，兜底上限免得长驻进程把集合撑大。
  if (preparedDirs.size > 32) preparedDirs.clear();
  preparedDirs.add(dir);
}

export async function appendRequestLog(record) {
  try {
    const file = requestLogPath();
    await ensureLogDir(path.dirname(file));
    await appendFile(file, JSON.stringify({ time: new Date().toISOString(), pluginVersion: PLUGIN_VERSION, ...requestLogContext.getStore(), ...record }) + '\n', { mode: 0o600 });
  } catch {
    // 日志不可写不能改变生成结果，也不能因此重提付费请求。
  }
}
