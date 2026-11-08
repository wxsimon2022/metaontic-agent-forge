import './no-network-analytics.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { existsSync, readdirSync, readFileSync, renameSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import os from 'node:os';
import path from 'node:path';
import { sourceOf } from './source.mjs';

function load() {
  const source = sourceOf('core/installation/update-lockfile');
  return vm.runInNewContext(source + '\n({ stripUnverifiableEntries, locateProfileDir, locateLockfiles, locateStagingLockfiles, updateLockfilesToWatch, repairUpdateLockfile, startUpdateLockfileRepair })', {
    path, fileURLToPath, existsSync, readdirSync, readFileSync, writeFileSync, renameSync, statSync, unlinkSync,
    setInterval, clearInterval, process,
  });
}

const { stripUnverifiableEntries, locateProfileDir, locateLockfiles, locateStagingLockfiles, updateLockfilesToWatch, repairUpdateLockfile, startUpdateLockfileRepair } = load();
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

test('只删掉 packages 那条、snapshots 还留着半条时也能清干净', () => {
  const before = `lockfileVersion: '9.0'

importers:

  .:
    dependencies:
      metaontic-video:
        specifier: ${URL_NEW}
        version: ${URL_NEW}

packages:

  other-plugin@https://example.com/other-1.0.0.tgz:
    resolution: {tarball: https://example.com/other-1.0.0.tgz}

snapshots:

  metaontic-video@${URL_NEW}: {}
  other-plugin@https://example.com/other-1.0.0.tgz: {}
`;
  const { text, removed } = stripUnverifiableEntries(before);
  assert.deepEqual([...removed], [`metaontic-video@${URL_NEW}`]);
  assert.doesNotMatch(text, /metaontic-video/);
  assert.match(text, /other-plugin@https:\/\/example\.com\/other-1\.0\.0\.tgz/);
});

test('integrity 写成 null 或空值同样算不可校验', () => {
  for (const resolution of ['{integrity: null, tarball: %URL%}', '{integrity: "", tarball: %URL%}']) {
    const before = lockfile(url => resolution.replace('%URL%', url));
    const { text, removed } = stripUnverifiableEntries(before);
    assert.equal(removed.length, 1);
    assert.doesNotMatch(text, /metaontic-video/);
  }
});

test('profile 下 staging 子目录里的锁文件也在扫描范围内', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'meta-profile-'));
  await writeFile(path.join(root, 'package.json'), '{"name":"desktop"}\n');
  const staging = path.join(root, '.plugin-manager', 'staging');
  await mkdir(staging, { recursive: true });
  await writeFile(path.join(staging, 'pnpm-lock.yaml'), lockfile(url => `{tarball: ${url}}`));
  const found = Array.from(locateLockfiles(root), file => path.relative(root, file)).sort();
  assert.deepEqual(found, ['.plugin-manager/staging/pnpm-lock.yaml']);
  await rm(root, { recursive: true, force: true });
});

test('Windows 现场那种「旧版本残记录没人引用」也一样清掉，带校验值的那条保留', () => {
  // 复现的是真实失败：pnpm 校验整份锁文件的 entries，没人引用的旧记录同样让它拒绝安装。
  const before = `lockfileVersion: '9.0'

importers:

  .:
    dependencies:
      metaontic-video:
        specifier: ${URL_NEW}
        version: ${URL_NEW}

packages:

  metaontic-video@${URL_NEW}:
    resolution: {integrity: sha512-CCC=, tarball: ${URL_NEW}}
    version: 3.13.11

  metaontic-video@https://gitee.com/hackloop/metaontic-video/releases/download/v3.13.12/metaontic-video-3.13.12.tgz:
    resolution: {tarball: https://gitee.com/hackloop/metaontic-video/releases/download/v3.13.12/metaontic-video-3.13.12.tgz}
    version: 3.13.12

snapshots:

  metaontic-video@${URL_NEW}: {}
  metaontic-video@https://gitee.com/hackloop/metaontic-video/releases/download/v3.13.12/metaontic-video-3.13.12.tgz: {}
`;
  const { text, removed } = stripUnverifiableEntries(before);
  assert.deepEqual([...removed], ['metaontic-video@https://gitee.com/hackloop/metaontic-video/releases/download/v3.13.12/metaontic-video-3.13.12.tgz']);
  assert.doesNotMatch(text, /3\.13\.12/);
  assert.match(text, /sha512-CCC=/);                              // 正常记录与 importers 声明都留着
  assert.match(text, new RegExp(`version: ${URL_NEW}`.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
});

test('同级 staging 目录（宿主换 profile 时的临时副本）里的锁文件同样纳入检查', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'meta-profiles-'));
  const profile = path.join(root, 'desktop');
  const staging = path.join(root, '.desktop.staging-abcd');
  await mkdir(path.join(profile, 'node_modules'), { recursive: true });
  await mkdir(staging, { recursive: true });
  await writeFile(path.join(staging, 'pnpm-lock.yaml'), lockfile(url => `{tarball: ${url}}`));
  try {
    assert.deepEqual(Array.from(locateStagingLockfiles(profile), file => path.relative(root, file)), ['.desktop.staging-abcd/pnpm-lock.yaml']);
    assert.deepEqual(Array.from(updateLockfilesToWatch(profile), file => path.relative(root, file)), ['.desktop.staging-abcd/pnpm-lock.yaml']);
    assert.deepEqual(Array.from(locateStagingLockfiles(staging).map(file => path.relative(root, file))), []);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
