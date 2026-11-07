import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { sourceOf } from './source.mjs';
const c = vm.createContext({ URL });
vm.runInContext(sourceOf('client/media-preview', 'workflow/media-preview'), c);
test('local media uses host route for macOS and Windows paths', () => {
  for (const path of ['/Users/测试/视频 1.mp4', 'C:\\项目\\视频 1.mp4']) {
    const url = new URL(c.localMediaUrl(path, 'https://host/app/'));
    assert.equal(url.pathname, '/app/api/file');
    assert.equal(url.searchParams.get('path'), path);
  }
  assert.match(c.localMediaUrl('/a.mp4', 'dsh-app://app/'), /^dsh-app:\/\/app\/api\/file/);
  for (const path of ['relative.mp4', '//server/a', '\\\\server\\a', '/a\n.mp4']) assert.equal(c.localMediaUrl(path, 'https://host/'), '');
  assert.equal(c.remoteMediaUrl('https://secret:key@host/a'), '');
  assert.equal(c.remoteMediaUrl('javascript:alert(1)'), '');
});
test('metadata projects only completed media and keeps merged film first', () => {
  const value = { status: 'succeeded', merged: true, videoPath: '/full.mp4', apiKey: 'secret', segments: [
    { index: 1, status: 'succeeded', localPath: '/one.mp4', videoUrl: 'https://cdn/one.mp4' },
    { index: 2, status: 'failed', localPath: '/bad.mp4' },
  ] };
  const meta = c.mediaPreviewMeta(value, 'video_generate');
  assert.equal(meta.media.length, 2);
  assert.equal(meta.media[0].label, '完整视频');
  assert.equal(meta.media[1].url, 'https://cdn/one.mp4');
  assert.doesNotMatch(JSON.stringify(meta), /secret|bad/);
  assert.equal(c.mediaPreviewMeta({ ...value, paused: true }, 'video_generate').media[0].label, '已完成部分合并视频');
});
test('image metadata and old Markdown conversation links remain previewable', () => {
  const meta = c.mediaPreviewMeta({ imageUrl: 'https://cdn/image.png', localPath: '/图.png' }, 'video_prepare_image');
  assert.equal(meta.media[0].kind, 'image');
  assert.equal(c.previewMediaFromBlock({ kind: 'result', meta: { metaonticMedia: meta } }, 'video_prepare_image').length, 1);
  const block = { kind: 'result', content: [{ type: 'text', text: '[第一段](</视频 1.mp4>)\n[图片](https://cdn/a.png)' }] };
  const items = c.previewMediaFromBlock(block, 'video_generate');
  assert.equal(items[0].localPath, '/视频 1.mp4');
  assert.equal(items[1].kind, 'image');
  assert.equal(c.previewMediaFromBlock({ ...block, isError: true }, 'video_generate').length, 0);
});
