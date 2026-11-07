import { workflowApi } from './workflow-test-api.mjs';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { test } from 'node:test';
import * as plugin from '../index.js';
import { sourceOf } from './source.mjs';

async function fixture(run) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'mv-recovery-'));
  const previousFetch = globalThis.fetch;
  const oldHome = process.env.DSH_HOME;
  process.env.DSH_HOME = directory;
  const config = { connectionMode: 'metaontic', metaonticApiKey: 'secret-test-key', model: 'seedance-2-0',
    baseUrl: 'https://api.invalid', outputDir: directory, ffmpegBinary: '/missing/ffmpeg', ffprobeBinary: '/missing/ffprobe' };
  const tools = new Map();
  let gate;
  const ctx = { tools: { register(tool) { tools.set(tool.name, tool); return () => {}; } },
    inject(names, install) {
      if (names.includes('workingDirectory')) return install({ workingDirectory: { ensure: async () => directory } });
    }, on(_name, listener) { gate = listener; return () => {}; } };
  const dispose = plugin.apply(ctx, config);
  for (const name of ['video_generate','video_extend']) tools.set(name,workflowApi.lowLevelVideo(name,config,ctx));
  const state = { creates: 0, downloads: 0, failDownload: false, stopController: null, queryFailure: false };
  globalThis.fetch = async (input, options = {}) => {
    const url = String(input);
    if (url.startsWith('https://media.invalid/')) {
      state.downloads++;
      return state.failDownload ? new Response('failed', { status: 503 }) : new Response('fake-media');
    }
    if (options.method === 'POST') return Response.json({ id: `task-${++state.creates}` });
    if (state.stopController) { state.stopController.abort(); throw new DOMException('Stopped', 'AbortError'); }
    if (state.queryFailure) return Response.json({ error: { message: 'invalid query' } }, { status: 400 });
    return Response.json({ status: 'succeeded', content: { video_url: `https://media.invalid/${url.split('/').at(-1)}.mp4` } });
  };
  const execute = (name, args, signal) => tools.get(name).execute(args, { callId: 'test', agent: {}, signal });
  const record = async dir => JSON.parse(await readFile(path.join(dir, 'paused-plan.json'), 'utf8'));
  try { await run({ execute, record, config, state, tools, gate }); }
  finally {
    dispose(); globalThis.fetch = previousFetch;
    if (oldHome === undefined) delete process.env.DSH_HOME; else process.env.DSH_HOME = oldHome;
    await rm(directory, { recursive: true, force: true });
  }
}

for (const name of ['video_generate', 'video_extend']) {
  const initial = name === 'video_generate'
    ? { prompt: 'story', duration: 20, segmentPrompts: ['start', 'end'] }
    : { prompt: 'continue', duration: 5, segments: 2, videoUrl: 'https://media.invalid/source.mp4' };

  test(`${name}: delivery failure keeps cursor; delivery retry and completed replay never submit again`, () => fixture(async h => {
    h.state.failDownload = true;
    const first = await h.execute(name, initial);
    assert.ok(first.deliveryError);
    assert.equal(first.paused, true);
    assert.equal((await h.record(first.resumeDir)).done, 1);
    assert.equal((await h.record(first.resumeDir)).deliveryPending, true);
    h.state.failDownload = false;
    const delivered = await h.execute(name, { resume: first.resumeDir });
    assert.ok(delivered.previewPath || delivered.videoPath);
    assert.equal(delivered.paused, true);
    assert.equal(h.state.creates, 1);
    assert.equal((await h.record(first.resumeDir)).deliveryPending, false);
    const final = await h.execute(name, { resume: first.resumeDir, merge: false });
    assert.equal(h.state.creates, 2);
    assert.equal(final.paused, undefined);
    assert.equal((await h.record(first.resumeDir)).state, 'completed');
    for (let n = 0; n < 2; n++) await h.execute(name, { resume: first.resumeDir });
    assert.equal(h.state.creates, 2);
    assert.equal((await h.record(first.resumeDir)).options.merge, false);
    assert.doesNotMatch(JSON.stringify(await h.record(first.resumeDir)), /secret-test-key/);
  }));

  test(`${name}: stopped polling persists task ID and resumes with GET only`, () => fixture(async h => {
    const controller = new AbortController();
    h.state.stopController = controller;
    const first = await h.execute(name, { ...initial, merge: false }, controller.signal);
    assert.equal(first.status, 'unknown');
    assert.equal(first.pendingTaskId, 'task-1');
    assert.equal((await h.record(first.resumeDir)).pendingTask.taskId, 'task-1');
    const decision = await h.gate({ name, arguments: { resume: first.resumeDir } });
    assert.equal(decision.kind, 'allow');
    h.config.model = 'seedance-2-5';
    await assert.rejects(h.execute(name, { resume: first.resumeDir, resumeWithCurrentConfig: true }), /恢复原模型/);
    h.config.model = 'seedance-2-0';
    h.state.stopController = null;
    const resumed = await h.execute(name, { resume: first.resumeDir });
    assert.equal(resumed.status, 'succeeded');
    assert.equal(resumed.paused, true);
    assert.equal(h.state.creates, 1);
    assert.equal((await h.record(first.resumeDir)).done, 1);
    assert.equal((await h.record(first.resumeDir)).pendingTask, null);
  }));

  test(`${name}: prompt optional only with resume; changed channel requires explicit confirmation`, () => fixture(async h => {
    assert.deepEqual(h.tools.get(name).parameters.required, []);
    await assert.rejects(h.execute(name, {}), /prompt 不能为空/);
    assert.equal(h.state.creates, 0);
    const first = await h.execute(name, { ...initial, merge: false });
    h.config.baseUrl = 'https://changed.invalid';
    await assert.rejects(h.execute(name, { resume: first.resumeDir }), /先向用户说明/);
    assert.equal(h.state.creates, 1);
    const last = await h.execute(name, { resume: first.resumeDir, resumeWithCurrentConfig: true });
    assert.equal(last.status, 'succeeded');
    assert.equal(h.state.creates, 2);
  }));
}

