import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';
import { pathToFileURL } from 'node:url';

export async function publishGitee({ token, tag, archive, notes, prerelease = false, request = fetch, retry = { attempts: 4, delayMs: 20000 } }) {
  if (!token) throw new Error('Missing GITEE_TOKEN. Add it to GitHub Actions repository secrets.');
  if (!/^v\d+\.\d+\.\d+(?:-beta\.[1-9]\d*)?$/.test(tag)) throw new Error('A version tag is required.');
  const base = 'https://gitee.com/api/v5/repos/hadlooop/metaontic-agent-forge';
  async function api(path, { method = 'GET', data, file, allow404 = false } = {}) {
    const url = new URL(base + path);
    let body;
    if (method === 'GET') url.searchParams.set('access_token', token);
    else if (file) {
      body = new FormData();
      body.set('access_token', token);
      body.set('file', new Blob([file]), basename(archive));
    } else {
      body = new URLSearchParams({ access_token: token, ...data });
    }
    // Uploads are much slower than metadata calls; a short timeout aborted the Windows ZIP mid-transfer.
    const response = await request(url, { method, body, signal: AbortSignal.timeout(file ? 300000 : 60000) });
    if (allow404 && response.status === 404) return null;
    if (!response.ok) {
      // 保留服务端正文，否则线上只能看到一个孤立的状态码，无法判断是限流、超时还是内容校验。
      const detail = await response.text?.().catch(() => '') ?? '';
      throw new Error(`Gitee ${method} ${path}: HTTP ${response.status}${detail ? ' ' + detail.slice(0, 300) : ''}`);
    }
    return response.json();
  }
  let release = await api(`/releases/tags/${tag}`, { allow404: true });
  if (!release) release = await api('/releases', { method: 'POST', data: {
    tag_name: tag, name: `MetaOntic Agent Forge ${tag}`, body: notes, target_commitish: 'master', prerelease: String(prerelease),
  } });
  if (release?.id && (release.body !== notes || release.prerelease !== prerelease)) {
    release = await api(`/releases/${release.id}`, { method: 'PATCH', data: { tag_name: tag, name: `MetaOntic Agent Forge ${tag}`, body: notes, prerelease: String(prerelease) } });
    if (release.body !== notes || release.prerelease !== prerelease) throw new Error('Gitee release notes or channel verification failed.');
  }
  if (!release?.id) throw new Error('Gitee did not return a release ID.');
  const path = `/releases/${release.id}/attach_files`;
  const attachments = await api(path);
  if (!Array.isArray(attachments)) throw new Error('Invalid Gitee attachment list.');
  const bytes = await readFile(archive);
  const name = basename(archive);
  const listed = list => Array.isArray(list) && list.some(item => (item.name || item.file_name) === name);
  const stored = list => listed(list) && list.some(item => (item.name || item.file_name) === name && Number(item.size) === bytes.length);
  const existing = attachments.find(item => (item.name || item.file_name) === name);
  if (existing) {
    if (Number(existing.size) !== bytes.length) throw new Error('Existing Gitee attachment has a different size; refusing to replace it.');
  } else {
    // 海外 runner 到 Gitee 的上传速度波动很大，实测同一个包第一次成功、第二次 HTTP 400；
    // 失败先复查附件表（Gitee 可能在客户端放弃后才收完），再按退避重试，避免整次发布因一次慢上传失败。
    const attempts = Math.max(1, Number(retry?.attempts) || 1);
    const delayMs = Math.max(0, Number(retry?.delayMs) || 0);
    let failure;
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      try { await api(path, { method: 'POST', file: bytes }); failure = undefined; break; }
      catch (error) {
        failure = error;
        if (stored(await api(path).catch(() => null))) { failure = undefined; break; }
        if (attempt < attempts && delayMs) await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
    if (failure) throw new Error(`Gitee 上传 ${name} 重试 ${attempts} 次仍失败：${failure.message}`);
  }
  if (!stored(await api(path))) throw new Error('Gitee attachment verification failed.');
  return `https://gitee.com/hadlooop/metaontic-agent-forge/releases/tag/${tag}`;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [tag, archive, notesFile] = process.argv.slice(2);
  try {
    const url = await publishGitee({ token: process.env.GITEE_TOKEN, prerelease: process.env.GITEE_PRERELEASE === 'true', tag, archive, notes: await readFile(notesFile, 'utf8'), retry: { attempts: Number(process.env.GITEE_UPLOAD_ATTEMPTS) || 4, delayMs: Number(process.env.GITEE_UPLOAD_DELAY_MS) || 20000 } });
    console.log(`Gitee Release verified: ${url}`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
