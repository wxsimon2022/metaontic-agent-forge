import { sourceOf } from './source.mjs';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { test } from 'node:test';
const source = readFileSync(new URL('../index.js', import.meta.url), 'utf8');
function harness(write) {
  const c = vm.createContext({
    CONFIG_FIELDS: ['connectionMode', 'metaonticApiKey', 'volcengineApiKey', 'apiKey', 'keyOrigin', 'baseUrl', 'submitPath', 'queryPath', 'deviceSecret', 'deviceId', 'registerEmail', 'registerApi', 'registerToken', 'model'],
    READ_ONLY_CONFIG_FIELDS: new Set(['apiKey', 'keyOrigin', 'deviceId', 'deviceSecret']),
    ref: (config, key, fallback) => config[key] ?? fallback,
    modelMaxSeconds: () => 15, writeProfileConfig: write,
    configView: config => ({ stored: {}, effective: { connectionMode: config.connectionMode } }),
  });
  vm.runInContext(sourceOf('connection-defaults'), c);
  for (const name of ['normalizeConnectionPatch', 'maskSecrets', 'configTool']) {
    const start = source.indexOf(`function ${name}(`);
    vm.runInContext(source.slice(start, source.indexOf('\n}', start) + 2), c);
  }
  return c;
}
test('video_config clears inactive credentials in the same persisted patch and masks its result', async () => {
  let written;
  const c = harness(async (_settings, _config, patch) => { written = patch; return 'plugin'; });
  const result = await c.configTool({ connectionMode: 'service', apiKey: 'old' }, {}).execute({ action: 'set', connectionMode: 'metaontic', metaonticApiKey: 'secret-new' });
  assert.equal(written.metaonticApiKey, 'secret-new');
  for (const key of ['apiKey', 'volcengineApiKey', 'deviceSecret', 'keyOrigin']) assert.equal(written[key], '');
  assert.equal(result.effective.connectionMode, 'metaontic');
  assert.equal(JSON.stringify(result).includes('secret-new'), false);
});
test('video_config keeps unrelated edits scoped and reports persistence failures', async () => {
  const c = harness(async () => { throw new Error('disk failure'); });
  assert.equal(c.normalizeConnectionPatch({}, { model: 'new' }).model, 'new');
  assert.throws(() => c.normalizeConnectionPatch({}, { connectionMode: 'wrong' }), /未知/);
  await assert.rejects(c.configTool({}, {}).execute({ action: 'set', connectionMode: 'volcengine' }), /disk failure/);
});
