import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import vm from 'node:vm';
import { sourceOf } from './source.mjs';

const context = vm.createContext({
  path, os, ...fs,
  probeMedia: async () => null,
  runProcess: async () => ({ code: 0 }),
  resolveBinary: () => 'ffmpeg',
  uniqueSuffix: (prefix) => prefix,
  isOmniExtendModel: () => false,
});
vm.runInContext(
  `${sourceOf('businesses/video/media/references')}\nObject.assign(globalThis,{pruneReferenceCache,referenceCacheDir});`,
  context,
);

const DAY = 24 * 60 * 60 * 1000;

async function withCacheDir(run) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'mv-refcache-'));
  try {
    return await run(dir);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}

async function writeAt(dir, name, ageMs) {
  const file = path.join(dir, name);
  await fs.writeFile(file, name);
  const when = new Date(Date.now() - ageMs);
  await fs.utimes(file, when, when);
  return file;
}

test('参考图缓存清理：删超期文件，保留新文件', async () => {
  await withCacheDir(async (dir) => {
    await writeAt(dir, 'stale.jpg', 8 * DAY);
    const fresh = await writeAt(dir, 'fresh.jpg', 0);
    await context.pruneReferenceCache(dir, { force: true });
    const left = (await fs.readdir(dir)).sort();
    assert.deepEqual(left, ['fresh.jpg']);
    assert.ok(await fs.stat(fresh));
  });
});

test('参考图缓存清理：数量超上限时从最旧的开始删，最近的留着', async () => {
  await withCacheDir(async (dir) => {
    // 上限 200：放 205 个 1 天前（000 最旧、204 最新）+ 1 个刚写入的，清理后只留上限内的文件。
    for (let index = 0; index < 205; index += 1) {
      await writeAt(dir, `${String(index).padStart(3, '0')}.jpg`, DAY + (205 - index) * 1000);
    }
    const newest = await writeAt(dir, 'newest.jpg', 0);
    await context.pruneReferenceCache(dir, { force: true });
    const left = (await fs.readdir(dir)).sort();
    assert.equal(left.length, 200);
    assert.ok(left.includes('newest.jpg'), '刚写入的缓存不能被清掉');
    assert.ok(!left.includes('000.jpg'), '最旧的要先删');
    assert.ok(await fs.stat(newest));
  });
});

test('参考图缓存清理：并发适配正在写的临时文件不动', async () => {
  await withCacheDir(async (dir) => {
    const inFlight = await writeAt(dir, 'photo.123-1-ab12cd.fit-999-3-x1y2z3.jpg', 1000);
    const done = await writeAt(dir, 'photo-111-222-1280x720.jpg', 3 * DAY);
    await context.pruneReferenceCache(dir, { force: true });
    const left = (await fs.readdir(dir)).sort();
    assert.ok(left.includes(path.basename(inFlight)), '正在写的临时文件不能被删');
    // 顺手确认常规条目按 mtime 判定超期：3 天前还没到 7 天，保留。
    assert.ok(left.includes(path.basename(done)));
  });
});

test('参考图缓存目录固定放在系统临时目录下', () => {
  assert.equal(context.referenceCacheDir(), path.join(os.tmpdir(), 'metaontic-video-reference'));
});
