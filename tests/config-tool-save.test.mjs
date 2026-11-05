import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { test } from 'node:test';
const source = readFileSync(new URL('../index.js', import.meta.url), 'utf8');
function harness() {
  const c = vm.createContext({
    SERVICE_MODE_AVAILABLE: true, VOLCENGINE_MODE_AVAILABLE: false,
    CONFIG_FIELDS: ['connectionMode', 'apiKey', 'baseUrl'],
    READ_ONLY_CONFIG_FIELDS: new Set(['apiKey']),
    ref: (config, key, fallback) => config[key] ?? fallback,
    modelMaxSeconds: () => 15,
    configView: config => ({ stored: {}, effective: { connectionMode: config.connectionMode } }),
  });
  const start = source.indexOf('function configTool(');
  vm.runInContext(source.slice(start, source.indexOf('\n}', start) + 2), c);
  return c;
}
test('video_config reports the current configuration read-only', async () => {
  const c = harness();
  const tool = c.configTool({ connectionMode: 'service' }, { documentPath: '/tmp/cordis.patch.yml' });
  const result = await tool.execute({ action: 'get' });
  assert.equal(result.action, 'get');
  assert.equal(result.patchPath, '/tmp/cordis.patch.yml');
  assert.equal(result.effective.connectionMode, 'service');
});
test('video_config refuses every conversation-side write and points at the settings page', async () => {
  const c = harness();
  const tool = c.configTool({ connectionMode: 'service' }, {});
  assert.equal(Array.from(tool.parameters.properties.action.enum).join(','), 'get');
  assert.equal(tool.parameters.properties.mode, undefined);
  for (const args of [{ action: 'set', connectionMode: 'metaontic' }, { action: 'set', model: 'new' }, { action: 'set' }]) {
    await assert.rejects(tool.execute(args), /插件配置不能在对话里改/);
  }
  await assert.rejects(tool.execute({ action: 'delete' }), /只能在设置页修改/);
});
