import './no-network-analytics.mjs';
import { sourceOf } from './source.mjs';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { EventEmitter } from 'node:events';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { apply } from '../index.js';

test('Hyperframes is hidden unless the internal environment flag is explicit', () => {
  const key = 'METAONTIC_VIDEO_INTERNAL_HYPERFRAMES';
  const previous = process.env[key];
  try {
    for (const enabled of [false, true]) {
      if (enabled) process.env[key] = '1';
      else delete process.env[key];
      const names = [];
      let prompt;
      apply({
        tools: { register(tool) { names.push(tool.name); return () => {}; } },
        inject(services, install) {
          if (services.includes('systemPrompt')) return install({ systemPrompt: { section(value) { prompt = value; } } });
        },
        on() {},
      });
      assert.equal(names.includes('video_hyperframes'), enabled);
      assert.doesNotMatch(prompt.text(), /hyperframes/i);
    }
  } finally {
    if (previous === undefined) delete process.env[key];
    else process.env[key] = previous;
  }
});

const section = sourceOf('internal/hyperframes').replaceAll('import.meta.url', '"file:///plugin/index.js"');
function load(overrides = {}) {
  return vm.runInNewContext(section + '\n({ hyperframesTool, runHyperframes })', {
    process: { versions: { node: '24.0.0' }, execPath: '/host/node', cwd: () => '/tmp', env: {} },
    path, setTimeout, clearTimeout, resolveBinary: (_c, _key, fallback) => fallback,
    createRequire: () => ({ resolve: () => '/plugin/node_modules/hyperframes/package.json' }),
    ...overrides,
  });
}

test('old host runtime returns actionable status without starting a process', async () => {
  const { hyperframesTool } = load({ process: { versions: { node: '20.20.2' } } });
  assert.equal((await hyperframesTool({}, {}).execute({}, {})).status, 'runtime_unsupported');
});

test('host process launches CLI without shell or system node; cancellation kills it', async () => {
  let binary, args, options;
  const child = new EventEmitter();
  child.stdout = new EventEmitter(); child.stderr = new EventEmitter();
  child.kill = signal => { assert.equal(signal, 'SIGTERM'); queueMicrotask(() => child.emit('close', 1)); };
  const { runHyperframes } = load({ spawn(b, a, o) { binary = b; args = a; options = o; return child; } });
  const controller = new AbortController();
  const pending = runHyperframes('/plugin/cli.mjs', ['render', '/tmp/a;echo x'], '/tmp', {}, controller.signal);
  assert.equal(binary, '/host/node');
  assert.equal(args[2], '/tmp/a;echo x');
  assert.equal(options.shell, undefined);
  assert.equal(options.env.ELECTRON_RUN_AS_NODE, '1');
  assert.equal(options.env.HYPERFRAMES_FFMPEG_PATH, undefined);
  assert.equal(options.env.HYPERFRAMES_NO_TELEMETRY, '1');
  controller.abort();
  await assert.rejects(pending, /取消/);
});

test('render rejects path traversal and overwriting before CLI starts', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'hf-test-'));
  try {
    await writeFile(path.join(dir, 'index.html'), '<html></html>');
    await writeFile(path.join(dir, 'existing.mp4'), 'existing');
    const fs = await import('node:fs/promises');
    const { hyperframesTool } = load({ stat: fs.stat, mkdir, spawn() { throw new Error('must not spawn'); } });
    const tool = hyperframesTool({}, {});
    await assert.rejects(tool.execute({ action: 'render', projectDir: dir, output: '../out.mp4' }, {}), /输出必须/);
    await assert.rejects(tool.execute({ action: 'render', projectDir: dir, output: 'existing.mp4' }, {}), /已存在/);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
