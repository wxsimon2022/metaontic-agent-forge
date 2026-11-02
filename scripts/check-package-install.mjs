/** Cross-platform release smoke test. No paid API calls or real Harness profile writes. */
import assert from 'node:assert/strict';
import { gunzipSync, gzipSync } from 'node:zlib';
import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, writeFile, readFile, readdir, realpath, copyFile, rename, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const archive = path.resolve(process.argv[2] || '');
assert.ok(archive.endsWith('.tgz'), 'Pass the built .tgz package');
const cli = process.env.PNPM_CLI || path.join(execFileSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['root', '-g'], { encoding: 'utf8', shell: process.platform === 'win32' }).trim(), 'pnpm/bin/pnpm.cjs');
const temp = await mkdtemp(path.join(tmpdir(), 'MetaOntic 安装 测试 '));
try {
  const profile = path.join(temp, '插件 profile');
  const downloaded = path.join(temp, '安装文件 package.tgz');
  await mkdir(profile);
  await copyFile(archive, downloaded);
  await writeFile(path.join(profile, 'package.json'), '{"private":true}');
  await writeFile(path.join(profile, 'pnpm-workspace.yaml'), 'nodeLinker: hoisted\nstrictDepBuilds: true\n');
  // Build an older package fixture from the same archive, changing only manifest
  // version. Exercise an actual managed-package upgrade, not just a fresh add.
  const raw = gunzipSync(await readFile(downloaded));
  const chunks = []; let changed = false;
  for (let offset = 0; offset + 512 <= raw.length;) {
    const header = Buffer.from(raw.subarray(offset, offset + 512));
    if (header.every(byte => byte === 0)) break;
    const name = header.subarray(0, 100).toString().replace(/\0.*$/, '');
    const size = parseInt(header.subarray(124, 136).toString().replace(/\0.*$/, '').trim() || '0', 8);
    let body = Buffer.from(raw.subarray(offset + 512, offset + 512 + size));
    offset += 512 + Math.ceil(size / 512) * 512;
    if (name === 'package/package.json') {
      const previous = JSON.parse(body.toString()); previous.version = '0.0.0';
      body = Buffer.from(JSON.stringify(previous)); changed = true;
      header.write(body.length.toString(8).padStart(11, '0') + '\0', 124, 12, 'ascii');
      header.fill(32, 148, 156);
      const checksum = header.reduce((sum, byte) => sum + byte, 0);
      header.write(checksum.toString(8).padStart(6, '0') + '\0 ', 148, 8, 'ascii');
    }
    chunks.push(header, body, Buffer.alloc((512 - body.length % 512) % 512));
  }
  assert.ok(changed, 'Fixture manifest was found');
  chunks.push(Buffer.alloc(1024));
  const previousArchive = path.join(temp, 'previous package.tgz');
  const previousBytes = gzipSync(Buffer.concat(chunks));
  await writeFile(previousArchive, previousBytes);
  const runInstall = file => execFileSync(process.execPath, [cli, '--dir', profile, 'add', file,
    `--config.store-dir=${path.join(temp, 'store')}`, `--config.cache-dir=${path.join(temp, 'cache')}`], { encoding: 'utf8', timeout: 120000 });
  console.log(runInstall(previousArchive));
  const settingsFile = path.join(profile, 'cordis.patch.yml');
  const taskFile = path.join(profile, 'saved-task.json');
  await writeFile(settingsFile, '# preserve existing settings sentinel\n');
  await writeFile(taskFile, '{"task_id":"existing-task-do-not-resubmit"}');
  assert.equal(JSON.parse(await readFile(path.join(profile, 'node_modules/metaontic-video/package.json'), 'utf8')).version, '0.0.0');
  console.log(runInstall(downloaded));
  assert.deepEqual(await readFile(previousArchive), previousBytes, 'Update must preserve the original installation file');
  assert.equal(await readFile(settingsFile, 'utf8'), '# preserve existing settings sentinel\n');
  assert.equal(await readFile(taskFile, 'utf8'), '{"task_id":"existing-task-do-not-resubmit"}');
  const installed = path.join(profile, 'node_modules/metaontic-video');
  const relative = path.relative(await realpath(profile), await realpath(installed));
  assert.ok(relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative), 'Installed files must be managed inside the profile');
  // Once installed, moving the source must not break metadata or loading.
  await rename(downloaded, `${downloaded}.saved`);
  const pkg = JSON.parse(await readFile(path.join(installed, 'package.json'), 'utf8'));
  assert.deepEqual(pkg.dependencies || {}, {}, 'No extra runtime npm dependencies');
  const locales = await readdir(path.join(installed, 'locale'));
  for (const locale of ['en.json', 'zh.json']) {
    assert.ok(locales.includes(locale), `Missing locale/${locale}`);
    const parsed = JSON.parse(await readFile(path.join(installed, 'locale', locale), 'utf8'));
    assert.ok(parsed.meta?.title, `Missing ${locale} metadata title`);
  }
  for (const file of ['index.js', 'client.js', 'cordis.patch.yml', 'MetaOnticVideo使用说明书.md', 'MetaOnticVideo使用说明书.pdf']) {
    assert.ok((await readFile(path.join(installed, file))).length, `Missing ${file}`);
  }
  assert.ok((await readdir(path.join(installed, 'skills'))).length);
  const plugin = await import(pathToFileURL(path.join(installed, 'index.js')).href);
  assert.equal(typeof plugin.apply, 'function');
  assert.ok(plugin.Config);
  console.log(`PASS ${process.platform}: strict package installation and upgrade, settings/tasks preserved, Unicode/spaces, locale metadata, resources, source relocation and entry import (${pkg.version})`);
} finally {
  await rm(temp, { recursive: true, force: true });
}
