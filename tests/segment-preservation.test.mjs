import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import vm from 'node:vm';
import { sourceOf } from './source.mjs';

for (const cumulative of [false, true]) for (const cuts of [false, true]) {
  test(`delivery retains both source segments (${cumulative ? 'cumulative output' : 'incremental output'}, cuts=${cuts})`, async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'mv-preserve-'));
    try {
      const segmentsDir = path.join(dir, 'segments');
      await fs.mkdir(segmentsDir);
      const originals = ['01-generate.mp4', '02-extend.mp4'].map(name => path.join(segmentsDir, name));
      await fs.writeFile(originals[0], 'first-source');
      await fs.writeFile(originals[1], 'second-source');
      const source = sourceOf('media/merge');
      const context = vm.createContext({
        timedStage: async (_stage, operation) => operation(),
        ref: (config, key, fallback) => config[key] ?? fallback,
        path, ...fs, appendRequestLog: async () => {}, exists: async file => { try { await fs.stat(file); return true; } catch { return false; } },
        hasFfmpeg: async () => true,
        probeMedia: async file => ({durationSeconds: file === originals[1] && cumulative ? 30 : 15}),
        CUMULATIVE_TOLERANCE_MIN_SECONDS: 1.5, CUMULATIVE_TOLERANCE_RATIO: 0.25,
        formatSeconds: String,
        prepareSeamTrims: async (_config, files) => ({files, temps: [], cuts: cuts ? [{ index: 2, seconds: 0.5, tailSeconds: 0 }] : []}),
        cleanupSegmentTemps: async () => {},
        mergeClips: async (_config, files, out) => {
          assert.equal(_config.mergeMode, 'reencode');
          await fs.writeFile(out, (await Promise.all(files.map(file => fs.readFile(file)))).join('|'));
          return {mode:'copy'};
        },
      });
      const start = source.indexOf('async function downloadSegmentsAndMerge(');
      vm.runInContext(source.slice(start), context);
      const result = await context.downloadSegmentsAndMerge({ mergeMode: 'reencode', keepSegments: false, seamTrimSeconds: cuts ? '0.5' : '0' }, {
        segments: [{index:1,kind:'generate',seconds:15},{index:2,kind:'extend',seconds:15}],
        segmentsDir, outDir:dir, stamp:'test',
      });
      assert.equal(result.merged, true);
      assert.equal(await fs.readFile(originals[0], 'utf8'), 'first-source');
      assert.equal(await fs.readFile(originals[1], 'utf8'), 'second-source');
      assert.ok((await fs.stat(result.videoPath)).size > 0);
      assert.notEqual(result.videoPath, originals[1]);
    } finally { await fs.rm(dir, {recursive:true,force:true}); }
  });
}
