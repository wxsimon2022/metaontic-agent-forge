import { test } from 'node:test';
import assert from 'node:assert/strict';
import { collectTags, compareVersions, parseVersion, matchesPattern, expectedAssets, documentedTags, planCleanup, formatPlan, applyCleanup, parseArgs, mapPool, main, createGiteeClient, createGithubClient, isolatedGitEnv } from '../scripts/clean-releases.mjs';

const release = (tag, extra = {}) => ({ id: Number(String(tag).replace(/\D/g, '').slice(0, 6)) || 1, tag, draft: false, prerelease: false, createdAt: '2026-01-01T00:00:00Z', assets: [], ...extra });

test('版本比较按数字、预发布和真实时间顺序处理', () => {
  assert.deepEqual(parseVersion('v3.13.11'), { major: 3, minor: 13, patch: 11, prerelease: null, tag: 'v3.13.11' });
  assert.equal(parseVersion('ci-test'), null);
  assert.ok(compareVersions('v3.13.11', 'v3.2.0') > 0);
  assert.ok(compareVersions('v3.10.0', 'v3.9.0') > 0, '3.10 必须大于 3.9，不能按字符串比较');
  assert.ok(compareVersions('v3.3.0', 'v3.3.0-beta.1') > 0, '正式版高于同版本预发布');
  assert.ok(compareVersions('v3.3.0-beta.10', 'v3.3.0-beta.2') > 0);
  assert.ok(compareVersions('ci-test', 'v3.2.0') < 0, '非版本标签视为最旧');
  assert.equal(compareVersions('v3.2.0', 'v3.2.0'), 0);
});

test('标签模式与成品附件名按当前约定推导', () => {
  assert.equal(matchesPattern('v3.13.11', ['v*']), true);
  assert.equal(matchesPattern('ci-test', ['v*']), false);
  assert.equal(matchesPattern('ci-test', ['v*', 'ci-*']), true);
  assert.equal(matchesPattern('release-v1', ['v*']), false);
  assert.deepEqual(expectedAssets('v3.13.11'), [
    'metaontic-agent-forge-3.13.11.tgz',
    'MetaOntic Agent Forge-Windows-3.13.11.zip',
    'MetaOntic Agent Forge-Windows-3.13.11.zip.sha256',
  ]);
});

test('清理计划保留最新正式版，删除历史发行版与预发布', () => {
  const plan = planCleanup({
    tags: ['v3.2.0', 'v3.13.11', 'v3.10.0-beta.2', 'ci-test'],
    releases: {
      github: [release('v3.13.11', { assets: [{ id: 1, name: 'metaontic-agent-forge-3.13.11.tgz' }] }), release('v3.2.0'), release('v3.10.0-beta.2', { prerelease: true })],
      gitee: [release('v3.13.11'), release('v3.2.0')],
    },
    currentVersion: '3.13.11', keep: 1, keepTags: 1,
  });
  assert.deepEqual(plan.keep.map(item => item.tag), ['v3.13.11']);
  assert.deepEqual(plan.remove.map(item => item.tag), ['v3.10.0-beta.2', 'v3.2.0']);
  assert.deepEqual(plan.ignored, ['ci-test'], '默认不清理演示标签');
  assert.deepEqual(plan.drafts, []);
  const [beta, old] = plan.remove;
  assert.equal(beta.prerelease, true);
  assert.ok(beta.github, 'GitHub 上的预发布发行版要标记为待删');
  assert.equal(beta.gitee, null, 'Gitee 上没有的就只删标签');
  assert.ok(old.github && old.gitee, '两个仓库都有的发行版分别标记');
});

test('多保留一些版本并单独保留最新预发布', () => {
  const release_ = tag => release(tag);
  const tags = ['v3.13.11', 'v3.13.10', 'v3.13.9', 'v3.10.0-beta.2'];
  const keep2 = planCleanup({ tags, releases: { github: tags.map(release_) }, keep: 2, currentVersion: '3.13.11', patterns: ['v*', 'v*-beta.*'] });
  assert.deepEqual(keep2.keep.map(item => item.tag), ['v3.13.11', 'v3.13.10']);
  assert.deepEqual(keep2.remove.map(item => item.tag), ['v3.13.9', 'v3.10.0-beta.2'], '默认删除全部预发布，剩余按版本从新到旧排列');
  const keepBeta = planCleanup({ tags, releases: { github: tags.map(release_) }, keep: 2, keepPrerelease: true, currentVersion: '3.13.11', patterns: ['v*', 'v*-beta.*'] });
  assert.ok(keepBeta.keep.some(item => item.tag === 'v3.10.0-beta.2' && item.reason.includes('预发布')));
  assert.deepEqual(keepBeta.remove.map(item => item.tag), ['v3.13.9']);
});

