import './no-network-analytics.mjs';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { apply } from '../index.js';
test('platform loads alongside legacy video tools without overwriting their registrations', () => {
  const originals = new Map(['video_stage','video_project','video_estimate','media_submission','video_prepare_image','video_generate','video_extend','video_status','video_setup','video_config','send_message','interrupt_agent','list_agents'].map(name => [name, {name, legacy: true}]));
  const registry = new Map(originals);
  const ctx = {
    tools: { register(tool) { assert.equal(registry.has(tool.name),false); registry.set(tool.name,tool); return () => registry.delete(tool.name); } },
    on: () => () => {},
    inject(names, callback) { if (names.includes('settings')) return callback({...ctx,settings:{}}); },
  };
  const dispose = apply(ctx,{});
  const added = [...registry.keys()].filter(name => !originals.has(name));
  assert.equal(added.length,11);
  for (const name of added) {assert.ok(name.startsWith('metaontic_agent_forge_'));assert.ok(name.length<=64);}
  for (const [name,original] of originals) assert.equal(registry.get(name),original);
  dispose();
  assert.equal(registry.size,originals.size);
  for (const [name,original] of originals) assert.equal(registry.get(name),original);
});
