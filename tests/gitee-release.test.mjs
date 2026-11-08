import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { publishGitee } from '../scripts/publish-gitee.mjs';

for (const prerelease of [false,true]) test(`Gitee publishes and verifies ${prerelease ? 'prerelease' : 'stable'} releases safely`, async () => {
  const version = prerelease ? '3.3.0-beta.1' : '3.3.0';
  const tag = `v${version}`; const filename = `metaontic-agent-forge-${version}.tgz`;
  const dir = await mkdtemp(join(tmpdir(), 'gitee-release-'));
  try {
    const archive = join(dir, filename); await writeFile(archive, 'archive');
    let release = null; const attachments = []; let creates = 0, uploads = 0;
    const request = async (url, options) => {
      assert.ok(url.pathname.startsWith('/api/v5/repos/hadlooop/metaontic-agent-forge/'));
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

test('slow Gitee upload survives a client timeout only when the attachment is verified', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'gitee-timeout-'));
  try {
    const filename = 'MetaOntic Agent Forge-Windows-3.3.0.zip';
    const archive = join(dir, filename); await writeFile(archive, 'archive-bytes');
    const release = { id: 1, body: 'release notes', prerelease: false };
    const makeRequest = ({ stored }) => async (url, options) => {
      const path = url.pathname;
      if (options.method === 'POST' && path.endsWith('/attach_files')) { if (!stored) throw new Error('The operation was aborted due to timeout'); return { ok: true, json: async () => ({}) }; }
      if (path.endsWith('/attach_files')) return { ok: true, json: async () => (stored ? [{ name: filename, size: 13 }] : []) };
      if (options.method === 'PATCH') return { ok: true, json: async () => release };
      return { ok: true, json: async () => release };
    };
    const args = { token: 'test-token', tag: 'v3.3.0', archive, notes: 'release notes', retry: { attempts: 3, delayMs: 0 } };
    await assert.rejects(publishGitee({ ...args, request: makeRequest({ stored: false }) }), /aborted due to timeout/);
    assert.ok((await publishGitee({ ...args, request: makeRequest({ stored: true }) })).endsWith('v3.3.0'));
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('a transient Gitee upload failure is retried and reports the server body when it keeps failing', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'gitee-retry-'));
  try {
    const filename = 'MetaOntic Agent Forge-Windows-3.3.0.zip';
    const archive = join(dir, filename); await writeFile(archive, 'archive-bytes');
    const release = { id: 1, body: 'release notes', prerelease: false };
    const makeRequest = failures => {
      let attempts = 0; const attachments = [];
      return async (url, options) => {
        const path = url.pathname;
        if (options.method === 'POST' && path.endsWith('/attach_files')) {
          attempts += 1;
          if (attempts <= failures) return { ok: false, status: 400, text: async () => '请求超时，请稍后重试' };
          attachments.push({ name: filename, size: 13 });
          return { ok: true, json: async () => attachments[0] };
        }
        if (path.endsWith('/attach_files')) return { ok: true, json: async () => attachments };
        if (options.method === 'PATCH') return { ok: true, json: async () => release };
        return { ok: true, json: async () => release };
      };
    };
    const args = { token: 'test-token', tag: 'v3.3.0', archive, notes: 'release notes', retry: { attempts: 4, delayMs: 0 } };
    assert.ok((await publishGitee({ ...args, request: makeRequest(2) })).endsWith('v3.3.0'));
    await assert.rejects(publishGitee({ ...args, request: makeRequest(9) }), error => {
      assert.match(error.message, /HTTP 400 请求超时/);
      assert.match(error.message, /重试 4 次仍失败/);
      return true;
    });
  } finally { await rm(dir, { recursive: true, force: true }); }
});
