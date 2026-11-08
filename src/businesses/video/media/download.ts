/** media/download：从宿主入口拆出的独立职责模块。 */
import { type RunOptions } from '../providers/types.js';
import { mkdir, rename, rm } from 'node:fs/promises';
import path from 'node:path';
import { uniqueSuffix } from '../utils/files.js';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import { createWriteStream } from 'node:fs';
import { abortError } from '../utils/errors.js';

/** 单段下载的超时（毫秒）：成片也就几十 MB，卡住的连接不该一直挂着。 */
const DOWNLOAD_TIMEOUT_MS = 15 * 60 * 1000;

export async function downloadFile(url: string, destPath: string, { signal }: RunOptions = {}) {
  await mkdir(path.dirname(destPath), { recursive: true });
  // 同名 dest 可能被并发下载（尤其是两次 resume 补同一段）：.part 必须带唯一尾巴，
  // 否则一个在写、另一个 rename 走，落盘的就是半截文件。
  const partial = `${destPath}.${uniqueSuffix('part')}`;
  const timeout = AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS);
  const requestSignal = signal ? AbortSignal.any([signal, timeout]) : timeout;
  try {
    const response = await fetch(url, { signal: requestSignal });
    if (!response.ok) {
      throw Object.assign(new Error(`下载分段失败（HTTP ${response.status}）：${url}`), {
        code: 'download_failed',
      });
    }
    if (!response.body) {
      throw Object.assign(new Error(`下载分段失败：响应没有内容（${url}）。`), {
        code: 'download_failed',
      });
    }
    await pipeline(Readable.fromWeb(response.body as any), createWriteStream(partial));
    await rename(partial, destPath);
    return destPath;
  } catch (error) {
    // 下载中断时清掉半截文件，别在分段目录里留下 *.part
    await rm(partial, { force: true }).catch(() => {});
    if (error?.code === 'download_failed') throw error;
    if (signal?.aborted) throw abortError();
    throw Object.assign(new Error(`下载分段失败：${error?.message || error}（${url}）`), {
      code: 'download_failed',
    });
  }
}