test('按时间保护、保留当前版本并识别保留版本里的多余附件', () => {
  const now = Date.parse('2026-11-03T00:00:00Z');
  const plan = planCleanup({
    tags: ['v3.13.11', 'v3.13.10', 'v3.12.0'],
    releases: {
      github: [
        release('v3.13.11', { createdAt: '2026-11-01T00:00:00Z', assets: [{ id: 1, name: 'metaontic-agent-forge-3.13.11.tgz' }, { id: 2, name: 'metaontic-agent-forge-3.13.11.tgz.old' }] }),
        release('v3.13.10', { createdAt: '2026-11-02T00:00:00Z' }),
        release('v3.12.0', { createdAt: '2026-01-01T00:00:00Z' }),
      ],
    },
    currentVersion: '3.12.0', keep: 1, maxAgeDays: 7, now,
  });
  assert.deepEqual(plan.keep.map(item => item.tag), ['v3.13.11', 'v3.12.0']);
  assert.ok(plan.keep.find(item => item.tag === 'v3.12.0').reason.includes('当前'));
  assert.deepEqual(plan.retained.map(item => item.tag), ['v3.13.10'], '7 天内发布的历史版本本次不动');
  assert.deepEqual(plan.remove, []);
  assert.deepEqual(plan.staleAssets, [{ host: 'github', tag: 'v3.13.11', assets: ['metaontic-agent-forge-3.13.11.tgz.old'] }]);
});

test('计划拒绝会清空仓库的参数，并且永不删除唯一的最新标签', () => {
  assert.throws(() => planCleanup({ keep: 0 }), /不小于 1/);
  assert.throws(() => planCleanup({ maxAgeDays: -1 }), /max-age-days/);
  assert.throws(() => planCleanup({ patterns: [] }), /匹配模式/);
  const plan = planCleanup({ tags: ['v1.0.0'], releases: { github: [release('v1.0.0')] }, keep: 1, currentVersion: '' });
  assert.deepEqual(plan.remove, []);
  assert.deepEqual(plan.keep.map(item => item.tag), ['v1.0.0']);
});

test('执行阶段按附件、发行版、标签顺序删除两个仓库并清理本地标签', async () => {
  const plan = planCleanup({
    tags: ['v3.13.11', 'v3.2.0', 'ci-test'],
    releases: {
      github: [release('v3.13.11', { id: 11 }), release('v3.2.0', { id: 20, assets: [{ id: 21, name: 'metaontic-agent-forge-3.2.0.tgz' }] }), { id: 99, tag: '', draft: true, prerelease: false, createdAt: null, assets: [] }],
      gitee: [release('v3.13.11', { id: 11 }), release('v3.2.0', { id: 20, assets: [{ id: 31, name: 'metaontic-agent-forge-3.2.0.tgz' }] })],
    },
    currentVersion: '3.13.11', patterns: ['v*', 'ci-*'], keep: 1, keepTags: 1,
  });
  const calls = [];
  const output = [];
  const github = { slug: 'owner/repo', listReleases: async () => [], remove: async path => { calls.push(`gh ${path}`); return true; } };
  const gitee = { slug: 'owner/repo', listReleases: async () => [], listAttachments: async () => [], remove: async path => { calls.push(`gitee ${path}`); return true; }, removeTag: async tag => { calls.push(`gitee tag ${tag}`); return tag !== 'ci-test'; } };
  const local = { deleteTag: tag => calls.push(`git tag -d ${tag}`) };
  await applyCleanup({ plan, github, gitee, local, log: message => output.push(String(message)) });
  assert.deepEqual(calls, [
    'gh /repos/owner/repo/releases/assets/21',
    'gh /repos/owner/repo/releases/20',
    'gitee /releases/20/attach_files/31',
    'gitee /releases/20',
    'gh /repos/owner/repo/git/refs/tags/v3.2.0',
    'gitee tag v3.2.0',
    'git tag -d v3.2.0',
    'gh /repos/owner/repo/git/refs/tags/ci-test',
    'gitee tag ci-test',
    'git tag -d ci-test',
    'gh /repos/owner/repo/releases/99',
  ]);
  assert.ok(output.some(line => line.includes('Gitee 标签 ci-test（远端已不存在）')), '远端已删过的对象要如实说明');
});

