import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { test } from 'node:test';
import * as plugin from '../index.js';

// Harness only accepts scalar type strings; nullable unions must use oneOf.
function assertScalarSchemaTypes(schema) {
  if (!schema || typeof schema !== 'object') return;
  if (Object.hasOwn(schema, 'type')) assert.equal(typeof schema.type, 'string', 'Harness rejects type arrays');
  for (const child of Object.values(schema.properties || {})) assertScalarSchemaTypes(child);
  if (schema.items) assertScalarSchemaTypes(schema.items);
  for (const child of schema.oneOf || []) assertScalarSchemaTypes(child);
}

function harness(config, directory) {
  const tools = new Map();
  let prompt, gate;
  let disposed = 0;
  const ctx = {
    tools: { register(tool) { assertScalarSchemaTypes(tool.output?.schema); tools.set(tool.name, tool); return () => { disposed++; }; } },
    inject(names, install) {
      const services = {
        settings: {},
        workingDirectory: { ensure: async () => directory },
        systemPrompt: { section(value) { prompt = value; return () => {}; } },
      };
      return install({ ...ctx, ...services });
    },
    on(_event, listener) { gate = listener; return () => {}; },
  };
  const dispose = plugin.apply(ctx, config);
  return { tools, prompt: () => prompt.text(), gate: (...args) => gate(...args), dispose, disposed: () => disposed };
}

test('published host preserves schema, tool registration, live configuration and cleanup', async () => {
  assert.deepEqual(Object.keys(plugin).sort(), ['Config', 'apply', 'inject']);
  assert.ok(plugin.Config);
  const config = { connectionMode: 'metaontic', metaonticApiKey: 'test', model: 'seedance-2-0' };
  const host = harness(config, '/tmp');
  assert.deepEqual([...host.tools.keys()].sort(), ['media_submission', 'video_config', 'video_estimate', 'video_extend', 'video_generate', 'video_prepare_image', 'video_setup', 'video_stage', 'video_status']);
  assert.match(host.prompt(), /直出上限 15 秒/);
  config.model = 'seedance-2-5';
  assert.match(host.prompt(), /直出上限 30 秒/);
  const decision = await host.gate({ name: 'video_generate', arguments: { duration: 5, referenceImages: ['https://media.invalid/approved.png'] } });
  assert.equal(decision.kind, 'ask');
  assert.match(decision.displayReason.zh, /实际用量计费/);
  host.dispose();
  assert.equal(host.disposed(), 9);
});

