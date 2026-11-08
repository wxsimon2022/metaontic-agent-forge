import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { test } from 'node:test';

test('browser bundle loads as a classic Harness script without external imports', () => {
  const source = readFileSync(new URL('../client.js', import.meta.url), 'utf8');
  let entry;
  const script = new vm.Script(source);
  script.runInNewContext({ window: { __ModuleLoader__: { load(value) { entry = value; } } } });
  assert.equal(entry.id, 'metaontic-agent-forge');
  assert.equal(typeof entry.factory, 'function');
});
