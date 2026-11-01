import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { publishGitee } from '../scripts/publish-gitee.mjs';

for (const prerelease of [false,true]) test(`Gitee publishes and verifies ${prerelease ? 'prerelease' : 'stable'} releases safely`, async () => {
  const version = prerelease ? '3.3.0-beta.1' : '3.3.0';
  const tag = `v${version}`; const filename = `metaontic-video-${version}.tgz`;
  const dir = await mkdtemp(join(tmpdir(), 'gitee-release-'));
  try {
    const archive = join(dir, filename); await writeFile(archive, 'archive');
    let release = null; const attachments = []; let creates = 0, uploads = 0;
    const request = async (url, options) => {
      const path = url.pathname;
      if (options.method === 'PATCH') {
        assert.equal(options.body.get('tag_name'), tag);
        release = { ...release, body: options.body.get('body'), prerelease: options.body.get('prerelease') === 'true' };
        return { ok: true, json: async () => release };
      }
      if (options.method === 'POST' && path.endsWith('/releases')) {
        creates++; assert.equal(options.body.get('tag_name'), tag); assert.equal(options.body.get('body'), 'release notes'); release = { id: 1, prerelease: options.body.get('prerelease') === 'true' };
        return { ok: true, json: async () => release };
      }
      if (options.method === 'POST') {
        uploads++; assert.equal(options.body.get('file').name, filename);
        attachments.push({ name: filename, size: 7 });
        return { ok: true, json: async () => attachments[0] };
      }
      if (path.endsWith('/attach_files')) return { ok: true, json: async () => attachments };
      return release ? { ok: true, json: async () => release } : { ok: false, status: 404 };
    };
    const args = { token: 'test-token', tag, prerelease, archive, notes: 'release notes', request };
    assert.ok((await publishGitee(args)).endsWith(tag));
    release.prerelease = !prerelease;
    release.body = 'stale notes';
    await publishGitee(args); assert.equal(release.body, 'release notes'); assert.equal(creates, 1); assert.equal(uploads, 1);
    attachments[0].size = 9;
    await assert.rejects(publishGitee(args), /different size/);
    await assert.rejects(publishGitee({ ...args, token: '' }), /Missing GITEE_TOKEN/);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
