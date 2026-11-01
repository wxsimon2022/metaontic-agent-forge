import { readFileSync } from 'node:fs';
export function validateRelease(pkg) {
  const match = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.exec(pkg.version || '');
  if (!match || pkg.releaseNotes?.version !== pkg.version) throw new Error('发布版本与 releaseNotes 不一致或版本格式无效。');
  if (pkg.releaseNotes?.prerelease === true) throw new Error('仅发布正式版，不能标记为预发布。');
}
if (process.argv[1]?.endsWith('/validate-release.mjs')) validateRelease(JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')));
