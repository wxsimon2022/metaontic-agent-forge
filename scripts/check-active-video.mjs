/** 构建/热替换前只读检查宿主的视频执行记录；不停止任务或清理记录。 */
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import * as zlib from 'node:zlib';
import { execFileSync } from 'node:child_process';
const home = process.env.DSH_HOME || path.join(os.homedir(), '.dsh');
const states = new Map();
function scan(value) {
  if (Array.isArray(value)) { for (const item of value) scan(item); return; }
  if (!value || typeof value !== 'object') return;
  if (value.callId && ['start', 'end'].includes(value.phase)) states.set(value.callId, value.phase);
  for (const item of Object.values(value)) scan(item);
}
async function walk(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true }).catch(error => {
    if (error.code === 'ENOENT') return [];
    throw error;
  })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) await walk(file);
    else if (entry.name.endsWith('.jsonl') || entry.name.endsWith('.jsonl.zstd')) {
      let content = await readFile(file);
      if (entry.name.endsWith('.zstd')) {
        if (typeof zlib.zstdDecompressSync === 'function') {
          // 宿主追加多个独立帧；只解第一帧会遗漏之后的执行事件。
          const frames = [];
          while (content.length) {
            const result = zlib.zstdDecompressSync(content, { info: true });
            if (!(result.engine.bytesWritten > 0)) throw new Error('无法读取压缩会话帧');
            frames.push(result.buffer);
            content = content.subarray(result.engine.bytesWritten);
          }
          content = Buffer.concat(frames);
        } else {
          try { content = execFileSync('zstd', ['-dc', file], { maxBuffer: 256 * 1024 * 1024 }); }
          catch { throw new Error('无法检查压缩会话；请使用宿主 Node 24 或安装了 zstd 的环境运行检查，不得跳过活动任务核对。'); }
        }
      }
      for (const line of content.toString('utf8').split('\n')) {
        if (!line.includes('plugin:metaontic-agent-forge/execution') && !line.includes('plugin:metaontic-video/execution')) continue;
        try { scan(JSON.parse(line)); }
        catch { throw new Error(`无法解析视频执行记录：${file}；请先核对任务状态。`); }
      }
    }
  }
}
await walk(path.join(home, 'sessions'));
const active = [...states.values()].filter(value => value === 'start').length;
console.log(`未闭合视频执行记录：${active}`);
if (active) { console.error('先核对任务是否执行中；任务结束前不构建或热替换。'); process.exitCode = 2; }