test('远端已经没有的引用按已存在处理，不当作失败', async () => {
  const ghRun = (command, args) => ({ status: 1, stdout: '{\"message\":\"Reference does not exist\"}', stderr: 'gh: Reference does not exist (HTTP 422)' });
  const github = createGithubClient({ slug: 'owner/repo', run: ghRun });
  assert.equal(await github.remove('/repos/owner/repo/git/refs/tags/v3.13.7'), false, '422 只说明远端已经删过了');
  const notFound = createGithubClient({ slug: 'owner/repo', run: () => ({ status: 1, stdout: '', stderr: 'gh: Not Found (HTTP 404)' }) });
  assert.equal(await notFound.remove('/repos/owner/repo/releases/1'), false);
  const real = createGithubClient({ slug: 'owner/repo', run: () => ({ status: 1, stdout: '', stderr: 'gh: Server Error (HTTP 500)' }) });
  await assert.rejects(real.remove('/repos/owner/repo/releases/1'), /HTTP 500/);
});

test('Gitee 标签用私人令牌走 HTTPS 推送删除，令牌不进命令行', async () => {
  const calls = [];
  const run = (command, args, env) => { calls.push({ command, args, env }); return { status: 0, stdout: '', stderr: '' }; };
  const client = createGiteeClient({ slug: 'owner/repo', token: 'secret-token', run, request: async () => ({ ok: false, status: 403, json: async () => ({}) }) });
  assert.equal(await client.removeTag('v3.2.0'), true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].command, 'git');
  assert.deepEqual(calls[0].args.slice(-3), ['push', 'https://gitee.com/owner/repo.git', ':refs/tags/v3.2.0']);
  assert.ok(calls[0].args.includes('credential.helper='), '先清空既有凭据助手，避免命中本机旧凭据');
  assert.ok(calls[0].args.some(value => value.includes('echo password=$GITEE_TOKEN')), '令牌从环境变量读');
  assert.ok(!calls[0].args.some(value => value.includes('secret-token')), '令牌不能出现在命令行参数里');
  assert.deepEqual(calls[0].env, isolatedGitEnv(), '推送要用干净配置，避免本机 url.insteadOf 之类重写把 HTTPS 换成 SSH');
  assert.equal(calls[0].env.GIT_CONFIG_GLOBAL, process.platform === 'win32' ? 'NUL' : '/dev/null');
});

test('消息说清 Gitee 标签的真实结局：删过了、真失败都有对应结果', async () => {
  const returns = [
    { status: 128, stdout: '', stderr: 'error: failed to push some refs\n ! [remote rejected] (deleting a non-existent ref)' },
    { status: 128, stdout: '', stderr: 'fatal: Authentication failed for https://gitee.com/owner/repo.git/' },
  ];
  const run = () => returns.shift();
  const client = createGiteeClient({ slug: 'owner/repo', token: 'tok', run, request: async () => ({ ok: true, status: 200, json: async () => ({ login: 'hackloop' }) }) });
  assert.equal(await client.removeTag('v3.2.0'), false, '远端已经没有这个标签要如实返回，不能算失败');
  const calls = [];
  const retryRun = (command, args) => { calls.push(args); return calls.length === 1
    ? { status: 128, stdout: '', stderr: 'remote: HTTP 403' }
    : { status: 0, stdout: '', stderr: '' }; };
  const retry = createGiteeClient({ slug: 'owner/repo', token: 'tok', run: retryRun, request: async () => ({ ok: true, status: 200, json: async () => ({ login: 'hackloop' }) }) });
  assert.equal(await retry.removeTag('v3.2.0'), true, '认证失败后换成真实登录名重试一次');
  assert.ok(calls[0].some(value => value.includes('username=oauth2')));
  assert.ok(calls[1].some(value => value.includes('username=hackloop')));
});

test('远端标签早已不存在时不算删除成功（git 会返回 0 只给警告）', async () => {
  const realOutput = 'remote: warning: deleting a non-existent ref\nTo gitee.com:owner/repo.git\n - [deleted]         v3.2.0\n';
  const client = createGiteeClient({ slug: 'owner/repo', token: 'tok', run: () => ({ status: 0, stdout: '', stderr: realOutput }), request: async () => ({ ok: false, status: 403, json: async () => ({}) }) });
  assert.equal(await client.removeTag('v3.2.0'), false, '要如实告诉调用方这个标签本来就不在');
});

