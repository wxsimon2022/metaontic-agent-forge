/**
 * 清理 Gitee 上超出企业附件配额的旧发行版。
 * 默认 dry-run 只列出候选，确认后由工作流传 DRY_RUN=false 才真正删除。
 */
import { pathToFileURL } from 'node:url';

const REPO = 'hackloop/metaontic-video';

export async function pruneGitee({ token, repo = REPO, keep = 3, days = 3, dryRun = true, deleteTags = false, request = fetch, log = console.log }) {
  if (!token) throw new Error('Missing GITEE_TOKEN. Add it to GitHub Actions repository secrets.');
  const base = `https://gitee.com/api/v5/repos/${repo}`;
  async function api(path, { method = 'GET' } = {}) {
    const url = new URL(base + path);
    const init = { method, signal: AbortSignal.timeout(180000) };
    if (method === 'GET') url.searchParams.set('access_token', token);
    else init.body = new URLSearchParams({ access_token: token });
    const response = await request(url, init);
    if (response.status === 404) return null;
    if (!response.ok) {
      const detail = await response.text?.().catch(() => '') ?? '';
      throw new Error(`Gitee ${method} ${path}: HTTP ${response.status}${detail ? ' ' + detail.slice(0, 200) : ''}`);
    }
    return response.json();
  }
  const releases = [];
  for (let page = 1; ; page += 1) {
    const batch = await api(`/releases?per_page=100&page=${page}`);
    if (!Array.isArray(batch) || !batch.length) break;
    releases.push(...batch);
    if (batch.length < 100) break;
  }
  const attachmentBytes = async id => {
    const files = await api(`/releases/${id}/attach_files`).catch(() => null);
    return Array.isArray(files) ? files.reduce((sum, file) => sum + (Number(file.size) || 0), 0) : 0;
  };
  const ordered = [...releases].sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  const cutoff = Date.now() - days * 86400000;
  const doomed = ordered.filter((release, index) => index >= keep && Date.parse(release.created_at) < cutoff);
  let freed = 0;
  for (const release of doomed) freed += await attachmentBytes(release.id);
  log(`仓库 ${repo}：共 ${ordered.length} 个发行版，保留最新 ${keep} 个，删除 ${days} 天前的且不在保留区内的 ${doomed.length} 个。`);
  for (const release of doomed) log(`  - ${release.tag_name}  ${String(release.created_at).slice(0, 19)}`);
  log(`预计释放附件 ${(freed / 1048576).toFixed(1)} MB${dryRun ? '（dry-run：本次不删除任何内容）' : ''}`);
  if (dryRun) return { deleted: [], candidates: doomed.map(release => release.tag_name), freedBytes: freed };
  const deleted = [];
  for (const release of doomed) {
    await api(`/releases/${release.id}`, { method: 'DELETE' });
    if (deleteTags && release.tag_name) await api(`/tags/${encodeURIComponent(release.tag_name)}`, { method: 'DELETE' }).catch(() => null);
    deleted.push(release.tag_name);
    log(`已删除发行版 ${release.tag_name}${deleteTags ? ' 及其标签' : ''}`);
  }
  const remaining = await api('/releases?per_page=100&page=1');
  let remainingBytes = 0;
  for (const release of Array.isArray(remaining) ? remaining : []) remainingBytes += await attachmentBytes(release.id);
  log(`删除完成：剩余 ${Array.isArray(remaining) ? remaining.length : '?'} 个发行版，附件合计 ${(remainingBytes / 1048576).toFixed(1)} MB`);
  return { deleted, candidates: doomed.map(release => release.tag_name), freedBytes: freed, remainingBytes };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  pruneGitee({
    token: process.env.GITEE_TOKEN,
    keep: Number(process.env.KEEP) || 3,
    days: Number(process.env.DAYS) || 3,
    dryRun: process.env.DRY_RUN !== 'false',
    deleteTags: process.env.DELETE_TAGS === 'true',
  }).catch(error => { console.error(error.message); process.exitCode = 1; });
}
