import './no-network-analytics.mjs';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
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
  let prompt, gate; const observers = [];
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
    get(name) { return name === 'userQuestions' ? { ask: async () => ({answers:[{id:'script_review',selected:['脚本通过']},{id:'segment_result_review',selected:['效果可以，继续下一段']}]}) } : undefined; },
    on(event, listener) { if (event === 'session/event') observers.push(listener); else gate = listener; return () => {}; },
  };
  const dispose = plugin.apply(ctx, config);
  return { tools, observe: (session, event) => Promise.all(observers.map(f => f(session, event))), prompt: () => prompt.text({agent:{session:{header:{agentPreset:'metaontic-agent-forge-video-director'}}}}), gate: (...args) => gate(...args), dispose, disposed: () => disposed };
}

test('published host preserves schema, tool registration, live configuration and cleanup', async () => {
  assert.deepEqual(Object.keys(plugin).sort(), ['Config', 'apply', 'inject']);
  assert.ok(plugin.Config);
  const config = { connectionMode: 'metaontic', metaonticApiKey: 'test', model: 'seedance-2-0' };
  const host = harness(config, '/tmp');
  assert.deepEqual([...host.tools.keys()].sort(), ['metaontic_agent_forge_canvas', 'metaontic_agent_forge_media_submission', 'metaontic_agent_forge_video_config', 'metaontic_agent_forge_video_estimate', 'metaontic_agent_forge_video_extend', 'metaontic_agent_forge_video_generate', 'metaontic_agent_forge_video_prepare_image', 'metaontic_agent_forge_video_project', 'metaontic_agent_forge_video_setup', 'metaontic_agent_forge_video_stage', 'metaontic_agent_forge_video_status']);
  assert.match(host.prompt(), /直出上限 15 秒/);
  config.model = 'seedance-2-5';
  assert.match(host.prompt(), /直出上限 30 秒/);
  const decision = await host.gate({ name: 'metaontic_agent_forge_video_generate', arguments: { duration: 5, referenceImages: ['https://media.invalid/approved.png'] } });
  assert.equal(decision.kind, 'deny');
  assert.match(decision.reason, /projectId/);
  host.dispose();
  assert.equal(host.disposed(), 11);
});

test('conversation stays inside video creation and configuration is read-only in chat', async () => {
  const host = harness({ connectionMode: 'metaontic', metaonticApiKey: 'test' }, '/tmp');
  const prompt = host.prompt();
  assert.match(prompt, /本对话只做视频创作/);
  assert.match(prompt, /与视频创作无关的话题/);
  assert.match(prompt, /只能在插件设置页里改/);
  const tool = host.tools.get('metaontic_agent_forge_video_config');
  assert.equal(Array.from(tool.parameters.properties.action.enum).join(','), 'get');
  const view = await tool.execute({ action: 'get' });
  assert.equal(view.action, 'get');
  assert.ok(view.stored);
  for (const args of [{ action: 'set', model: 'doubao-seedance-2-0-mini-260615' }, { action: 'set', baseUrl: 'https://example.invalid' }, { action: 'set' }]) {
    await assert.rejects(tool.execute(args), /插件配置不能在对话里改/);
  }
  host.dispose();
});

