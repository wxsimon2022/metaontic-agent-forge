/** utils/files：从宿主入口拆出的独立职责模块。 */
import path from 'node:path';
import { mkdir, stat } from 'node:fs/promises';
import { ref, DEFAULT_OUTPUT_DIR } from '../config.js';

/** 命令输出的末尾若干字符：安装日志很长，只留最后一截给用户看。 */
export function tail(text, limit = 600) {
  const clean = String(text || '').trim();
  return clean.length > limit ? `…${clean.slice(-limit)}` : clean;
}

export function formatSeconds(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return String(value ?? '');
  return Number.isInteger(number) ? String(number) : number.toFixed(1);
}

/**
 * 临时文件名用的唯一尾巴：进程号 + 自增序号 + 随机串。
 * 插件对宿主声明「并发安全」，同一个会话里可能同时跑多次调用（多镜并行、用户连点两次「继续」）；
 * 固定的临时名（`x.mp4.part`、`x.align1.mp4`、`x.work.mp4`）会让并发调用互相踩——
 * 一边还在写、另一边已经 rename/读取，拿到的就是半截文件。所有中间产物都带这个尾巴。
 */
let tempSequence = 0;

export function uniqueSuffix(prefix = 'tmp') {
  tempSequence = (tempSequence + 1) % 1000000000;
  return `${prefix}-${process.pid}-${tempSequence}-${Math.random().toString(36).slice(2, 8)}`;
}

export function fileStamp(date = new Date()) {
  const pad = (value) => String(value).padStart(2, '0');
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`
    + `-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

/**
 * 给这次生成占一个唯一的「时间戳」：它同时用作分段目录名和成片文件名前缀。
 * 光靠秒级时间戳会撞：工具是并发安全的、多镜也会并行发起，同一秒里的两次调用会
 * 写同一批分段文件、成片互相覆盖。
 * 用 `mkdir` 原子占位来确定唯一后缀，避免「先查后建」之间的竞态。
 */
export async function allocateStamp(outDir: string, base: string) {
  const parent = path.join(outDir, 'segments');
  await mkdir(parent, { recursive: true });
  for (let attempt = 1; attempt <= 100; attempt += 1) {
    const stamp = attempt === 1 ? base : `${base}-${attempt}`;
    const dir = path.join(parent, stamp);
    try {
      await mkdir(dir);
      return { stamp, segmentsDir: dir };
    } catch (error) {
      if (error?.code !== 'EEXIST') throw error;
    }
  }
  throw new Error(`无法在 ${parent} 下分配唯一的分段目录（同名太多）。`);
}

export async function exists(file) {
  try {
    await stat(file);
    return true;
  } catch {
    return false;
  }
}

/** 成片目录：配置优先，否则用会话工作目录下的 metaontic-video/。 */
export async function resolveOutputDir(config, exec, deps) {
  const configured = String(ref(config, 'outputDir', '')).trim();
  if (configured) return path.resolve(configured);
  let cwd = '';
  if (deps?.workdir && exec?.agent) {
    try {
      cwd = (await deps.workdir.ensure(exec.agent, exec.signal)) || '';
    } catch {
      cwd = '';
    }
  }
  return path.join(cwd || process.cwd(), DEFAULT_OUTPUT_DIR);
}