test('只在 Gitee 存在的标签也会进入清理计划', async () => {
  const tagLines = ['v3.13.11', 'v3.13.10'].map((tag, index) => `sha${index}\trefs/tags/${tag}`).join('\n');
  const githubReleases = ['v3.13.11', 'v3.13.10'].map((tag, index) => JSON.stringify({ id: index + 1, tag_name: tag, draft: false, prerelease: false, created_at: '2026-01-01T00:00:00Z', assets: [] })).join('\n');
  const run = (command, args) => {
    if (command === 'git' && args[0] === 'ls-remote') return { status: 0, stdout: tagLines, stderr: '' };
    if (command === 'gh' && args.some(a => a.includes('/tags?'))) return { status: 0, stdout: tagLines.split('\n').map(line => JSON.stringify({name:line.split('refs/tags/')[1]})).join('\n'), stderr: '' };
    if (command === 'gh' && args.includes('--paginate')) return { status: 0, stdout: githubReleases, stderr: '' };
    return { status: 0, stdout: '', stderr: '' };
  };
  const request = async target => {
    const href = String(target);
    if (href.includes('/tags')) return { ok: true, status: 200, json: async () => [{ name: 'v3.13.11' }, { name: 'v3.13.10' }, { name: 'v3.9.9' }] };
    return { ok: true, status: 200, json: async () => [] };
  };
  const previous = process.env.GITEE_TOKEN;
  process.env.GITEE_TOKEN = 'tok';
  try {
    const plan = await main(['--patterns', 'v*', '--keep', '1', '--keep-tags', '1'], { run, log: () => {}, request });
    assert.ok(plan.remove.some(item => item.tag === 'v3.9.9'), '只推过 Gitee 的标签必须进待删清单');
  } finally {
    if (previous === undefined) delete process.env.GITEE_TOKEN; else process.env.GITEE_TOKEN = previous;
  }
});

test('执行阶段汇总失败项，保留版本的多余附件按当前远端状态重新核对', async () => {
  const plan = planCleanup({
    tags: ['v3.13.11', 'v3.2.0'],
    releases: { github: [release('v3.13.11', { id: 11, assets: [{ id: 1, name: 'metaontic-agent-forge-3.13.11.tgz' }, { id: 2, name: 'stale.zip' }] }), release('v3.2.0', { id: 20 })] },
    currentVersion: '3.13.11', keep: 1, keepTags: 1,
  });
  const calls = [];
  const github = {
    slug: 'owner/repo',
    listReleases: async () => [release('v3.13.11', { id: 11, assets: [{ id: 1, name: 'metaontic-agent-forge-3.13.11.tgz' }, { id: 2, name: 'stale.zip' }] })],
    remove: async path => { calls.push(path); if (path.endsWith('/releases/20')) throw new Error('远端拒绝'); return true; },
  };
  await assert.rejects(applyCleanup({ plan, github, pruneAssets: true, log: () => {} }), /清理未全部成功[\s\S]*远端拒绝/);
  assert.ok(calls.includes('/repos/owner/repo/releases/assets/2'), '多余附件按实际列表删除');
  assert.ok(!calls.includes('/repos/owner/repo/releases/assets/1'), '该版本应有的附件不能删');
});

test('文档里写死的下载地址对应版本受保护，不会被回收', () => {
  const guide = [
    'https://gitee.com/hadlooop/metaontic-agent-forge/releases/download/v3.13.10/metaontic-agent-forge-3.13.10.tgz',
    '形如 https://github.com/x/y/releases/download/v数字版本号/metaontic-agent-forge-数字版本号.tgz',
    'https://github.com/x/y/releases/download/v3.13.10/MetaOntic Agent Forge-Windows-3.13.10.zip',
  ];
  assert.deepEqual(documentedTags(guide), ['v3.13.10'], '同一版本不重复，占位写法不算版本');
  assert.deepEqual(documentedTags([]), []);
  const plan = planCleanup({
    tags: ['v3.13.11', 'v3.13.10'],
    releases: { github: [release('v3.13.11', { id: 11 }), release('v3.13.10', { id: 10 })] },
    currentVersion: '3.13.11', protectedTags: documentedTags(guide), keep: 1, keepTags: 1,
  });
  assert.deepEqual(plan.keep.map(item => item.tag), ['v3.13.11', 'v3.13.10']);
  assert.ok(plan.keep.find(item => item.tag === 'v3.13.10').reason.includes('文档'));
  assert.deepEqual(plan.remove, []);
});

