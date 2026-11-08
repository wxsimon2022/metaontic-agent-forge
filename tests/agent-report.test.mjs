import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { apply } from '../presets/metaontic-agent-forge-report.js';

test('specialists preserve native message identity, route results and dispose registrations', async () => {
  const sent = [], registered = new Map(), disposers = [];
  const native = { name: 'send_message', execute: (args, exec) => exec.agent.send(args) };
  const ctx = {
    tools: { register(definition) {
      registered.set(definition.name, definition);
      const dispose = () => registered.delete(definition.name);
      disposers.push(dispose);
      return dispose;
    } },
    loader: { async import(id) {
      assert.equal(id, '@deepseek-ai/dsh-tool-subagent-control');
      return { async apply(scoped) {
        await Promise.resolve();
        for (const tool of [native, { name: 'list_agents' }, { name: 'interrupt_agent' }]) scoped.tools.register(tool);
      } };
    } },
  };
  await apply(ctx);
  assert.deepEqual([...registered.keys()], ['send_message']);
  assert.equal(registered.get('send_message'), native, 'host routing brand must survive unchanged');
  await registered.get('send_message').execute({ agent_id: 'parent', message: 'waiting for script review' }, { agent: { send: args => sent.push(args) } });
  assert.deepEqual(sent, [{ agent_id: 'parent', message: 'waiting for script review' }]);
  disposers.forEach(dispose => dispose());
  assert.equal(registered.size, 0);
});

test('both specialist presets share the return channel, packaged through an exported entry', async () => {
  const patch = await readFile(new URL('../cordis.patch.yml', import.meta.url), 'utf8');
  assert.match(patch, /plugins: &metaontic-agent-forge-video-plugins\s+- id: metaontic-agent-forge-report\s+name: 'metaontic-agent-forge\/presets\/metaontic-agent-forge-report'/);
  assert.match(patch, /plugins: \*metaontic-agent-forge-video-plugins/);
  assert.ok(import.meta.resolve('metaontic-agent-forge/presets/metaontic-agent-forge-report'));
});
