/** Cross-platform release smoke test. No paid API calls or real Harness profile writes. */
import assert from 'node:assert/strict';
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
  const output = execFileSync(process.execPath, [cli, '--dir', profile, 'add', downloaded,
    `--config.store-dir=${path.join(temp, 'store')}`, `--config.cache-dir=${path.join(temp, 'cache')}`], { encoding: 'utf8', timeout: 120000 });
  console.log(output);
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
  console.log(`PASS ${process.platform}: strict package installation, Unicode/spaces, locale metadata, resources, source relocation and entry import (${pkg.version})`);
} finally {
  await rm(temp, { recursive: true, force: true });
}
