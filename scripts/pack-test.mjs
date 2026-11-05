/**
 * 测试包打包：把当前工作区打成不带 Release 的测试版 .tgz，推到域名供他人安装验证。
 *
 *   npm run pack:test -- 3.13.9-test.1              打包 → 上传 /test/ → 线上校验 → 打印安装地址
 *   npm run pack:test -- 3.13.9-test.1 --no-upload  只在本地出包
 *   npm run pack:test -- 3.13.9-test.1 --out /tmp/p 指定本地输出目录（默认 .local/test/<版本>）
 *
 * 只改包内版本号出成品，不提交、不打标签、不建 Release、不占用正式发布页；插件的更新检查
 * 只读两仓正式 Release 且过滤 draft/prerelease，所以测试包不会影响其他人的正式版。
 * 版本号必须带 -后缀（正式版 X.Y.Z 请走 npm run release）；核心号压在当前正式版之下，
 * 测试者以后能照常收到正式版的更新提示。打包结束后 package.json 与构建产物会还原成正式版本。
 *
 * 上传配置（可用环境变量覆盖）：
 *   PACK_TEST_SERVER  默认 root@124.223.72.223
 *   PACK_TEST_DIR     默认 /home/biu/video-test
 *   PACK_TEST_URL     默认 https://video.mybfs.cn/test
 * 线上 /test/ 由 moyubang 仓库 deploy/nginx/video.mybfs.cn.conf 提供，目录刻意放在代码部署
 * 目录之外，deploy.sh 的 rsync --delete 不会删掉已上传的测试包。
 */
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(root);

const TEST_VERSION = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)-[0-9A-Za-z][0-9A-Za-z.-]*$/;
const argv = process.argv.slice(2);
const version = (argv[0] || '').trim();
const noUpload = argv.includes('--no-upload');
const outIndex = argv.indexOf('--out');
const out = path.resolve(outIndex >= 0 && argv[outIndex + 1] ? argv[outIndex + 1] : `.local/test/${version}`);
const server = process.env.PACK_TEST_SERVER || 'root@124.223.72.223';
const remoteDir = process.env.PACK_TEST_DIR || '/home/biu/video-test';
const urlBase = (process.env.PACK_TEST_URL || 'https://video.mybfs.cn/test').replace(/\/+$/, '');
const digest = (buffer) => createHash('sha256').update(buffer).digest('hex');

