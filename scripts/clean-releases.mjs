/**
 * 维护者工具：定期清理历史标签、发行版及其附件（GitHub 与 Gitee）。
 * 默认只打印清理计划；只有显式加 --apply 才会删除，且最新正式版始终保留。
 * 用法：npm run clean:releases -- [--keep 1] [--apply]
 */
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { repository as parseRepository } from './release.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DAY = 86400000;
/** 这些文件里写死的 .tgz 下载地址对应版本必须保留，否则现成链接会失效。 */
const DOCUMENTED_FILES = ['README.md', 'README.en.md', 'MetaOnticVideo使用说明书.md', 'CHANGELOG.md', 'docs/engineering/SKILL.md'];
const USAGE = `清理历史标签、发行版及附件（默认演练，加 --apply 才删除）

  npm run clean:releases                    # 演练：打印保留与待删清单
  npm run clean:releases -- --apply         # 按计划删除

  --keep <n>            保留最近 n 个正式版，默认 1，最小 1
  --max-age-days <n>    只清理 n 天以前发布的版本，默认 0（不限）
  --patterns <a,b>      参与清理的标签模式，默认 v*
  --keep-prerelease     额外保留最新的预发布
  --keep-drafts         保留 GitHub 草稿发行版
  --prune-assets        删除保留版本里与该版本不符的多余附件
  --host <name>         github、gitee 或 all，默认 all
  --remote <name>       标签来源远端，默认 origin
  --github/--gitee <url>  仓库地址
  --json                以 JSON 输出计划
  --dry-run             只演练（默认）

最新正式版、当前 package.json 版本、文档下载地址引用的版本始终保留。`;

export function parseVersion(tag) {
  const match = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/.exec(String(tag || ''));
  if (!match) return null;
  return { major: Number(match[1]), minor: Number(match[2]), patch: Number(match[3]), prerelease: match[4] ?? null, tag: String(tag) };
}

function comparePrerelease(left, right) {
  const a = left.split('.'), b = right.split('.');
  for (let i = 0; i < Math.max(a.length, b.length); i += 1) {
    if (a[i] === undefined) return -1;
    if (b[i] === undefined) return 1;
    const na = /^\d+$/.test(a[i]), nb = /^\d+$/.test(b[i]);
    if (na && nb) { if (Number(a[i]) !== Number(b[i])) return Number(a[i]) - Number(b[i]); }
    else if (na) return -1;
    else if (nb) return 1;
    else if (a[i] !== b[i]) return a[i] < b[i] ? -1 : 1;
  }
  return 0;
}

/** 数值版本比较；非版本标签视为最旧，便于把演练标签排在正式版之后。 */
export function compareVersions(left, right) {
  const a = parseVersion(left), b = parseVersion(right);
  if (!a || !b) { if (!a && !b) return String(left).localeCompare(String(right)); return a ? 1 : -1; }
  for (const key of ['major', 'minor', 'patch']) if (a[key] !== b[key]) return a[key] - b[key];
  if (a.prerelease === b.prerelease) return 0;
  if (!a.prerelease) return 1;
  if (!b.prerelease) return -1;
  return comparePrerelease(a.prerelease, b.prerelease);
}

export function matchesPattern(tag, patterns) {
  return patterns.some(pattern => {
    const source = String(pattern).replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.');
    return new RegExp(`^${source}$`).test(String(tag));
  });
}

/** 该版本发行版应当携带的三个成品附件；其余附件视为残留。 */
export function expectedAssets(tag) {
  const version = String(tag).replace(/^v/, '');
  return [
    `metaontic-video-${version}.tgz`,
    `MetaOnticVideo-Windows-${version}.zip`,
    `MetaOnticVideo-Windows-${version}.zip.sha256`,
  ];
}