test('resume target cannot exceed 120 seconds even for 2.5', () => {
  const h = vm.createContext({ characterChoiceGate: async () => null, MAX_SEGMENTS: 10, MAX_TOTAL_SECONDS: 120, MIN_SECONDS: 4, MAX_SEGMENT_SECONDS: 15,
    sumStepSeconds: steps => steps.reduce((n, s) => n + s.seconds, 0) });
  vm.runInContext(sourceOf('workflow/result-state','workflow/resume'), h);
  const result = h.resumePlanFrom({ done: 1, cursor: 30, plan: [{ kind: 'generate', seconds: 30 }] }, { askedTotal: 300, segmentSeconds: 30 });
  assert.equal(result.total, 120);
  assert.equal(result.fullPlan.length, 4);
});

test('resume estimates use actual remaining steps and inherited merge option for both tools', () => fixture(async h => {
  const estimator = vm.createContext({ characterChoiceGate: async () => null,
    resumeDirOf: value => value, readPauseFile: h.record, assertResumeConnection() {},
    resolveSegmentSeconds: () => 15, modelMaxSeconds: () => 15, MAX_SEGMENTS: 10, MIN_SECONDS: 4,
    clampInteger: (value, min, max, fallback) => value == null ? fallback : Math.max(min, Math.min(max, value)),
    sumStepSeconds: steps => steps.reduce((n, s) => n + s.seconds, 0),
    resumePlanFrom: data => ({ plan: data.plan.slice(data.done) }),
  });
  vm.runInContext(sourceOf('workflow/approval'), estimator);
  for (const name of ['video_generate', 'video_extend']) {
    const args = name === 'video_generate'
      ? { prompt: 'story', duration: 20, segmentPrompts: ['first', 'second'] }
      : { prompt: 'continue', duration: 7, segments: 3, videoUrl: 'https://media.invalid/source.mp4' };
    const first = await h.execute(name, { ...args, merge: false });
    const prepared = await estimator.estimateArgsFor(h.config, name, { resume: first.resumeDir });
    assert.equal(prepared.merge, false);
    assert.deepEqual(Array.from(prepared.remainingPlan, step => step.seconds), name === 'video_generate' ? [5] : [7, 7]);
    assert.ok(prepared.remainingPlan.every(step => step.kind === 'extend'));
  }
}));

for (const name of ['video_generate', 'video_extend']) test(`${name}: final-segment delivery failure updates the old cursor before returning`, () => fixture(async h => {
  const initial = name === 'video_generate'
    ? { prompt: 'story', duration: 20, segmentPrompts: ['start', 'end'], merge: false }
    : { prompt: 'continue', duration: 5, segments: 2, videoUrl: 'https://media.invalid/source.mp4', merge: false };
  const first = await h.execute(name, initial);
  h.state.failDownload = true;
  const failed = await h.execute(name, { resume: first.resumeDir, merge: true });
  assert.ok(failed.deliveryError);
  assert.equal(h.state.creates, 2);
  const saved = await h.record(first.resumeDir);
  assert.equal(saved.done, 2);
  assert.equal(saved.state, 'completed');
  assert.equal(saved.deliveryPending, true);
  h.state.failDownload = false;
  await h.execute(name, { resume: first.resumeDir, merge: false });
  assert.equal(h.state.creates, 2);
  assert.equal((await h.record(first.resumeDir)).deliveryPending, false);
}));

test('paused runs download only new clips; cumulative preview never creates the next segment',()=>fixture(async h=>{
  const first=await h.execute('video_generate',{prompt:'three parts',duration:45,segmentPrompts:['one','two','three']});
  assert.equal(first.previewOnly,true);assert.equal(first.merged,false);assert.ok(first.previewPath);assert.equal(first.videoPath,undefined);
  assert.equal(h.state.creates,1);assert.equal(h.state.downloads,1);
  const second=await h.execute('video_generate',{resume:first.resumeDir});
  assert.equal(second.previewOnly,true);assert.equal(h.state.creates,2);assert.equal(h.state.downloads,2);assert.equal(second.remainingSeconds,15);
  const preview=await h.execute('video_generate',{resume:first.resumeDir,cumulativePreview:true});
  assert.equal(h.state.creates,2);assert.equal(preview.paused,true);assert.equal(preview.remainingSeconds,15);
  assert.equal((await h.record(first.resumeDir)).done,2);
  const final=await h.execute('video_generate',{resume:first.resumeDir,merge:false});
  assert.equal(h.state.creates,3);assert.equal(final.paused,undefined);assert.equal(final.segments.length,3);
}));
