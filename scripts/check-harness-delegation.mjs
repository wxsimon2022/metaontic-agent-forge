/** Verify the actual installed Harness delegation adapter without starting an LLM or paid media task. */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
const host = path.resolve(process.argv[2] || '');
if (!process.argv[2]) throw new Error('Pass the Harness runtime directory containing package.json and node_modules');
const require = createRequire(path.join(host, 'package.json'));
const { parseDocument } = require('yaml');
const document = parseDocument(await readFile('cordis.patch.yml', 'utf8'), { customTags: [{ tag: 'tag:yaml.org,2002:js', resolve: value => value }] });
assert.equal(document.errors.length, 0);
const rows = document.toJS()[0].insert;
const presets = rows.filter(row => row.config?.plugins);
assert.deepEqual(presets.map(row => row.config.id), ['metaontic-agent-forge-studio', 'metaontic-agent-forge-video-director', 'metaontic-agent-forge-promo-video']);
assert.deepEqual(presets.map(row => row.config.order), [10, 20, 30]);
const studio = presets.find(row => row.config.id === 'metaontic-agent-forge-studio');
assert.equal(studio.config.name, '云智工坊 · 智能体平台');
const native = await import(pathToFileURL(require.resolve('@deepseek-ai/dsh-tool-subagent')));
const presetModule = await import(pathToFileURL(require.resolve('@deepseek-ai/dsh-agent-preset')));
for (const preset of presets) assert.equal(presetModule.default.Config['~standard'].validate(preset.config).issues, undefined);
const raw = studio.config.plugins.find(row => row.id === 'metaontic-agent-forge-studio-delegation').config;
const parsed = native.Config['~standard'].validate(raw);
assert.equal(parsed.issues, undefined);
assert.deepEqual(parsed.value.allowedAgentPresets, ['metaontic-agent-forge-video-director', 'metaontic-agent-forge-promo-video']);
assert.equal(parsed.value.maxDepth, 1);
for (const preset of presets.filter(row => row !== studio)) assert.equal(preset.config.plugins.some(row => row.name === '@deepseek-ai/dsh-tool-subagent'), false);
const tools = new Map(), starts = [], cleanups = [];
const provider = { name: 'spawn', capabilities: { agentPreset: true, depthLimit: true, agentOptions: true }, inheritsParentContext: false, prepareContinuable() {} };
const presetRegistry = { readDocument: async id => {
  const target = presets.find(row => row.config.id === id);
  if (!target) throw Error('missing preset');
  return target.config;
} };
const messages = [], interrupts = [];
const ctx = {
  get: name => name === 'agentPresets' ? presetRegistry : undefined,
  sessionProjections: { register() {} },
  subagents: {
    sendMessage: async (...args) => { messages.push(args); return 'message-1'; },
    interrupt: (...args) => interrupts.push(args),
    listChildren: async () => [], listDescendants: async () => [],
    getProvider: () => provider, resolveMaxDepth: depth => depth,
    startActivation: async options => { starts.push(options); return { childId: `child-${starts.length}` }; },
  },
  agents: { get: () => undefined },
  tools: { register: tool => { assert.equal(tools.has(tool.name), false, 'Duplicate registered tool: '+tool.name); tools.set(tool.name, tool); return () => tools.delete(tool.name); } },
  systemPrompt: { section() {}, context() {}, getSectionOrder: () => 0, getContextOrder: () => 0 },
  on: () => () => {},
  effect: fn => { const dispose = fn(); if (dispose) cleanups.push(dispose); return dispose; },
};
try {
  await native.apply(ctx, parsed.value, { header: {} });
  const tool = tools.get('metaontic_agent_forge_delegate_agent');
  assert.ok(tool);
  const exec = { agent: { id: 'parent', session: { requestHeader: () => undefined, header: {} }, options: {} }, signal: new AbortController().signal };
  for (const id of ['metaontic-agent-forge-video-director', 'metaontic-agent-forge-promo-video']) {
    const result = await tool.execute({ description: '模拟委派', prompt: '模拟自足需求，不生成实际视频', agent_preset: id }, exec);
    assert.equal(result.subagentId, `child-${starts.length}`);
    const started = starts.at(-1);
    assert.equal(started.delivery, 'parent', 'Completion must be delivered to the parent');
    assert.equal(started.provider, 'spawn');
    assert.equal(started.request.maxDepth, 1);
    assert.equal(started.request.agentPreset, id);
    assert.equal(started.request.parent, exec.agent);
  }
  for (const id of ['metaontic-agent-forge-studio', 'unknown', null]) await assert.rejects(tool.execute({ description: '禁止', prompt: '禁止', agent_preset: id }, exec), /agent_preset/);
  assert.equal(starts.length, 2);
  // Host tools deliberately retain their original names; only platform-owned instances get renamed.
  for (const name of ['send_message','interrupt_agent','list_agents']) tools.set(name, { name, hostOwned: true });
  let adapterSource = await readFile('presets/controls.js', 'utf8');
  adapterSource = adapterSource.replace(/from '(@deepseek-ai[^']+)'/g, (_whole, name) => `from '${pathToFileURL(require.resolve(name)).href}'`);
  const adapter = await import('data:text/javascript;base64,' + Buffer.from(adapterSource).toString('base64'));
  adapter.apply(ctx);
  const marker = await import(pathToFileURL(require.resolve('@deepseek-ai/dsh-subagent/internal')));
  const send = tools.get('metaontic_agent_forge_send_message');
  assert.equal(marker.isAdjacentAgentSendMessageTool(send), true);
  assert.deepEqual(await send.execute({agent_id:'child-1',message:'continue'},exec), {messageId:'message-1'});
  assert.equal(messages[0][0],exec.agent);
  assert.equal(messages[0][1],'child-1');
  assert.deepEqual(await tools.get('metaontic_agent_forge_interrupt_agent').execute({agent_id:'child-1'},exec), {accepted:true});
  assert.equal(interrupts[0][1].agent,exec.agent);
  assert.deepEqual(await tools.get('metaontic_agent_forge_list_agents').execute({},exec), []);
  for (const name of ['send_message','interrupt_agent','list_agents']) assert.equal(tools.get(name).hostOwned,true);

  console.log('PASS actual Harness: YAML/preset schemas, native delegation tool, preset whitelist, spawn routing, absolute depth limit, parent completion delivery and immediate task IDs (simulated service; no LLM/media calls)');
} finally { for (const cleanup of cleanups.reverse()) cleanup(); }
