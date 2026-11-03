import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { existsSync, readFileSync, renameSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import os from 'node:os';
import path from 'node:path';
import { sourceOf } from './source.mjs';

function load() {
  const source = sourceOf('internal/update-lockfile');
  return vm.runInNewContext(source + '\n({ stripUnverifiableEntries, locateProfileDir, repairUpdateLockfile, startUpdateLockfileRepair })', {
    path, fileURLToPath, existsSync, readFileSync, writeFileSync, renameSync, statSync, unlinkSync,
    setInterval, clearInterval, process,
  });
}

const { stripUnverifiableEntries, locateProfileDir, repairUpdateLockfile, startUpdateLockfileRepair } = load();
const URL_OLD = 'https://gitee.com/hackloop/metaontic-video/releases/download/v3.13.10/metaontic-video-3.13.10.tgz';
const URL_NEW = 'https://gitee.com/hackloop/metaontic-video/releases/download/v3.13.11/metaontic-video-3.13.11.tgz';

const lockfile = (resolutionOf, extra = '') => `lockfileVersion: '9.0'

settings:
  autoInstallPeers: true

importers:

  .:
    dependencies:
      metaontic-video:
        specifier: ${URL_OLD}
        version: ${URL_OLD}
${extra}
packages:

  metaontic-video@${URL_OLD}:
    resolution: ${resolutionOf(URL_OLD)}
    version: 3.13.10
    engines: {node: '>=20'}

  other-plugin@https://example.com/other-1.0.0.tgz:
    resolution: {tarball: https://example.com/other-1.0.0.tgz}
    version: 1.0.0

snapshots:

  metaontic-video@${URL_OLD}: {}
  other-plugin@https://example.com/other-1.0.0.tgz: {}
`;

test('缺少 integrity 的本插件记录被整条清掉，其他依赖原样保留', () => {
  const before = lockfile(url => `{tarball: ${url}}`);
  const { text, removed } = stripUnverifiableEntries(before);
  assert.deepEqual([...removed], [`metaontic-video@${URL_OLD}`]);   // vm 里的数组跨 realm，先拷回宿主数组再比
  assert.doesNotMatch(text, /metaontic-video/);
  assert.match(text, /other-plugin@https:\/\/example\.com\/other-1\.0\.0\.tgz/);   // 别人的坏记录不归我们管
  assert.match(text, /^lockfileVersion: '9\.0'$/m);
  assert.doesNotMatch(text, /\n\n\n/);                                            // 不留空档
});

test('带 integrity 的正常锁定条目一个字节都不动', () => {
  const before = lockfile(url => `{integrity: sha512-AAA=, tarball: ${url}}`);
  const { text, removed } = stripUnverifiableEntries(before);
  assert.deepEqual([...removed], []);
  assert.equal(text, before);
});

test('只清缺 integrity 的那条，另一条带 integrity 的版本记录保留', () => {
  const withOld = lockfile(url => `{tarball: ${url}}`) + `
  metaontic-video@${URL_NEW}:
    resolution: {integrity: sha512-BBB=, tarball: ${URL_NEW}}
    version: 3.13.11

snapshots:

  metaontic-video@${URL_NEW}: {}
`;
  const { text, removed } = stripUnverifiableEntries(withOld);
  assert.deepEqual([...removed], [`metaontic-video@${URL_OLD}`]);   // vm 里的数组跨 realm，先拷回宿主数组再比
  assert.doesNotMatch(text, new RegExp(URL_OLD.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(text, /metaontic-video@https:\/\/gitee\.com\/hackloop\/metaontic-video\/releases\/download\/v3\.13\.11/);
});

test('Windows 的 CRLF 锁文件保持同样的换行风格', () => {
  const before = lockfile(url => `{tarball: ${url}}`).replaceAll('\n', '\r\n');
  const { text, removed } = stripUnverifiableEntries(before);
  assert.equal(removed.length, 1);
  assert.ok(text.includes('\r\n'));
  assert.doesNotMatch(text, /[^\r]\n/);
});

test('profile 目录从插件安装路径往上三级推出，Windows 盘符同样适用', () => {
  assert.equal(locateProfileDir('file:///Users/name/.dsh/profiles/desktop/node_modules/metaontic-video/index.js'),
    path.normalize('/Users/name/.dsh/profiles/desktop'));
  // Windows 盘符在 macOS 上会被 fileURLToPath 认成 /C:/…，这里只核对往上三级这一步
  assert.equal(path.basename(locateProfileDir('file:///C:/Users/name/.dsh/profiles/desktop/node_modules/metaontic-video/index.js')),
    'desktop');
});

const profile = () => path.join(os.tmpdir(), 'metaontic-lockfile-test');

test('修复真实锁文件：清掉坏记录、留备份、再跑一次是 clean', async () => {
  const dir = profile();
  await rm(dir, { recursive: true, force: true });
  await mkdir(path.join(dir, 'node_modules', 'metaontic-video'), { recursive: true });
  await writeFile(path.join(dir, 'package.json'), '{"name":"dsh-profile-desktop","private":true}\n');
  await writeFile(path.join(dir, 'pnpm-lock.yaml'), lockfile(url => `{tarball: ${url}}`));
  const moduleUrl = new URL('index.js', `file://${dir}/node_modules/metaontic-video/`).href;
  try {
    const lines = [];
    const first = repairUpdateLockfile(moduleUrl, message => lines.push(message));
    assert.equal(first.status, 'repaired');
    assert.deepEqual([...first.removed], [`metaontic-video@${URL_OLD}`]);
    assert.equal(lines.length, 1);
    const saved = await readFile(path.join(dir, 'pnpm-lock.yaml'), 'utf8');
    assert.doesNotMatch(saved, /metaontic-video/);
    assert.match(saved, /other-plugin@/);
    const backups = (await readdir(dir)).filter(name => name.startsWith('pnpm-lock.yaml.metaontic-backup-'));
    assert.equal(backups.length, 1);
    assert.equal(await readFile(path.join(dir, backups[0]), 'utf8'), lockfile(url => `{tarball: ${url}}`));
    assert.deepEqual((await readdir(dir)).filter(name => name.endsWith('.tmp')), []);
    assert.equal(repairUpdateLockfile(moduleUrl).status, 'clean');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('源码方式运行（没有 profile 锁文件）时什么都不做', () => {
  assert.equal(repairUpdateLockfile('file:///repo/src/internal/update-lockfile.js').status, 'unavailable');
});

test('定期检查只认变化过的锁文件，dispose 后不再动手', async () => {
  const dir = profile();
  await rm(dir, { recursive: true, force: true });
  await mkdir(path.join(dir, 'node_modules', 'metaontic-video'), { recursive: true });
  await writeFile(path.join(dir, 'package.json'), '{"name":"dsh-profile-desktop","private":true}\n');
  const lockfilePath = path.join(dir, 'pnpm-lock.yaml');
  await writeFile(lockfilePath, lockfile(url => `{integrity: sha512-AAA=, tarball: ${url}}`));
  const moduleUrl = new URL('index.js', `file://${dir}/node_modules/metaontic-video/`).href;
  try {
    const stop = startUpdateLockfileRepair(moduleUrl, 20);
    await writeFile(lockfilePath, lockfile(url => `{tarball: ${url}}`));
    for (let tick = 0; tick < 100 && /metaontic-video/.test(await readFile(lockfilePath, 'utf8')); tick += 1) {
      await new Promise(resolve => setTimeout(resolve, 20));
    }
    assert.doesNotMatch(await readFile(lockfilePath, 'utf8'), /metaontic-video/);
    stop();
    await writeFile(lockfilePath, lockfile(url => `{tarball: ${url}}`));
    await new Promise(resolve => setTimeout(resolve, 80));
    assert.match(await readFile(lockfilePath, 'utf8'), /metaontic-video/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