if (!TEST_VERSION.test(version)) {
  console.error('发布停止：测试版版本号形如 3.13.9-test.1（必须带 -后缀的预发布形式；正式版请用 npm run release）');
  process.exitCode = 1;
} else {
  const run = (command, args, options = {}) => {
    const result = spawnSync(command, args, { cwd: root, encoding: 'utf8', stdio: options.capture ? 'pipe' : 'inherit', shell: false });
    if (result.error || result.status !== 0) throw Error(`${command} ${args.join(' ')} 失败（${result.status ?? result.error?.code}）`);
    return options.capture ? result.stdout.trim() : '';
  };
  const git = (...args) => run('git', args, { capture: true });
  const hasTool = (tool) => {
    const probe = spawnSync(tool, ['--version'], { encoding: 'utf8', stdio: 'pipe', shell: false });
    return !probe.error && probe.status === 0;
  };
  const beforeStatus = git('status', '--porcelain');
  const beforePackage = readFileSync('package.json', 'utf8');
  const original = JSON.parse(beforePackage);
  const pkg = JSON.parse(beforePackage);
  pkg.version = version;
  pkg.releaseNotes = { ...(pkg.releaseNotes || {}), version, prerelease: false };
  const lockPath = 'package-lock.json';
  const beforeLock = existsSync(lockPath) ? readFileSync(lockPath, 'utf8') : undefined;

  const restore = () => {
    writeFileSync('package.json', beforePackage);
    if (beforeLock !== undefined) writeFileSync(lockPath, beforeLock);
    run(process.execPath, ['scripts/build.mjs']);
    if (readFileSync('package.json', 'utf8') !== beforePackage) throw Error('package.json 未还原，请检查');
    for (const file of ['package.json', 'package-lock.json', 'index.js', 'client.js']) {
      if (existsSync(file) && readFileSync(file, 'utf8').includes(version)) throw Error(`${file} 仍残留测试版版本号 ${version}`);
    }
    // 构建产物会内嵌 package.json（脚本清单等），因此只提示工作区差异，不据此判失败
    const afterStatus = git('status', '--porcelain');
    if (afterStatus !== beforeStatus) console.log(`\n提示：打包后工作区状态与打包前不同，请确认符合预期：\n${afterStatus || '（干净）'}`);
  };

  try {
    console.log(`测试版 ${version}（正式版 ${original.version}），提交 ${git('rev-parse', '--short', 'HEAD')}`);
    const dirty = beforeStatus.split('\n').filter(Boolean);
    if (dirty.length) console.log(`注意：工作区有 ${dirty.length} 处未提交改动，本次测试包包含它们：\n${dirty.join('\n')}`);
    writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');
    if (beforeLock !== undefined) {
      const lock = JSON.parse(beforeLock);
      lock.version = version;
      if (lock.packages?.['']) lock.packages[''].version = version;
      writeFileSync(lockPath, JSON.stringify(lock, null, 2) + '\n');
    }
    run(process.execPath, [require.resolve('typescript/bin/tsc'), '-p', 'tsconfig.json']);
    run(process.execPath, ['scripts/build.mjs']);
    run(process.execPath, ['--test', ...readdirSync('tests').filter(x => x.endsWith('.test.mjs')).map(x => 'tests/' + x)]);
    const npmCli = process.env.npm_execpath || require.resolve('npm/bin/npm-cli.js');
    mkdirSync(out, { recursive: true });
    run(process.execPath, [npmCli, 'pack', '--pack-destination', out, '--cache', path.join(root, '.local/npm-cache')]);
    const file = path.join(out, `metaontic-video-${version}.tgz`);
    if (!existsSync(file)) throw Error(`未生成 ${file}`);
    // 包内 README 会被宿主插件页当成「详细介绍」渲染，成品包统一裁掉（放在算 sha256 之前）。
    const python = process.env.PYTHON || (process.platform === 'win32' ? 'py' : 'python3');
    run(python, [...(python === 'py' ? ['-3'] : []), 'scripts/strip-package-readme.py', file]);
    const bytes = readFileSync(file);
    const localHash = digest(bytes);
    console.log(`\n测试包：${file}`);
    console.log(`大小：${bytes.length} 字节`);
    console.log(`sha256：${localHash}`);

    if (noUpload) {
      console.log('\n已跳过上传（--no-upload）');
    } else {
      const name = path.basename(file);
      const url = `${urlBase}/${name}`;
      const remote = `${server}:${remoteDir}/`;
      if (hasTool('rsync')) run('rsync', ['-az', `--info=stats2`, `${out}/`, remote]);
      else if (hasTool('scp')) run('scp', ['-q', file, remote]);
      else throw Error('未找到 rsync 或 scp，无法上传；可加 --no-upload 只在本地出包');
      console.log(`\n已上传到 ${remote}`);
      const response = await fetch(url, { headers: { 'user-agent': 'metaontic-pack-test' } });
      if (!response.ok) throw Error(`线上校验失败：${url} 返回 ${response.status}`);
      const published = Buffer.from(await response.arrayBuffer());
      const publishedHash = digest(published);
      if (publishedHash !== localHash) throw Error(`线上包与本地不一致：${url}（${publishedHash}）`);
      console.log(`线上校验通过：${published.length} 字节，sha256 一致`);
      console.log(`\n测试包地址（发给测试者）：「插件 → 添加插件」粘贴该 .tgz 地址\n${url}`);
      console.log(`目录页：${urlBase}/`);
    }
    console.log('\n安装（终端）：dsh plugin --profile desktop add "<tgz 地址>"');
    console.log('回收：测试者用正式版 .tgz 地址重装即可回到正式版；若报 ERR_PNPM_MISSING_TARBALL_INTEGRITY，先删插件目录下的 pnpm-lock.yaml。');
  } catch (error) {
    console.error(`打包停止：${error.message}`);
    process.exitCode = 1;
  } finally {
    restore();
  }
}