/** 文档里出现过的 .tgz 下载地址所对应的版本，删除会让现成链接失效，必须保留。 */
export function documentedTags(contents) {
  const tags = new Set();
  for (const text of contents) {
    if (!text) continue;
    for (const [, tag] of String(text).matchAll(/releases\/download\/(v[0-9A-Za-z.-]+)\//g)) tags.add(tag);
  }
  return [...tags];
}

/**
 * 计算清理计划：保留最新的 keep 个正式版、可选的最新预发布、当前 package.json 版本、文档引用的版本，
 * 其余符合 patterns 的标签连同发行版、附件一起删除；maxAgeDays > 0 时跳过太新的版本。
 */
export function planCleanup({ tags = [], releases = {}, keep = 1, keepPrerelease = false, maxAgeDays = 0, patterns = ['v*'], currentVersion = '', protectedTags = [], drafts = true, now = Date.now() } = {}) {
  if (!Number.isInteger(keep) || keep < 1) throw new Error('保留数量必须是不小于 1 的整数，避免删掉最新版本。');
  if (!Number.isInteger(maxAgeDays) || maxAgeDays < 0) throw new Error('--max-age-days 必须是不小于 0 的整数。');
  if (!Array.isArray(patterns) || patterns.length === 0) throw new Error('至少需要一个标签匹配模式。');

  const entries = new Map();
  const entryOf = tag => {
    const key = String(tag);
    if (!entries.has(key)) entries.set(key, { tag: key, github: null, gitee: null, createdAt: null });
    return entries.get(key);
  };
  for (const item of releases.github || []) {
    if (!item.tag || item.draft) continue;
    const entry = entryOf(item.tag);
    entry.github = { id: item.id, assets: item.assets || [] };
    entry.createdAt = newestDate(entry.createdAt, item.createdAt);
  }
  for (const item of releases.gitee || []) {
    if (!item.tag) continue;
    const entry = entryOf(item.tag);
    entry.gitee = { id: item.id, assets: item.assets || [] };
    entry.createdAt = newestDate(entry.createdAt, item.createdAt);
  }
  for (const tag of tags) entryOf(tag);

  const candidates = [...entries.values()];
  const ignored = candidates.filter(entry => !matchesPattern(entry.tag, patterns)).map(entry => entry.tag).sort();
  const matched = candidates.filter(entry => matchesPattern(entry.tag, patterns));
  const sorted = [...matched].sort((a, b) => compareVersions(b.tag, a.tag) || a.tag.localeCompare(b.tag));

  const kept = new Map();
  const keepEntry = (entry, reason) => { if (!kept.has(entry.tag)) kept.set(entry.tag, { tag: entry.tag, reason }); };
  const stable = sorted.filter(entry => parseVersion(entry.tag) && !parseVersion(entry.tag).prerelease);
  stable.slice(0, keep).forEach(entry => keepEntry(entry, `最新的 ${keep} 个正式版`));
  if (keepPrerelease) sorted.filter(entry => parseVersion(entry.tag)?.prerelease).slice(0, 1).forEach(entry => keepEntry(entry, '最新的预发布'));
  if (currentVersion && entries.has(`v${currentVersion}`)) keepEntry(entries.get(`v${currentVersion}`), '当前 package.json 版本');
  for (const tag of protectedTags) if (entries.has(tag)) keepEntry(entries.get(tag), '文档里的下载地址仍在引用');
  if (kept.size === 0 && sorted.length) keepEntry(sorted[0], '仓库里最新的标签');

  const cutoff = maxAgeDays > 0 ? now - maxAgeDays * DAY : null;
  const ageDays = entry => (entry.createdAt ? Math.floor((now - Date.parse(entry.createdAt)) / DAY) : null);
  const isFresh = entry => cutoff !== null && entry.createdAt !== null && Date.parse(entry.createdAt) >= cutoff;

  const remove = [];
  const retained = [];
  for (const entry of sorted) {
    if (kept.has(entry.tag)) continue;
    const version = parseVersion(entry.tag);
    const record = {
      tag: entry.tag,
      version: version?.tag ?? null,
      prerelease: Boolean(version?.prerelease),
      createdAt: entry.createdAt,
      ageDays: ageDays(entry),
      github: entry.github,
      gitee: entry.gitee,
    };
    (isFresh(entry) ? retained : remove).push(record);
  }

  const staleAssets = [];
  for (const { tag } of kept.values()) {
    const allowed = new Set(expectedAssets(tag));
    for (const host of ['github', 'gitee']) {
      const entry = entries.get(tag);
      const names = (entry?.[host]?.assets || []).map(asset => asset.name).filter(name => !allowed.has(name));
      if (names.length) staleAssets.push({ host, tag, assets: names.sort() });
    }
  }

  return {
    keep: [...kept.values()].sort((a, b) => compareVersions(b.tag, a.tag)),
    remove,
    retained,
    ignored,
    staleAssets,
    freedBytes: {
      github: remove.reduce((sum, item) => sum + assetsBytes(item.github), 0),
      gitee: remove.reduce((sum, item) => sum + assetsBytes(item.gitee), 0),
      total: remove.reduce((sum, item) => sum + assetsBytes(item.github) + assetsBytes(item.gitee), 0),
    },
    drafts: drafts ? (releases.github || []).filter(item => item.draft && !item.tag) : [],
  };
}

function assetsBytes(release) {
  return (release?.assets || []).reduce((sum, asset) => sum + (Number(asset.size) || 0), 0);
}

function newestDate(current, candidate) {
  if (!candidate) return current;
  if (!current) return candidate;
  return Date.parse(candidate) > Date.parse(current) ? candidate : current;
}

export function formatPlan(plan, { apply = false, hosts = ['github', 'gitee'] } = {}) {
  const lines = [`清理计划（${apply ? '执行删除' : '演练，加 --apply 才执行'}｜目标：${hosts.join(' + ')}）`];
  lines.push('', '保留：');
  for (const item of plan.keep) lines.push(`- ${item.tag}（${item.reason}）`);
  if (!plan.keep.length) lines.push('- 无');
  lines.push('', `删除（${plan.remove.length} 个）：`);
  for (const item of plan.remove) {
    const hostsText = [item.github && 'GitHub', item.gitee && 'Gitee'].filter(Boolean).join('+') || '仅标签';
    const assets = ['github', 'gitee'].map(host => (item[host]?.assets?.length ? `${host === 'github' ? 'GitHub' : 'Gitee'} ${item[host].assets.length} 个附件` : null)).filter(Boolean).join('、');
    lines.push(`- ${item.tag}｜${item.prerelease ? '预发布' : item.version ? '正式版' : '非版本标签'}｜${item.ageDays === null ? '时间未知' : `${item.ageDays} 天前`}｜发行版：${hostsText}${assets ? `｜${assets}` : ''}`);
  }
  if (!plan.remove.length) lines.push('- 无');
  if (plan.retained.length) {
    lines.push('', `按时间保留（max-age-days 内，本次不动，${plan.retained.length} 个）：`);
    for (const item of plan.retained) lines.push(`- ${item.tag}｜${item.ageDays} 天前`);
  }
  if (plan.drafts.length) {
    lines.push('', `草稿发行版（${plan.drafts.length} 个，无标签）：`);
    for (const item of plan.drafts) lines.push(`- ${item.id}｜${item.name || '(未命名)'}`);
  }
  if (plan.ignored.length) lines.push('', `不匹配模式、忽略的标签：${plan.ignored.join('、')}`);
  lines.push('', `预计释放发行版附件 ${megabytes(plan.freedBytes.total)}（GitHub ${megabytes(plan.freedBytes.github)}、Gitee ${megabytes(plan.freedBytes.gitee)}）`);
  lines.push('', `保留版本里的多余附件（加 --prune-assets 才会删除，${plan.staleAssets.length} 项）：`);
  for (const item of plan.staleAssets) lines.push(`- ${item.tag}｜${item.host}｜${item.assets.join('、')}`);
  if (!plan.staleAssets.length) lines.push('- 无');
  return lines.join('\n');
}

function megabytes(bytes) {
  return `${((Number(bytes) || 0) / 1048576).toFixed(1)} MB`;
}

export function createGithubClient({ slug, run = defaultRun }) {
  const api = args => {
    const result = run('gh', ['api', ...args]);
    if (result.status !== 0) throw new Error(`gh api ${args.join(' ')} 失败：${(result.stderr || result.stdout || '').trim() || `退出码 ${result.status}`}`);
    return (result.stdout || '').trim();
  };
  return {
    slug,
    listReleases: async () => api(['--paginate', '--jq', '.[]', `/repos/${slug}/releases?per_page=100`])
      .split('\n').filter(Boolean).map(line => JSON.parse(line))
      .map(item => ({ id: item.id, tag: item.tag_name, draft: Boolean(item.draft), prerelease: Boolean(item.prerelease), createdAt: item.created_at, assets: (item.assets || []).map(asset => ({ id: asset.id, name: asset.name, size: asset.size })) })),
    remove: async path => {
      const result = run('gh', ['api', '--method', 'DELETE', path]);
      if (result.status === 0) return true;
      const message = `${result.stderr || ''}${result.stdout || ''}`;
      if (/HTTP 404|Not Found|no such/i.test(message)) return false;
      throw new Error(`gh api DELETE ${path} 失败：${message.trim() || `退出码 ${result.status}`}`);
    },
  };
}

/** 私人令牌走 HTTPS 推送时的凭据助手：用户名进命令行，令牌只从环境变量读，不落到 argv 与日志里。 */
export function tagCredentialHelper(username) {
  return `!f(){ echo username=${username}; echo password=$GITEE_TOKEN; };f`;
}

/*
 * 私人令牌推送必须用干净配置：本机 url.*.insteadOf 之类的重写会把 HTTPS 悄悄换成 SSH，
 * 表面上成功、CI 里却会因为没有 SSH 密钥而失败。
 */
export function isolatedGitEnv() {
  const empty = process.platform === 'win32' ? 'NUL' : '/dev/null';
  return { GIT_CONFIG_GLOBAL: empty, GIT_CONFIG_SYSTEM: empty, GIT_TERMINAL_PROMPT: '0' };
}

function credentialOutput(result) {
  return `${result.stderr || ''}${result.stdout || ''}`.trim();
}

export function createGiteeClient({ slug = 'hackloop/metaontic-video', token, request = fetch, run = defaultRun }) {
  if (!token) throw new Error('缺少 GITEE_TOKEN，无法读取或清理 Gitee 发行版。');
  const endpoint = (path, params = {}) => {
    const target = new URL(`https://gitee.com/api/v5/${path}`);
    target.searchParams.set('access_token', token);
    for (const [key, value] of Object.entries(params)) target.searchParams.set(key, String(value));
    return target;
  };
  const url = (resource, params) => endpoint(`repos/${slug}${resource}`, params);
  // 令牌对应的真实登录名；部分账号不接受 oauth2 这个固定用户名，失败时用它对一次。
  const accountLogin = async () => {
    try {
      const response = await request(endpoint('user'), { signal: AbortSignal.timeout(20000) });
      if (!response.ok) return '';
      const data = await response.json();
      return typeof data?.login === 'string' ? data.login : '';
    } catch { return ''; }
  };
  let pushAs = 'oauth2';
  const list = async (resource, params) => {
    const collected = [];
    for (let page = 1; page <= 50; page += 1) {
      const response = await request(url(resource, { ...params, page, per_page: 100 }), { signal: AbortSignal.timeout(60000) });
      if (!response.ok) throw new Error(`Gitee GET ${resource}: HTTP ${response.status}`);
      const data = await response.json();
      if (!Array.isArray(data) || data.length === 0) break;
      collected.push(...data);
      if (data.length < 100) break;
    }
    return collected;
  };
  return {
    slug,
    listReleases: async () => (await list('/releases')).map(item => ({
      id: item.id,
      tag: item.tag_name,
      draft: false,
      prerelease: item.prerelease === true || item.prerelease === 'true',
      createdAt: item.created_at,
      assets: [],
    })),
    listAttachments: async id => (await list(`/releases/${id}/attach_files`)).map(file => ({ id: file.id, name: file.name || file.file_name, size: Number(file.size) })),
    listTags: async () => (await list('/tags')).map(item => item.name).filter(Boolean),
    // Gitee 开放接口只有标签的读取与创建，没有删除端点（DELETE /tags 不存在，只会返回 404），
    // 所以远程标签必须用令牌走 HTTPS 推送删引用，不能用接口。
    removeTag: async tag => {
      const push = () => run('git', [
        '-c', 'credential.helper=',
        '-c', `credential.helper=${tagCredentialHelper(pushAs)}`,
        '-c', 'credential.useHttpPath=true',
        'push', `https://gitee.com/${slug}.git`, `:refs/tags/${tag}`,
      ], isolatedGitEnv());
      let result = push();
      if (result.status !== 0 && pushAs === 'oauth2' && /40[13]|Authentication failed|Invalid username or password|could not read Username/i.test(credentialOutput(result))) {
        const login = await accountLogin();
        if (login && login !== pushAs) { pushAs = login; result = push(); }
      }
      if (result.status === 0) return true;
      if (/remote ref does not exist|deleting a non-existent ref/i.test(credentialOutput(result))) return false;
      throw new Error(`删除 Gitee 标签 ${tag} 失败：${credentialOutput(result) || `退出码 ${result.status}`}`);
    },
    remove: async resource => {
      const response = await request(url(resource), { method: 'DELETE', signal: AbortSignal.timeout(60000) });
      if (response.status === 404) return false;
      if (!response.ok) throw new Error(`Gitee DELETE ${resource}: HTTP ${response.status}`);
      return true;
    },
  };
}

export async function applyCleanup({ plan, github, gitee, local, pruneAssets = false, log = () => {} }) {
  const errors = [];
  const attempt = async (label, action) => {
    try { const result = await action(); log(`- ${label}${result === false ? '（远端已不存在）' : ''}`); return result; }
    catch (error) { errors.push(`${label}：${error.message}`); return null; }
  };
  for (const item of plan.remove) {
    if (github && item.github) {
      for (const asset of item.github.assets) await attempt(`删除 GitHub 附件 ${item.tag}/${asset.name}`, () => github.remove(`/repos/${github.slug}/releases/assets/${asset.id}`));
      await attempt(`删除 GitHub 发行版 ${item.tag}`, () => github.remove(`/repos/${github.slug}/releases/${item.github.id}`));
    }
    if (gitee && item.gitee) {
      for (const asset of item.gitee.assets) await attempt(`删除 Gitee 附件 ${item.tag}/${asset.name}`, () => gitee.remove(`/releases/${item.gitee.id}/attach_files/${asset.id}`));
      await attempt(`删除 Gitee 发行版 ${item.tag}`, () => gitee.remove(`/releases/${item.gitee.id}`));
    }
    if (github) await attempt(`删除 GitHub 标签 ${item.tag}`, () => github.remove(`/repos/${github.slug}/git/refs/tags/${encodeURIComponent(item.tag)}`));
    if (gitee) await attempt(`删除 Gitee 标签 ${item.tag}`, () => gitee.removeTag(item.tag));
    if (local) await attempt(`删除本地标签 ${item.tag}`, () => local.deleteTag(item.tag));
  }
  for (const item of plan.drafts) await attempt(`删除 GitHub 草稿发行版 ${item.id}`, () => github.remove(`/repos/${github.slug}/releases/${item.id}`));
  if (pruneAssets) {
    // 删除前重新读取保留版本的当前附件，避免计划生成后远端又发生变化。
    for (const { tag } of plan.keep) {
      const allowed = new Set(expectedAssets(tag));
      if (github) {
        const release = (await github.listReleases()).find(item => item.tag === tag);
        for (const asset of (release?.assets || []).filter(item => !allowed.has(item.name))) {
          await attempt(`清理多余附件 ${tag}/${asset.name}（GitHub）`, () => github.remove(`/repos/${github.slug}/releases/assets/${asset.id}`));
        }
      }
      if (gitee) {
        const release = (await gitee.listReleases()).find(item => item.tag === tag);
        const files = release ? await gitee.listAttachments(release.id) : [];
        for (const asset of files.filter(item => item.name && !allowed.has(item.name))) {
          await attempt(`清理多余附件 ${tag}/${asset.name}（Gitee）`, () => gitee.remove(`/releases/${release.id}/attach_files/${asset.id}`));
        }
      }
    }
  }
  if (errors.length) throw new Error(`清理未全部成功：\n${errors.join('\n')}`);
}

/** 限量并发，避免在发版高峰期把远端接口打满。 */
export async function mapPool(items, limit, worker) {
  const queue = [...items];
  const runners = Array.from({ length: Math.min(limit, queue.length) }, async () => {
    while (queue.length) await worker(queue.shift());
  });
  await Promise.all(runners);
}

function defaultRun(command, args, extraEnv = {}) {
  // 凭据缺失时必须立刻失败，不能挂在交互式提示上；git 一律在仓库根目录执行。
  const result = spawnSync(command, args, { cwd: root, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, env: { ...process.env, GIT_TERMINAL_PROMPT: '0', ...extraEnv } });
  return { status: result.status ?? 1, stdout: result.stdout || '', stderr: result.stderr || result.error?.message || '' };
}

export function remoteTags(remote, run = defaultRun) {
  const result = run('git', ['ls-remote', '--tags', '--refs', remote]);
  if (result.status !== 0) return null;
  return result.stdout.split('\n').map(line => line.split('\t')[1]).filter(Boolean).map(ref => ref.replace(/^refs\/tags\//, ''));
}

export function parseArgs(argv) {
  const options = {
    keep: 1, keepPrerelease: false, maxAgeDays: 0, patterns: ['v*'], hosts: ['github', 'gitee'],
    apply: false, pruneAssets: false, keepDrafts: false, json: false, help: false, remote: 'origin',
    github: 'git@github.com:wxsimon2022/metaontic-video.git', gitee: 'git@gitee.com:hackloop/metaontic-video.git',
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const value = () => {
      const next = argv[index + 1];
      if (!next || next.startsWith('--')) throw new Error(`${arg} 缺少取值。`);
      index += 1;
      return next;
    };
    if (arg === '--apply') options.apply = true;
    else if (arg === '--dry-run') options.apply = false;
    else if (arg === '--help' || arg === '-h') options.help = true;
    else if (arg === '--keep') options.keep = Number(value());
    else if (arg === '--keep-prerelease') options.keepPrerelease = true;
    else if (arg === '--keep-drafts') options.keepDrafts = true;
    else if (arg === '--max-age-days') options.maxAgeDays = Number(value());
    else if (arg === '--patterns') options.patterns = value().split(',').map(item => item.trim()).filter(Boolean);
    else if (arg === '--host') { const host = value(); options.hosts = host === 'all' ? ['github', 'gitee'] : [host]; }
    else if (arg === '--prune-assets') options.pruneAssets = true;
    else if (arg === '--json') options.json = true;
    else if (arg === '--remote') options.remote = value();
    else if (arg === '--github') options.github = value();
    else if (arg === '--gitee') options.gitee = value();
    else throw new Error(`无法识别的参数：${arg}`);
  }
  if (!Number.isInteger(options.keep) || options.keep < 1) throw new Error('--keep 必须是不小于 1 的整数。');
  if (!Number.isInteger(options.maxAgeDays) || options.maxAgeDays < 0) throw new Error('--max-age-days 必须是不小于 0 的整数。');
  if (options.hosts.some(host => host !== 'github' && host !== 'gitee')) throw new Error('--host 只能是 github、gitee 或 all。');
  return options;
}

export async function main(argv = process.argv.slice(2), deps = {}) {
  const log = deps.log || (message => console.log(message));
  const run = deps.run || defaultRun;
  const options = parseArgs(argv);
  if (options.help) { log(USAGE); return null; }
  const currentVersion = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8')).version;
  const github = options.hosts.includes('github') ? createGithubClient({ slug: parseRepository(options.github, 'github.com').slug, run }) : null;
  const token = process.env.GITEE_TOKEN || '';
  let gitee = null;
  if (options.hosts.includes('gitee')) {
    const slug = parseRepository(options.gitee, 'gitee.com').slug;
    if (token || options.apply) gitee = createGiteeClient({ slug, token, request: deps.request || fetch, run });
    else log('提示：未设置 GITEE_TOKEN，演练只列出本地可见的标签，不读取 Gitee 发行版与附件。');
  }
  const listed = remoteTags(options.remote, run);
  if (!listed) log(`警告：读取 ${options.remote} 远端标签失败，改用本地标签列表，结果可能不是最新。`);
  // 只在 Gitee 推过的标签不会出现在别的远端列表里，必须合并后再进计划，否则永远清不掉。
  const tags = [...new Set([...(listed || (run('git', ['tag']).stdout || '').split('\n').filter(Boolean)), ...(gitee ? await gitee.listTags() : [])])];
  const giteeReleases = gitee ? await gitee.listReleases() : [];
  // Gitee 的发行版列表不含附件，逐个补读，计划与删除都以实际附件为准。
  await mapPool(giteeReleases, 5, async release => { release.assets = await gitee.listAttachments(release.id); });
  const releases = { github: github ? await github.listReleases() : [], gitee: giteeReleases };
  const plan = planCleanup({
    tags,
    releases, keep: options.keep, keepPrerelease: options.keepPrerelease, maxAgeDays: options.maxAgeDays,
    patterns: options.patterns, currentVersion, drafts: !options.keepDrafts,
    protectedTags: [...documentedTags(DOCUMENTED_FILES.map(name => {
      try { return readFileSync(path.join(root, name), 'utf8'); } catch { return ''; }
    })), ...(currentVersion ? [`v${currentVersion}`] : [])],
  });
  if (options.json) log(JSON.stringify(plan, null, 2));
  else log(formatPlan(plan, { apply: options.apply, hosts: options.hosts }));
  if (!options.apply) { log('演练结束：未删除任何内容。确认无误后重新执行并加 --apply。'); return plan; }
  const local = { deleteTag: tag => { const result = run('git', ['tag', '-d', tag]); if (result.status !== 0 && !/not found/i.test(result.stderr)) throw new Error(result.stderr.trim() || '删除本地标签失败'); } };
  log('开始删除：');
  await applyCleanup({ plan, github, gitee, local, pruneAssets: options.pruneAssets, log });
  log('清理完成。');
  return plan;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => { console.error(`清理停止：${error.message}`); process.exitCode = 1; });
}
