/**
 * internal/update-lockfile：安装目录锁文件自愈。
 *
 * pnpm 11 在安装前会用供应链策略校验整份 pnpm-lock.yaml，只要有「远程 tgz 但缺 integrity」的记录，
 * 整次安装就直接失败（ERR_PNPM_MISSING_TARBALL_INTEGRITY）：换镜像地址、换版本号都一样，
 * 只有删掉那条记录才能继续。这里在插件加载时和之后定期检查，只清掉本插件自己那些缺
 * integrity 的记录，其他依赖的锁定版本保持不动；清理前先留一份备份。
 */
import { existsSync, readFileSync, renameSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PACKAGE_NAME = 'metaontic-video';
const LOCKFILE = 'pnpm-lock.yaml';
const indentOf = (line) => line.length - line.trimStart().length;

/** 远程 tgz 的 packages/snapshots 键，例如 metaontic-video@https://host/path.tgz（缩进两级）。 */
function remoteEntry(line) {
  const match = /^ {2}(\S+)@(https?:\/\/\S+?):(?:\s.*)?$/.exec(line);
  return match ? { name: match[1], url: match[2] } : null;
}

/** 块从 start 行开始，到下一个同级或更顶层的键为止（空行跟着块一起走）。 */
function blockEnd(lines, start, indent) {
  let end = start + 1;
  while (end < lines.length) {
    const line = lines[end];
    if (!line.trim()) { end += 1; continue; }
    if (indentOf(line) <= indent) break;
    end += 1;
  }
  return end;
}

/**
 * 删掉「本插件 + 远程 tgz + 没有 integrity」的记录，连同 importers 里对应的声明。
 * 先找出坏的 URL（packages 里的 resolution 只有 tarball、没有 integrity），再把同名的
 * packages/snapshots 条目一起清掉——snapshots 那条自己不带 resolution，只能靠 URL 对上。
 * 返回清理后的文本与删掉的键；没有要清理的返回原文本。
 */
export function stripUnverifiableEntries(text) {
  const newline = text.includes('\r\n') ? '\r\n' : '\n';
  const lines = text.split(/\r?\n/);
  const poisoned = new Set();
  for (let index = 0; index < lines.length; index += 1) {
    const entry = remoteEntry(lines[index]);
    if (!entry || entry.name !== PACKAGE_NAME) continue;
    const end = blockEnd(lines, index, 2);
    const resolution = lines.slice(index + 1, end).find((line) => /^\s+resolution:/.test(line)) || '';
    // 有 integrity 的记录是正常的锁定条目，不能动；只清理缺校验值的那种。
    if (/tarball:\s*https?:\/\//.test(resolution) && !/integrity:/.test(resolution)) poisoned.add(entry.url);
  }
  if (!poisoned.size) return { text, removed: [] };
  const removed = new Set();
  for (let index = 0; index < lines.length; index += 1) {
    const entry = remoteEntry(lines[index]);
    if (!entry || entry.name !== PACKAGE_NAME || !poisoned.has(entry.url)) continue;
    const end = blockEnd(lines, index, 2);
    removed.add(entry.name + '@' + entry.url);
    lines.splice(index, end - index);
    index -= 1;
  }
  for (let index = 0; index < lines.length; index += 1) {
    if (!/^ {6}metaontic-video:\s*$/.test(lines[index])) continue;
    const specifier = (/^\s+specifier:\s*(\S+)\s*$/.exec(lines[index + 1] || '') || [])[1]
      || (/^\s+version:\s*(\S+)\s*$/.exec(lines[index + 2] || '') || [])[1]
      || '';
    if (!poisoned.has(specifier)) continue;
    lines.splice(index, blockEnd(lines, index, 6) - index);
    index -= 1;
  }
  return { text: lines.join(newline), removed: [...removed] };
}

/** 插件安装目录里的 profile 根：<profile>/node_modules/metaontic-video/index.js 往上三级。 */
export function locateProfileDir(moduleUrl) {
  let dir = fileURLToPath(moduleUrl);
  for (let up = 0; up < 3; up += 1) dir = path.dirname(dir);
  return dir;
}

/**
 * 清理安装目录锁文件里本插件那些缺 integrity 的远程记录。
 * 找不到 profile（源码方式运行）或锁文件正常时什么都不做。
 */
export function repairUpdateLockfile(moduleUrl, log: (message: string) => void = () => {}) {
  const dir = locateProfileDir(moduleUrl);
  const lockfile = path.join(dir, LOCKFILE);
  if (!existsSync(lockfile) || !existsSync(path.join(dir, 'package.json'))) return { status: 'unavailable' };
  let before = '';
  try { before = readFileSync(lockfile, 'utf8'); }
  catch { return { status: 'unavailable' }; }
  const { text, removed } = stripUnverifiableEntries(before);
  if (!removed.length) return { status: 'clean', lockfile };
  const backup = lockfile + '.metaontic-backup-' + new Date().toISOString().replace(/[:.]/g, '-');
  const temporary = lockfile + '.metaontic-' + process.pid + '.tmp';
  try {
    writeFileSync(backup, before);
    writeFileSync(temporary, text);
    renameSync(temporary, lockfile);
  } catch (error) {
    try { if (existsSync(temporary)) unlinkSync(temporary); } catch {}
    return { status: 'failed', message: (error && error.message) || String(error) };
  }
  log('已清理 ' + removed.length + ' 条缺少 integrity 的锁文件记录（' + removed.join('、') + '），备份在 ' + path.basename(backup) + '；之后可以在线更新。');
  return { status: 'repaired', lockfile, backup, removed };
}

/** 加载时检查一次，之后每 10 秒看一次（锁文件被改坏时用户等一下就能重新点更新）。 */
export function startUpdateLockfileRepair(moduleUrl: string, intervalMs = 10000, log?: (message: string) => void) {
  let stopped = false;
  let last = '';
  const check = () => {
    if (stopped) return;
    try {
      const lockfile = path.join(locateProfileDir(moduleUrl), LOCKFILE);
      if (!existsSync(lockfile)) return;
      const info = statSync(lockfile);
      const stamp = info.mtimeMs + ':' + info.size;
      if (stamp === last) return;
      last = stamp;
      repairUpdateLockfile(moduleUrl, log);
    } catch {
      // 检查失败不影响插件其他功能
    }
  };
  check();
  const timer = setInterval(check, intervalMs);
  if (timer.unref) timer.unref();
  return () => { stopped = true; clearInterval(timer); };
}
