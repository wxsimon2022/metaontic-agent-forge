import './no-network-analytics.mjs';
import assert from 'node:assert/strict';
import { test, after } from 'node:test';
import { build } from 'esbuild';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { pathToFileURL } from 'node:url';
const directory = await mkdtemp(path.join(os.tmpdir(), '业务框架 test '));
const before = process.env.DSH_HOME;
process.env.DSH_HOME = directory;
after(async () => {
  if (before === undefined) delete process.env.DSH_HOME; else process.env.DSH_HOME = before;
  await rm(directory, { recursive: true, force: true });
});
await build({ stdin: { contents: `
export * from './src/core/runtime.ts';
export * from './src/core/agent-registry.ts';
export * from './src/client/runtime.ts';
export * from './src/businesses/video/index.ts';
export {isVideoDirector} from './src/businesses/video/prompts/scope.ts';
export {agents} from './src/agents/index.ts';
`, resolveDir: process.cwd() }, bundle: true, platform: 'node', format: 'esm', outfile: path.join(directory, 'api.mjs') });
const api = await import(pathToFileURL(path.join(directory, 'api.mjs')));
const agent = (id, businesses, extra = {}) => ({ id, name: id, businesses, skills: [], icon: '', ...extra });
function host(selected = 'writer') {
  const tools = new Map(), cleaned = [], warnings = [], events = new Map();
  let prompt;
  const ctx = {
    get: name => name === 'agentPresets' ? { presetForSession: () => selected } : undefined,
    tools: { register(tool) { tools.set(tool.name, tool); return () => { cleaned.push(tool.name); tools.delete(tool.name); }; } },
    on(name, handler) { events.set(name, handler); return () => events.delete(name); },
    inject(names, install) { if (names.includes('systemPrompt')) return install({ systemPrompt: { section(value) { prompt = value; return () => { prompt = null; }; } } }); },
    logger: { warn: message => warnings.push(message) },
  };
  return { ctx, tools, cleaned, warnings, events, select: id => { selected = id; }, text: () => prompt?.text({ agent: { session: { header: { agentPreset: 'old' } } } }) };
}
const exec = { agent: { session: { header: { agentPreset: 'old' } } } };
function business(id) {
  return { id, prompt: config => `${id}:${config.value}`, apply(runtime) {
    runtime.tools.register(id, { name: `${id}_run`, description: id, execute: args => ({ status: 'succeeded', value: args.value }) });
  } };
}
test('two businesses share a runtime while tool scope and live prompts follow the current agent', async () => {
  const h = host();
  const config = { value: 'one' };
  const apply = api.createPluginRuntime({ agents: [agent('writer', ['writing']), agent('seller', ['commerce']), agent('both', ['writing', 'commerce'])], businesses: [business('writing'), business('commerce')] });
  const dispose = apply(h.ctx, config);
  assert.equal(h.text(), 'writing:one');
  assert.deepEqual(await h.tools.get('writing_run').execute({ value: 'article' }, exec), { status: 'succeeded', value: 'article' });
  await assert.rejects(h.tools.get('commerce_run').execute({}, exec), /当前助手未启用此业务/);
  h.select('seller'); config.value = 'two';
  assert.equal(h.text(), 'commerce:two');
  await assert.rejects(h.tools.get('writing_run').execute({}, exec), /当前助手未启用此业务/);
  h.select('both'); assert.equal(h.text(), 'writing:two\n\ncommerce:two');
  h.select(null); assert.equal(h.text(), '');
  assert.equal((await h.tools.get('writing_run').execute({ value: 'manual' }, exec)).value, 'manual');
  h.select('unknown'); assert.equal(h.text(), '');
  dispose(); dispose();
  assert.equal(h.tools.size, 0); assert.equal(h.cleaned.length, 2); assert.equal(h.text(), undefined);
});
test('a third video agent inherits video behavior without modifying video business identity checks', async () => {
  const h = host('tutorial-video');
  const dispose = api.createPluginRuntime({ agents: [agent('tutorial-video', ['video'], { prompt: () => '教程专题' }), agent('writer', ['writing'])], businesses: [api.videoBusiness, business('writing')] })(h.ctx, { model: 'seedance-2.5' });
  try {
    assert.equal(api.isVideoDirector(exec, h.ctx), true);
    assert.match(h.text(), /总时长 ≤ 30 秒/); assert.match(h.text(), /教程专题/);
    h.select('writer'); assert.equal(api.isVideoDirector(exec, h.ctx), false);
    assert.doesNotMatch(h.text(), /视频创作/);
    await assert.rejects(h.tools.get('video_config')?.execute({}, exec) || h.tools.get('video_status').execute({}, exec), /当前助手未启用此业务/);
    const gate = h.events.get('tools/pre-execute');
    assert.equal((await gate({ ...exec, name: 'video_generate' }, () => ({ kind: 'allow' }))).kind, 'deny');
    assert.equal((await gate({ ...exec, name: 'ask_user_question' }, () => ({ kind: 'allow' }))).kind, 'allow');
  } finally { dispose(); }
});
test('duplicate definitions and missing business dependencies fail before host registration', () => {
  assert.throws(() => api.createPluginRuntime({ agents: [agent('a', ['missing'])], businesses: [] }), /缺少业务模块/);
  assert.throws(() => api.createPluginRuntime({ agents: [agent('a', []), agent('a', [])], businesses: [] }), /重复或无效/);
  assert.throws(() => api.createPluginRuntime({ agents: [], businesses: [business('same'), business('same')] }), /重复或无效/);
});
test('tool name collision rolls back previously registered tools and module resources', () => {
  const h = host(); let released = false;
  const first = { ...business('writing'), apply(runtime) { business('writing').apply(runtime); runtime.defer(() => { released = true; }); } };
  const second = { id: 'other', apply(runtime) { runtime.tools.register('other', { name: 'writing_run', description: '', execute() {} }); } };
  assert.throws(() => api.createPluginRuntime({ agents: [], businesses: [first, second] })(h.ctx), /工具名称重复/);
  assert.equal(h.tools.size, 0); assert.equal(released, true); assert.deepEqual(h.cleaned, ['writing_run']);
});
test('partial business registration failure and cleanup errors do not leak other resources', () => {
  const h = host(); let cleaned = 0;
  const module = { id: 'broken', apply(runtime) {
    business('broken').apply(runtime);
    runtime.defer(() => { cleaned++; });
    runtime.defer(() => { throw new Error('cleanup failure'); });
    throw new Error('registration failure');
  } };
  assert.throws(() => api.createPluginRuntime({ agents: [], businesses: [module] })(h.ctx), /registration failure/);
  assert.equal(h.tools.size, 0); assert.equal(cleaned, 1); assert.equal(h.warnings.length, 1);
});
test('browser modules merge settings pages into one host slot without overwriting each other', () => {
  const registrations = [], dependencies = [];
  const h = (type, props, ...children) => ({ type, props, children });
  function module(id) { return { id, create() { return { inject: ['slots', id], apply(ctx, { settings }) { dependencies.push(id); settings.register({ id, namespace: 'example', Page: function Page() { return id; } }); } }; } }; }
  const plugin = api.createClientRuntime(() => ({ createElement: h }), [module('writing'), module('commerce')]);
  assert.deepEqual(plugin.inject, ['slots', 'writing', 'commerce']);
  plugin.apply({ effect: f => f(), slots: { inject: (_, f) => f(), register: (spec, Page) => registrations.push({ spec, Page }) } });
  assert.deepEqual(dependencies, ['writing', 'commerce']); assert.equal(registrations.length, 1);
  const tree = registrations[0].Page({}); assert.equal(tree.children.length, 2);
  assert.deepEqual(tree.children.map(child => child.type()), ['writing', 'commerce']);
  assert.throws(() => api.createClientRuntime(() => ({}), [module('same'), module('same')]), /重复或无效/);
});
test('built-in agent declarations agree with shipped preset, icon, locale and skill resources', async () => {
  const patch = await readFile('cordis.patch.yml', 'utf8');
  const pkg = JSON.parse(await readFile('package.json', 'utf8'));
  for (const definition of api.agents) {
    assert.ok(patch.includes(`id: ${definition.id}`));
    assert.equal(JSON.parse(await readFile(`locale/presets/${definition.id}/zh.json`, 'utf8')).meta.title, definition.name);
    assert.ok(pkg.exports[`./presets/${definition.id}`]);
    assert.ok((await readFile(definition.icon, 'utf8')).includes('<svg'));
    for (const skill of definition.skills) assert.ok((await readFile(`skills/${skill}/SKILL.md`, 'utf8')).length > 0);
  }
});
test('the shared host framework builds without importing any business or built-in agent', async () => {
  const result = await build({ entryPoints: ['src/core/runtime.ts'], bundle: true, platform: 'node', format: 'esm', write: false, metafile: true });
  for (const input of Object.keys(result.metafile.inputs)) assert.doesNotMatch(input, /src\/(businesses|agents)\//);
});
test('overlapping hot reloads cannot restore a registry whose runtime was already disposed', () => {
  const ctx = {}, fallback = api.createAgentRegistry([]);
  const first = api.createAgentRegistry([agent('first', [])]), second = api.createAgentRegistry([agent('second', [])]);
  const stopFirst = api.bindAgentRegistry(ctx, first), stopSecond = api.bindAgentRegistry(ctx, second);
  stopFirst(); assert.equal(api.registryForContext(ctx, fallback), second);
  stopSecond(); assert.equal(api.registryForContext(ctx, fallback), fallback);
});
