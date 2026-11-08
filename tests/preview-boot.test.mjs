import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createPreviewHost } from '../preview/host.mjs';

test('standalone preview host mounts the real client and registers settings and progress views', () => {
  // 把 slot 注册项按 名称:key 存下来，便于分别断言设置页、进度视图与左侧栏面板。
  let entry;
  vm.runInNewContext(readFileSync(new URL('../client.js', import.meta.url), 'utf8'), {
    window: { __ModuleLoader__: { load(value) { entry = value; } } },
  });
  const plugin = entry.factory(() => ({ createElement() {} }));
  const components = {}, dictionaries = {};
  const host = createPreviewHost({ form: {}, components, dictionaries, getLocale: () => 'zh', onUpdate() {} });
  for (const service of plugin.inject) assert.ok(host[service], service);
  assert.doesNotThrow(() => plugin.apply(host));
  for (const key of ['metaontic-agent-forge', 'metaontic_agent_forge_video_generate', 'metaontic_agent_forge_video_extend', 'metaontic_agent_forge_video_status', 'metaontic-agent-forge-progress']) {
    assert.equal(typeof components[key], 'function', key);
  }
  assert.equal(host.locale.bind('settings.metaonticAgentForge')('save'), '保存');
  assert.equal(host.locale.bind('platform.metaonticAgentForge')('panelTitle'), '云智工坊 · 智能体平台');
  assert.equal(typeof components['plugins.bundle.config:metaontic-agent-forge'], 'function', '设置页');
  assert.equal(typeof components['tool.call.toolview:metaontic_agent_forge_video_generate'], 'function', '工具卡片');
  assert.equal(typeof components['conversation.input.dock:metaontic-agent-forge-progress'], 'function', '输入框进度');
  assert.equal(typeof components['sidebar.panellist:metaontic-agent-forge'], 'function', '左侧栏图标');
  assert.equal(typeof components['main:metaontic-agent-forge'], 'function', '左侧栏面板本体');
  const panel = components['main:metaontic-agent-forge:props']();
  panel.startSession();
  const started = host.calls.at(-1);
  assert.equal(started.action, 'startSession');
  assert.equal(started.workspaceId, undefined);
  assert.equal(started.options.agentPreset, 'metaontic-agent-forge-studio');
  panel.openSettings();
  const opened = host.calls.at(-1);
  assert.equal(opened.action, 'openBundle');
  assert.equal(opened.bundle, 'metaontic-agent-forge');
});