test('发行版与标签各保留最近 5 个，取并集', () => {
  const versions = Array.from({ length: 12 }, (_, index) => `v1.0.${index}`);
  const withReleases = versions.slice(-3);
  const plan = planCleanup({
    tags: versions,
    releases: { github: withReleases.map((tag, index) => release(tag, { id: index + 1 })) },
    currentVersion: '1.0.11',
  });
  assert.deepEqual(plan.remove.map(item => item.tag), ['v1.0.6', 'v1.0.5', 'v1.0.4', 'v1.0.3', 'v1.0.2', 'v1.0.1', 'v1.0.0'], '只删掉两条保留线之外的版本');
  const reasons = Object.fromEntries(plan.keep.map(item => [item.tag, item.reason]));
  assert.ok(reasons['v1.0.11'].includes('发行版'), '有发行版的按发行版保留');
  assert.ok(reasons['v1.0.7'].includes('标签'), '没有发行版但仍在最近 5 个标签里的也要保留');
  const loose = planCleanup({ tags: versions, releases: {}, currentVersion: '1.0.11' });
  assert.deepEqual(loose.remove.map(item => item.tag), ['v1.0.6', 'v1.0.5', 'v1.0.4', 'v1.0.3', 'v1.0.2', 'v1.0.1', 'v1.0.0']);
  const tight = planCleanup({
    tags: versions,
    releases: { github: withReleases.map((tag, index) => release(tag, { id: index + 1 })) },
    currentVersion: '1.0.11', keep: 1, keepTags: 1,
  });
  assert.deepEqual(tight.keep.map(item => item.tag), ['v1.0.11']);
});

test('计划统计预计释放的附件体积', () => {
  const plan = planCleanup({
    tags: ['v3.13.11', 'v3.2.0'],
    releases: {
      github: [release('v3.13.11', { id: 11 }), release('v3.2.0', { id: 20, assets: [{ id: 1, name: 'a.zip', size: 1048576 }, { id: 2, name: 'a.zip.sha256', size: 100 }] })],
      gitee: [release('v3.13.11', { id: 11 }), release('v3.2.0', { id: 20, assets: [{ id: 3, name: 'a.zip', size: 2097152 }] })],
    },
    currentVersion: '3.13.11', keep: 1, keepTags: 1,
  });
  assert.equal(plan.freedBytes.github, 1048676);
  assert.equal(plan.freedBytes.gitee, 2097152);
  assert.equal(plan.freedBytes.total, 3145828);
  assert.match(formatPlan(plan), /预计释放发行版附件 3\.0 MB（GitHub 1\.0 MB、Gitee 2\.0 MB）/);
});

test('命令行参数校验默认值并拒绝危险输入', () => {
  const options = parseArgs([]);
  assert.equal(options.keep, 5);
  assert.equal(options.keepTags, 5, '默认与 --keep 保持一致');
  assert.equal(options.apply, false);
  assert.deepEqual(options.patterns, ['v*']);
  assert.deepEqual(options.hosts, ['github', 'gitee']);
  assert.equal(parseArgs(['--apply', '--keep', '3', '--host', 'gitee', '--max-age-days', '30']).keep, 3);
  assert.equal(parseArgs(['--keep', '3']).keepTags, 3, '不单独指定时标签跟着发行版数量');
  assert.equal(parseArgs(['--keep', '3', '--keep-tags', '7']).keepTags, 7);
  assert.throws(() => parseArgs(['--keep-tags', '0']), /--keep-tags 必须是不小于 1 的整数/);
  assert.equal(parseArgs(['--host', 'gitee']).hosts[0], 'gitee');
  assert.equal(parseArgs(['--help']).help, true);
  assert.throws(() => parseArgs(['--keep', '0']), /不小于 1/);
  assert.throws(() => parseArgs(['--keep']), /缺少取值/);
  assert.throws(() => parseArgs(['--host', 'gitlab']), /github、gitee 或 all/);
  assert.throws(() => parseArgs(['--unknown']), /无法识别的参数/);
});

