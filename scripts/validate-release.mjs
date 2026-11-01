import { readFileSync } from 'node:fs';
export function validateRelease(pkg) {
  const match = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-beta\.([1-9]\d*))?$/.exec(pkg.version || '');
  if (!match || pkg.releaseNotes?.version !== pkg.version) throw new Error('发布版本与 releaseNotes 不一致或版本格式无效。');
  if (Boolean(match[4]) !== (pkg.releaseNotes?.prerelease === true)) throw new Error('beta 版本必须标记 prerelease:true，正式版必须取消预发布标记。');
}
if (process.argv[1]?.endsWith('/validate-release.mjs')) validateRelease(JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')));
