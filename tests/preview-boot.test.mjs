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
  for (const key of ['metaontic-video', 'video_generate', 'video_extend', 'video_status', 'metaontic-video-progress']) {
    assert.equal(typeof components[key], 'function', key);
  }
  assert.equal(host.locale.bind('settings.metaonticVideo')('save'), '保存');
  assert.equal(host.locale.bind('settings.metaonticVideo')('panelTitle'), '视频创作');
  assert.equal(typeof components['plugins.bundle.config:metaontic-video'], 'function', '设置页');
  assert.equal(typeof components['tool.call.toolview:video_generate'], 'function', '工具卡片');
  assert.equal(typeof components['conversation.input.dock:metaontic-video-progress'], 'function', '输入框进度');
  assert.equal(typeof components['sidebar.panellist:metaontic-video'], 'function', '左侧栏图标');
  assert.equal(typeof components['main:metaontic-video'], 'function', '左侧栏面板本体');
  const panel = components['main:metaontic-video:props']();
  panel.startSession();
  const started = host.calls.at(-1);
  assert.equal(started.action, 'startSession');
  assert.equal(started.workspaceId, undefined);
  assert.equal(started.options.agentPreset, 'video-director');
  panel.openSettings();
  const opened = host.calls.at(-1);
  assert.equal(opened.action, 'openBundle');
  assert.equal(opened.bundle, 'metaontic-video');
});
