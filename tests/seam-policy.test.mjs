import { sourceOf } from './source.mjs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { test } from 'node:test';
const source = sourceOf('businesses/video/media/merge');
function harness() {
  const commands = [];
  const ctx = vm.createContext({
    ref: (c, k, fallback) => c[k] ?? fallback,
    resolveModel: c => c.model,
    isOmniExtendModel: model => model === '2.5',
    probeMedia: async () => ({ durationSeconds: 15, fps: 24 }),
    uniqueSuffix: x => x, resolveBinary: () => 'ffmpeg', cleanupSegmentTemps: async () => {}, tail: String,
    runProcess: async (_bin, args) => { commands.push(args); return { code: 0 }; },
  });
  const cleanup = ctx.cleanupSegmentTemps;
  vm.runInContext(source, ctx);
  ctx.cleanupSegmentTemps = cleanup;
  return { ctx, commands };
}
test('model defaults, explicit disabling and manual overrides are distinct', async () => {
  for (const [model, trim, expected] of [['2.0', '', 2], ['2.5', '', 0], ['2.0', '0', 0], ['2.5', '0.5', 1]]) {
    const { ctx, commands } = harness();
    const result = await ctx.prepareSeamTrims({ model, seamTrimSeconds: trim }, ['first', 'second'], 'out');
    assert.equal(result.cuts.length, expected); assert.equal(commands.length, expected);
    if (model === '2.0' && trim === '') {
      assert.equal(result.cuts[0].tailSeconds, 6 / 24);
      assert.equal(result.cuts[1].seconds, 1 / 24);
    }
    if (trim === '0.5') { assert.equal(result.cuts[0].index, 2); assert.equal(result.cuts[0].seconds, 0.5); }
  }
});