for (const mode of ['metaontic', 'volcengine']) test(`${mode}: bundled tools submit, query, pause, resume and extend through split modules`, async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'mv-integration-'));
  const previousFetch = globalThis.fetch;
  const previousHome = process.env.DSH_HOME;
  const submissions = [];
  let count = 0;
  process.env.DSH_HOME = directory;
  globalThis.fetch = async (input, options = {}) => {
    const url = String(input);
    if (url.startsWith('https://media.invalid/')) return new Response('test media bytes', { headers: { 'content-type': 'video/mp4' } });
    assert.match(url, /\/contents\/generations\/tasks/);
    assert.equal(options.headers.Authorization, 'Bearer test-key');
    if (options.method === 'POST') {
      submissions.push(JSON.parse(options.body));
      return Response.json({ id: `task-${++count}` });
    }
    const id = url.split('/').at(-1);
    return Response.json({ id, status: 'succeeded', content: { video_url: `https://media.invalid/${id}.mp4` } });
  };
  try {
    const config = {
      connectionMode: mode, apiKey: 'test-key', keyOrigin: 'register',
      metaonticApiKey: 'test-key', volcengineApiKey: 'test-key',
      baseUrl: 'https://api.invalid', model: 'doubao-seedance-2-0-mini-260615',
      outputDir: directory, ffmpegBinary: '/missing/ffmpeg', ffprobeBinary: '/missing/ffprobe',
    };
    const host = harness(config, directory);
    const exec = { callId: 'test-call', agent: {} };
    const generated = await host.tools.get('video_generate').execute({ prompt: 'A title', duration: 5 }, exec);
    assert.equal(generated.status, 'succeeded');
    assert.equal(submissions.length, 1);
    assert.equal(submissions[0].duration, 5);
    assert.equal(submissions[0].resolution, '720p');
    assert.ok((await stat(generated.videoPath)).size);
    const queried = await host.tools.get('video_status').execute({ taskId: 'task-1' }, exec);
    assert.equal(queried.status, 'succeeded');
    assert.equal(submissions.length, 1);

    const first = await host.tools.get('video_generate').execute({
      prompt: 'Continuous story', duration: 20, segmentPrompts: ['First part', 'Second part'], merge: false,
    }, exec);
    assert.equal(first.paused, true);
    assert.equal(submissions.length, 2);
    const record = JSON.parse(await readFile(path.join(first.resumeDir, 'paused-plan.json'), 'utf8'));
    assert.equal(record.done, 1);
    // 每段确认接在 resume 入口：点「继续」后、提交下一段前，由代码弹一次说得清的确认，
    // 而不是只靠提示词让模型自己问。
    const resumeGate = await host.gate({
      name: 'video_generate',
      arguments: { resume: first.resumeDir, merge: false, referenceImages: ['https://media.invalid/approved.png'] },
    });
    assert.equal(resumeGate.kind, 'ask');
    assert.match(resumeGate.displayReason.zh, /第 1 段（15 秒）已经生成好/);
    assert.match(resumeGate.displayReason.zh, /接下来生成第 2 段（5 秒）/);
    assert.match(resumeGate.displayReason.zh, /整条还差 5 秒/);
    assert.match(resumeGate.displayReason.zh, /拒绝/);
    // 不是续做的调用不该出现续做说明
    const freshGate = await host.gate({
      name: 'video_generate',
      arguments: { duration: 5, referenceImages: ['https://media.invalid/approved.png'] },
    });
    assert.equal(freshGate.kind, 'ask');
    assert.doesNotMatch(freshGate.displayReason.zh, /已经生成好/);
    const continued = await host.tools.get('video_generate').execute({ resume: first.resumeDir, merge: false }, exec);
    assert.equal(continued.status, 'succeeded');
    assert.equal(continued.paused, undefined);
    assert.equal(submissions.length, 3);
    assert.equal(submissions[2].duration, 5);
    assert.equal(submissions[2].content.find(part => part.type === 'video_url').video_url.url, 'https://media.invalid/task-2.mp4');
    await assert.rejects(stat(path.join(first.resumeDir, 'resume.lock')), { code: 'ENOENT' });

    const extended = await host.tools.get('video_extend').execute({
      videoUrl: 'https://media.invalid/task-1.mp4', prompt: 'Continue walking', duration: 5, merge: false,
    }, exec);
    assert.equal(extended.status, 'succeeded');
    assert.equal(submissions.length, 4);
    assert.equal(submissions[3].content.find(part => part.type === 'video_url').video_url.url, 'https://media.invalid/task-1.mp4');
    host.dispose();
  } finally {
    globalThis.fetch = previousFetch;
    if (previousHome === undefined) delete process.env.DSH_HOME;
    else process.env.DSH_HOME = previousHome;
    await rm(directory, { recursive: true, force: true });
  }
});

// 服务端方式（service）暂时停用：确认框直接拒绝，也不会真的提交任务。
test('service: bundled host refuses the temporarily unavailable server method', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'mv-integration-off-'));
  const previousFetch = globalThis.fetch;
  const previousHome = process.env.DSH_HOME;
  let requests = 0;
  process.env.DSH_HOME = directory;
  globalThis.fetch = async () => { requests++; return Response.json({}); };
  try {
    const config = {
      connectionMode: 'service', apiKey: 'test-key', keyOrigin: 'register', deviceId: 'd', deviceSecret: 's', registerEmail: 'a@b.c',
      deviceFingerprint: 'f', model: 'doubao-seedance-2-0-mini-260615', outputDir: directory,
      ffmpegBinary: '/missing/ffmpeg', ffprobeBinary: '/missing/ffprobe',
    };
    const host = harness(config, directory);
    const gate = await host.gate({ name: 'video_generate', arguments: { duration: 5 } });
    assert.equal(gate.kind, 'deny');
    assert.match(gate.reason, /暂时不可用/);
    await assert.rejects(host.tools.get('video_generate').execute({ prompt: 'A title', duration: 5 }, { callId: 'off', agent: {} }), /暂时不可用/);
    assert.equal(requests, 0);
    host.dispose();
  } finally {
    globalThis.fetch = previousFetch;
    if (previousHome === undefined) delete process.env.DSH_HOME;
    else process.env.DSH_HOME = previousHome;
    await rm(directory, { recursive: true, force: true });
  }
});
