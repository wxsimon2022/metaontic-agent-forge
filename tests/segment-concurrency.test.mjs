import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import vm from 'node:vm';
import { sourceOf } from './source.mjs';

/** 用真实的 downloadSegmentsAndMerge 跑一遍：只把外部依赖（下载、探测、合并）换成可控的假实现。 */
function harness({ segments }) {
  const state = { inFlight: 0, peak: 0, downloads: [], probes: [], saved: [] };
  const context = vm.createContext({
    timedStage: async (_stage, operation) => operation(),
    ref: (config, key, fallback) => config[key] ?? fallback,
    path, ...fs,
    exists: async (file) => { try { await fs.stat(file); return true; } catch { return false; } },
    appendRequestLog: async (record) => { if (record.event === 'segment_saved') state.saved.push(record.index); },
    hasFfmpeg: async () => true,
    formatSeconds: String,
    CUMULATIVE_TOLERANCE_MIN_SECONDS: 1.5,
    CUMULATIVE_TOLERANCE_RATIO: 0.25,
    prepareSeamTrims: async (_config, files) => ({ files, temps: [], cuts: [] }),
    cleanupSegmentTemps: async () => {},
    mergeClips: async (_config, files, out) => { await fs.writeFile(out, files.join('|')); return { mode: 'copy' }; },
    probeMedia: async (file) => { state.probes.push(file); return { durationSeconds: 3 }; },
    downloadFile: async (url, dest) => {
      state.inFlight += 1;
      state.peak = Math.max(state.peak, state.inFlight);
      state.downloads.push(url);
      await new Promise((resolve) => setTimeout(resolve, 5));
      await fs.writeFile(dest, url);
      state.inFlight -= 1;
      return dest;
    },
  });
  const mocks = {prepareSeamTrims:context.prepareSeamTrims, mergeClips:context.mergeClips, cleanupSegmentTemps:context.cleanupSegmentTemps};
  vm.runInContext(sourceOf('businesses/video/media/merge'), context);
  Object.assign(context,mocks);
  return { context, state, segments };
}

test('分段下载并发跑（不超过上限）并保持段号顺序', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'mv-conc-'));
  try {
    const segmentsDir = path.join(dir, 'segments');
    await fs.mkdir(segmentsDir);
    const segments = Array.from({ length: 9 }, (_, index) => ({
      index: index + 1, kind: index ? 'extend' : 'generate', seconds: 3,
      taskId: `task-${index + 1}`, videoUrl: `https://media.invalid/${index + 1}.mp4`,
    }));
    const { context, state } = harness({ segments });
    const result = await context.downloadSegmentsAndMerge({}, {
      segments, segmentsDir, outDir: dir, stamp: 'test',
    });
    assert.equal(result.merged, true);
    // 并发有实际收益（不是一段一段来），但不放任无限并发。
    assert.ok(state.peak > 1, `应当并发下载，实测峰值 ${state.peak}`);
    assert.ok(state.peak <= 4, `并发上限应为 4，实测峰值 ${state.peak}`);
    // 生成了 9 个分段文件，且按段号顺序处理（localPath / 落盘日志 / 探测都是这个顺序）。
    assert.deepEqual(segments.map((segment) => segment.localPath),
      segments.map((segment, index) => path.join(segmentsDir, `${String(index + 1).padStart(2, '0')}-${segment.kind}.mp4`)));
    assert.deepEqual(state.saved, segments.map((segment) => segment.index));
    // 探测顺序也是段号顺序（合并成片本身的探测不算在内）
    assert.deepEqual(state.probes.filter((file) => file.startsWith(segmentsDir)),
      segments.map((segment) => segment.localPath));
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test('多段下载里有一个失败时，报第一个失败段（按段号）并保留已下载的分段', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'mv-conc-fail-'));
  try {
    const segmentsDir = path.join(dir, 'segments');
    await fs.mkdir(segmentsDir);
    const segments = [1, 2, 3, 4].map((index) => ({
      index, kind: 'extend', seconds: 3, taskId: `task-${index}`,
      videoUrl: `https://media.invalid/${index}.mp4`,
    }));
    const { context } = harness({ segments });
    const failures = new Set(['https://media.invalid/2.mp4', 'https://media.invalid/3.mp4']);
    context.downloadFile = async (url, dest) => {
      if (failures.has(url)) throw Object.assign(new Error(`HTTP 503：${url}`), { code: 'download_failed' });
      await fs.writeFile(dest, url);
      return dest;
    };
    const result = await context.downloadSegmentsAndMerge({}, {
      segments, segmentsDir, outDir: dir, stamp: 'test',
    });
    assert.ok(result.error, '应当返回下载失败');
    // 按段号取第一个失败：第 2 段（不是并发里先跑完的第 3 段）。
    assert.match(result.error, /2\.mp4/);
    assert.ok(!result.error.includes('3.mp4'));
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});
