import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import vm from 'node:vm';
import { AsyncLocalStorage } from 'node:async_hooks';
import { sourceOf } from './source.mjs';

function harness({ mkdir } = {}) {
  const state = { dirs: [], writes: [], failDir: false, failWrite: false };
  const context = vm.createContext({
    AsyncLocalStorage, path, PLUGIN_VERSION: 'test',
    dshHome: () => '/home/.dsh',
    mkdir: async (dir, options) => {
      state.dirs.push(dir);
      if (state.failDir) throw new Error('read-only');
      return mkdir ? mkdir(dir, options) : undefined;
    },
    appendFile: async (file, text, options) => {
      state.writes.push({ file, text, options });
      if (state.failWrite) throw new Error('read-only');
    },
  });
  vm.runInContext(`${sourceOf('utils/logging')}\nObject.assign(globalThis,{appendRequestLog,requestLogPath});`, context);
  return { context, state };
}

test('日志目录每天只建一次，正文仍逐条追加', async () => {
  const { context, state } = harness();
  await context.appendRequestLog({ event: 'a' });
  await context.appendRequestLog({ event: 'b' });
  await context.appendRequestLog({ event: 'c' });
  assert.equal(state.dirs.length, 1, '同一目录不该反复 mkdir');
  assert.equal(state.dirs[0], path.dirname(context.requestLogPath()));
  assert.equal(state.writes.length, 3);
  assert.deepEqual(state.writes.map(({ options }) => options.mode), [0o600, 0o600, 0o600]);
  assert.match(state.writes[0].text, /"event":"a"/);
});

test('日志写不进去不抛错，且下次仍会重试建目录', async () => {
  const { context, state } = harness();
  state.failDir = true;
  await context.appendRequestLog({ event: 'a' });
  assert.equal(state.writes.length, 0);
  state.failDir = false;
  await context.appendRequestLog({ event: 'b' });
  assert.equal(state.dirs.length, 2, '建目录失败后不能记住成功状态');
  assert.equal(state.writes.length, 1);
  state.failWrite = true;
  await context.appendRequestLog({ event: 'c' });
});