test('并发辅助函数不丢任务', async () => {
  const seen = [];
  await mapPool([1, 2, 3, 4, 5, 6, 7], 3, async item => { await new Promise(resolve => setTimeout(resolve, 1)); seen.push(item); });
  assert.deepEqual(seen.sort((a, b) => a - b), [1, 2, 3, 4, 5, 6, 7]);
});

test('演练不删除任何东西，加 --apply 才真正下发删除', async () => {
  const tagLines = ['v3.13.11', 'v3.2.0', 'ci-test'].map((tag, index) => `sha${index}\trefs/tags/${tag}`).join('\n');
  const githubReleases = [release('v3.13.11', { id: 11 }), release('v3.2.0', { id: 20 })].map(item => JSON.stringify({ id: item.id, tag_name: item.tag, draft: false, prerelease: false, created_at: item.createdAt, assets: [] })).join('\n');
  const commands = [];
  const run = (command, args) => {
    const line = `${command} ${args.join(' ')}`;
    if (command === 'git' && args[0] === 'ls-remote') return { status: 0, stdout: tagLines, stderr: '' };
    if (command === 'git' && args[0] === 'tag' && args[1] === '-d') { commands.push(line); return { status: 0, stdout: '', stderr: '' }; }
    if (command === 'gh' && args.some(a => a.includes('/tags?'))) return { status: 0, stdout: tagLines.split('\n').map(line => JSON.stringify({name:line.split('refs/tags/')[1]})).join('\n'), stderr: '' };
    if (command === 'gh' && args.includes('--paginate')) return { status: 0, stdout: githubReleases, stderr: '' };
    if (command === 'gh') { commands.push(line); return { status: 0, stdout: '', stderr: '' }; }
    return { status: 0, stdout: '', stderr: '' };
  };
  const output = [];
  const log = message => output.push(String(message));
  const deps = { run, log, request: async () => ({ ok: true, status: 200, json: async () => [] }) };
  const previous = process.env.GITEE_TOKEN;
  delete process.env.GITEE_TOKEN;
  try {
    await main(['--patterns', 'v*,ci-*', '--keep', '1', '--keep-tags', '1'], deps);
    assert.deepEqual(commands, [], '演练不能下发任何删除');
    assert.ok(output.some(line => line.includes('演练结束')));
    assert.ok(output.some(line => line.includes('v3.2.0')), '演练要列出待删版本');
    output.length = 0;
    await main(['--patterns', 'v*,ci-*', '--apply', '--host', 'github', '--keep', '1', '--keep-tags', '1'], { run, log, request: deps.request });
    assert.ok(commands.some(line => line.includes('/git/refs/tags/v3.2.0')));
    assert.ok(commands.some(line => line.includes('/git/refs/tags/ci-test')));
    assert.ok(!commands.some(line => line.includes('v3.13.11')), '最新正式版不能删');
    assert.ok(output.some(line => line.includes('清理完成')));
  } finally {
    if (previous === undefined) delete process.env.GITEE_TOKEN; else process.env.GITEE_TOKEN = previous;
  }
});

test('默认从平台API合并标签，不读取origin或依赖SSH',async()=>{
 const logs=[];
 const tags=await collectTags({github:{listTags:async()=>['v3.17.0','v3.16.0']},gitee:{listTags:async()=>['v3.17.0','v3.15.2']},run:()=>{throw Error('must not call git');},log:x=>logs.push(x)});
 assert.deepEqual(tags,['v3.17.0','v3.16.0','v3.15.2']);assert.deepEqual(logs,[]);assert.equal(parseArgs([]).remote,null);
});

test('显式远端失败时使用新鲜平台数据，不谎报回退本地标签',async()=>{
 const logs=[];
 const tags=await collectTags({remote:'origin',gitee:{listTags:async()=>['v3.17.0']},run:()=>({status:128,stdout:'',stderr:'SSH unavailable'}),log:x=>logs.push(x)});
 assert.deepEqual(tags,['v3.17.0']);assert.match(logs[0],/使用 Gitee 标签接口/);assert.doesNotMatch(logs[0],/改用本地/);
});

test('平台标签查询失败则停止，不使用不完整列表继续删除',async()=>{
 await assert.rejects(collectTags({gitee:{listTags:async()=>{throw Error('network failed');}},run:()=>{throw Error('must not fallback');}}),/network failed/);
 await assert.rejects(collectTags({remote:'origin',run:()=>({status:128,stdout:'',stderr:''})}),/已停止/);
});
