/**
 * internal/update-lockfile：安装目录锁文件自愈。
 *
 * pnpm 11 在安装前会用供应链策略校验整份 pnpm-lock.yaml，只要有「远程 tgz 但缺 integrity」的记录，
 * 整次安装就直接失败（ERR_PNPM_MISSING_TARBALL_INTEGRITY）：换镜像地址、换版本号都一样，
 * 只有删掉那条记录才能继续。这里在插件加载时和之后定期检查，只清掉本插件自己那些缺
 * integrity 的记录，其他依赖的锁定版本保持不动；清理前先留一份备份。
 *
 * 判定不只看「packages 里那条缺 integrity」：旧版本留下的、已经没人引用的残记录同样会让校验失败，
 * 所以按「本插件所有远程记录里哪些拿不出合法 sha 校验值」来判定；profile 根、下级目录与同级 staging
 * 目录里的锁文件都看，加载时查一次、之后每 2 秒复查。
 */
import { existsSync, readdirSync, readFileSync, renameSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PACKAGE_NAME = 'metaontic-video';
const LOCKFILE = 'pnpm-lock.yaml';
/** 本插件成品包的发布地址；这类记录必须能验签，否则 pnpm 会拒绝整次安装。 */
const RELEASE_URL = /^https?:\/\/(?:gitee\.com\/hackloop|github\.com\/wxsimon2022)\/metaontic-video\/releases\/download\//i;
/** 真正的校验值形如 sha512-xxxx；null、空值和缺字段都算不可校验。 */
const SHA = /^sha\d+-[A-Za-z0-9+/=]+$/;
const indentOf = (line) => line.length - line.trimStart().length;

/** 块里的 integrity 值（含 resolution 单行内联写法）。 */
function integrityOf(block) {
  const match = /integrity:\s*([^,\s}]+)/.exec(block);
  return match ? match[1] : '';
}

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
 * 删掉本插件「远程 tgz 但校验值不可用」的记录，连同 importers 里对应的声明。
 *
 * 判定按整份文件看：本插件所有远程记录里，凡是拿到合法 sha 校验值的才算正常；
 * 剩下的（packages 里只有 tarball、snapshots 里只留了半条、integrity 写成 null）全部算坏记录，
 * 这样即使之前只删掉了 packages 那条、snapshots 还留着，也不会再卡住下一次安装。
 * 返回清理后的文本与删掉的键；没有要清理的返回原文本。
 */
export function stripUnverifiableEntries(text) {
  const newline = text.includes('\r\n') ? '\r\n' : '\n';
  const lines = text.split(/\r?\n/);
  const ours = new Set();
  const verified = new Set();
  for (let index = 0; index < lines.length; index += 1) {
    const entry = remoteEntry(lines[index]);
    if (!entry || entry.name !== PACKAGE_NAME) continue;
    const end = blockEnd(lines, index, 2);
    const block = lines.slice(index, end).join('\n');
    // 只处理远程 tgz 记录：键本身是发布地址，或块里带了 tarball 地址；本机 link:/file: 记录不动。
    if (!RELEASE_URL.test(entry.url) && !/tarball:\s*https?:\/\//.test(block)) continue;
    ours.add(entry.url);
    if (SHA.test(integrityOf(block))) verified.add(entry.url);
  }
  const poisoned = new Set([...ours].filter((url) => !verified.has(url)));
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
function repairLockfileAt(lockfile, log: (message: string) => void = () => {}) {
  if (!existsSync(lockfile)) return { status: 'unavailable' };
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

export function repairUpdateLockfile(moduleUrl, log: (message: string) => void = () => {}) {
  const dir = locateProfileDir(moduleUrl);
  if (!existsSync(path.join(dir, 'package.json'))) return { status: 'unavailable' };
  return repairLockfileAt(path.join(dir, LOCKFILE), log);
}

/**
 * profile 根和下面两层目录里的所有 pnpm-lock.yaml。
 * 安装器会把新版本装进 staging 一类的子目录，那边也会留下同样的坏记录，所以一起扫。
 */
export function locateLockfiles(dir: string, depth = 2): string[] {
  const found: string[] = [];
  const walk = (current: string, level: number) => {
    const candidate = path.join(current, LOCKFILE);
    try { if (existsSync(candidate)) found.push(candidate); } catch {}
    if (level <= 0) return;
    let entries = [];
    try { entries = readdirSync(current, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name === 'node_modules') continue;
      walk(path.join(current, entry.name), level - 1);
    }
  };
  walk(dir, depth);
  return found;
}

/**
 * 与当前 profile 同级的 staging 目录里的锁文件。
 * 宿主换 profile（或某些版本装新插件）时会先建 `.<名字>.staging-*` 这类临时目录，
 * 那里往往是整份 profile 的副本，同样会带着本插件那条坏记录，所以一起扫。
 */
export function locateStagingLockfiles(profileDir: string): string[] {
  const parent = path.dirname(profileDir);
  let entries = [];
  try { entries = readdirSync(parent, { withFileTypes: true }); } catch { return []; }
  const found: string[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || !/staging/i.test(entry.name)) continue;
    const dir = path.join(parent, entry.name);
    if (dir === profileDir) continue;
    found.push(...locateLockfiles(dir, 1));
  }
  return found;
}

/** 要看住的全部锁文件：profile 根及下面两层，加上同级的 staging 目录。 */
export function updateLockfilesToWatch(profileDir: string): string[] {
  return [...new Set([...locateLockfiles(profileDir), ...locateStagingLockfiles(profileDir)])];
}

/** 加载时检查一次，之后每 2 秒看一次（只 stat；锁文件一变就立刻清，用户不用守着秒表）。 */
export function startUpdateLockfileRepair(moduleUrl: string, intervalMs = 2000, log?: (message: string) => void) {
  let stopped = false;
  const stamps = new Map<string, string>();
  const check = () => {
    if (stopped) return;
    try {
      const dir = locateProfileDir(moduleUrl);
      if (!existsSync(path.join(dir, 'package.json'))) return;
      for (const lockfile of updateLockfilesToWatch(dir)) {
        let stamp = '';
        try { const info = statSync(lockfile); stamp = info.mtimeMs + ':' + info.size; }
        catch { continue; }
        if (stamps.get(lockfile) === stamp) continue;
        stamps.set(lockfile, stamp);
        repairLockfileAt(lockfile, log);
      }
    } catch {
      // 检查失败不影响插件其他功能
    }
  };
  check();
  const timer = setInterval(check, intervalMs);
  if (timer.unref) timer.unref();
  return () => { stopped = true; clearInterval(timer); };
}