test('style guidance asks only when the idea has no style, then refines along the choice', async () => {
  const host = harness({ connectionMode: 'metaontic', metaonticApiKey: 'test' }, '/tmp');
  const prompt = host.prompt();
  for (const needle of ['style-library.md', '没有指定画面风格', '已经说清风格', '不重复推荐', '写入 script.md 的规格']) {
    assert.ok(prompt.includes(needle), needle);
  }
  const skill = await readFile(new URL('../skills/metaontic-agent-forge-video-director/SKILL.md', import.meta.url), 'utf8');
  const library = await readFile(new URL('../skills/metaontic-agent-forge-video-director/references/style-library.md', import.meta.url), 'utf8');
  assert.match(skill, /\[画面风格库\]\(references\/style-library\.md\)/);
  assert.match(skill, /已经说清风格/);
  assert.match(library, /没有指定画面风格/);
  host.dispose();
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
    const exec = { callId: 'test-call', agent: {session:{id:'integration',header:{cwd:directory}}} };
    async function reviewed(name, supplied) {
      const spec = {ratio:'9:16',resolution:'720p',...supplied};
      const project = await host.tools.get('metaontic_agent_forge_video_project').execute({action:'prepare',subjectType:'scenery',duration:spec.duration*(name==='metaontic_agent_forge_video_extend'?(spec.segments||1):1)},exec);
      const scriptPath=path.join(directory,project.projectId+'.md'), image=path.join(directory,'storyboard.svg');
      await writeFile(scriptPath,'Script '+spec.prompt); await writeFile(image,'<svg/>');
      await host.observe(exec.agent.session,{type:'tool/call',data:{turn:1,name:'metaontic_agent_forge_video_project'}});
      await host.observe(exec.agent.session,{type:'assistant/message',data:{turn:1,message:{content:[{type:'text',text:`Script ${spec.prompt}\n![分镜](<${image}>)`}]}}});
      const review=await host.tools.get('metaontic_agent_forge_video_project').execute({action:'review',projectId:project.projectId,scriptPath,specification:spec,toolName:name},exec);
      assert.equal(review.status,'approved');
      return host.tools.get(name).execute({...spec,projectId:project.projectId},exec);
    }
    const generated = await reviewed('metaontic_agent_forge_video_generate', { prompt: 'A title', duration: 5 });
    assert.equal(generated.status, 'succeeded');
    assert.equal(submissions.length, 1);
    assert.equal(submissions[0].duration, 5);
    assert.equal(submissions[0].resolution, '720p');
    assert.ok((await stat(generated.videoPath)).size);
    const queried = await host.tools.get('metaontic_agent_forge_video_status').execute({ taskId: 'task-1' }, exec);
    assert.equal(queried.status, 'succeeded');
    assert.equal(submissions.length, 1);

    const first = await reviewed('metaontic_agent_forge_video_generate', {
      prompt: 'Continuous story', duration: 20, segmentPrompts: ['First part', 'Second part'], merge: false,
    });
    assert.equal(first.paused, true);
    assert.equal(submissions.length, 2);
    const record = JSON.parse(await readFile(path.join(first.resumeDir, 'paused-plan.json'), 'utf8'));
    assert.equal(record.done, 1);
    // 每段确认接在 resume 入口：点「继续」后、提交下一段前，由代码弹一次说得清的确认，
    // 而不是只靠提示词让模型自己问。
    const unreviewed = await host.gate({ ...exec, name: 'metaontic_agent_forge_video_generate', arguments: {resume:first.resumeDir,merge:false} });
    assert.equal(unreviewed.kind,'deny');assert.match(unreviewed.reason,/结果审核/);
    await assert.rejects(host.tools.get('metaontic_agent_forge_video_generate').execute({resume:first.resumeDir,merge:false},exec),/结果审核/);
    assert.equal(submissions.length,2);
    await host.observe(exec.agent.session,{type:'assistant/message',data:{turn:2,message:{content:[{type:'text',text:`[观看第一段](<${first.segments[0].videoUrl}>)`}]}}});
    const segmentReview=await host.tools.get('metaontic_agent_forge_video_project').execute({action:'review_segment',resume:first.resumeDir},exec);
    assert.equal(segmentReview.status,'approved');
    const resumeGate = await host.gate({
      name: 'metaontic_agent_forge_video_generate',
      agent: exec.agent, arguments: { resume: first.resumeDir, merge: false },
    });
    assert.equal(resumeGate.kind, 'ask');
    assert.match(resumeGate.displayReason.zh, /第 1 段（15 秒）已经生成好/);
    assert.match(resumeGate.displayReason.zh, /接下来生成第 2 段（5 秒）/);
    assert.match(resumeGate.displayReason.zh, /整条还差 5 秒/);
    assert.match(resumeGate.displayReason.zh, /拒绝/);
    // 不是续做的调用不该出现续做说明
    const freshGate = await host.gate({
      name: 'metaontic_agent_forge_video_generate',
      arguments: { duration: 5, referenceImages: ['https://media.invalid/approved.png'] },
    });
    assert.equal(freshGate.kind, 'deny');
    assert.match(freshGate.reason, /projectId/);
    const continued = await host.tools.get('metaontic_agent_forge_video_generate').execute({ resume: first.resumeDir, merge: false }, exec);
    assert.equal(continued.status, 'succeeded');
    assert.equal(continued.paused, undefined);
    assert.equal(submissions.length, 3);
    assert.equal(submissions[2].duration, 5);
    assert.equal(submissions[2].content.find(part => part.type === 'video_url').video_url.url, 'https://media.invalid/task-2.mp4');
    await assert.rejects(stat(path.join(first.resumeDir, 'resume.lock')), { code: 'ENOENT' });

    const extended = await reviewed('metaontic_agent_forge_video_extend', {
      videoUrl: 'https://media.invalid/task-1.mp4', prompt: 'Continue walking', duration: 5, merge: false,
    });
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

// 服务端方式（service）恢复提供：确认框不再以「方式不可用」直接拒绝，
// 而是照常进入角色参考图等正常流程卡口（这里没有可交互会话，所以停在提问前）。
test('service: bundled host serves the server method again instead of refusing it', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'mv-integration-service-'));
  const previousFetch = globalThis.fetch;
  const previousHome = process.env.DSH_HOME;
  let requests = 0;
  process.env.DSH_HOME = directory;
  globalThis.fetch = async () => { requests++; return Response.json({}); };
  try {
    const config = {
      connectionMode: 'service', apiKey: 'test-key', keyOrigin: 'register', deviceId: 'd', deviceSecret: 's',
      deviceFingerprint: 'f', model: 'doubao-seedance-2-0-mini-260615', outputDir: directory,
      ffmpegBinary: '/missing/ffmpeg', ffprobeBinary: '/missing/ffprobe',
    };
    const host = harness(config, directory);
    const decision = await host.gate({ name: 'metaontic_agent_forge_video_generate', arguments: { duration: 5 } });
    assert.doesNotMatch(String(decision.reason || ''), /暂时不可用/);
    assert.equal(decision.kind, 'deny');
    assert.match(decision.reason, /projectId/);
    assert.ok(host.tools.has('metaontic_agent_forge_video_config'));
    assert.equal(requests, 0);
    host.dispose();
  } finally {
    globalThis.fetch = previousFetch;
    if (previousHome === undefined) delete process.env.DSH_HOME;
    else process.env.DSH_HOME = previousHome;
    await rm(directory, { recursive: true, force: true });
  }
});
