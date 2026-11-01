import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';
import { pathToFileURL } from 'node:url';

export async function publishGitee({ token, tag, archive, notes, prerelease = false, request = fetch }) {
  if (!token) throw new Error('Missing GITEE_TOKEN. Add it to GitHub Actions repository secrets.');
  if (!/^v\d+\.\d+\.\d+(?:-beta\.[1-9]\d*)?$/.test(tag)) throw new Error('A version tag is required.');
  const base = 'https://gitee.com/api/v5/repos/hackloop/metaontic-video';
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
    const response = await request(url, { method, body, signal: AbortSignal.timeout(60000) });
    if (allow404 && response.status === 404) return null;
    if (!response.ok) throw new Error(`Gitee ${method} ${path}: HTTP ${response.status}`);
    return response.json();
  }
  let release = await api(`/releases/tags/${tag}`, { allow404: true });
  if (!release) release = await api('/releases', { method: 'POST', data: {
    tag_name: tag, name: `MetaOnticVideo ${tag}`, body: notes, target_commitish: 'master', prerelease: String(prerelease),
  } });
  if (release?.id && (release.body !== notes || release.prerelease !== prerelease)) {
    release = await api(`/releases/${release.id}`, { method: 'PATCH', data: { tag_name: tag, name: `MetaOnticVideo ${tag}`, body: notes, prerelease: String(prerelease) } });
    if (release.body !== notes || release.prerelease !== prerelease) throw new Error('Gitee release notes or channel verification failed.');
  }
  if (!release?.id) throw new Error('Gitee did not return a release ID.');
  const path = `/releases/${release.id}/attach_files`;
  const attachments = await api(path);
  if (!Array.isArray(attachments)) throw new Error('Invalid Gitee attachment list.');
  const bytes = await readFile(archive);
  const existing = attachments.find(item => (item.name || item.file_name) === basename(archive));
  if (existing) {
    if (Number(existing.size) !== bytes.length) throw new Error('Existing Gitee attachment has a different size; refusing to replace it.');
  } else await api(path, { method: 'POST', file: bytes });
  const verified = await api(path);
  if (!verified.some(item => (item.name || item.file_name) === basename(archive) && Number(item.size) === bytes.length)) {
    throw new Error('Gitee attachment verification failed.');
  }
  return `https://gitee.com/hackloop/metaontic-video/releases/tag/${tag}`;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [tag, archive, notesFile] = process.argv.slice(2);
  try {
    const url = await publishGitee({ token: process.env.GITEE_TOKEN, prerelease: process.env.GITEE_PRERELEASE === 'true', tag, archive, notes: await readFile(notesFile, 'utf8') });
    console.log(`Gitee Release verified: ${url}`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
