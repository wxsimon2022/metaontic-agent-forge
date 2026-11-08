import { api } from './module-test-api.mjs';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { test } from 'node:test';
const source = readFileSync(new URL('../client.js', import.meta.url), 'utf8');
test('video views register immediately when the host declares the tool slot and clean up', () => {
  let entry;
  vm.runInNewContext(source, { window: { __ModuleLoader__: { load(x) { entry = x; } } } });
  const plugin = entry.factory(() => ({ createElement() {} }));
  const registrations = new Map(); const waiting = []; const cleanups = [];
  plugin.apply({
    locale: { bind: () => () => '', register: () => () => {} },
    configForms: { get: () => ({}) },
    uiSession: { provide: () => () => {} },
    effect(fn) { const dispose = fn(); cleanups.push(dispose); return dispose; },
    slots: {
      inject(name, callback) { waiting.push([name, callback]); return () => {}; },
      register(options, component) {
        registrations.set(options.key, component);
        return () => registrations.delete(options.key);
      },
    },
  });
  const disposers = waiting.filter(([name]) => name === 'tool.call.toolview').map(([, install]) => install());
  assert.deepEqual([...registrations.keys()], ['metaontic_agent_forge_video_generate', 'metaontic_agent_forge_video_extend', 'metaontic_agent_forge_video_status', 'metaontic_agent_forge_video_prepare_image']);
  for (const dispose of disposers.reverse()) dispose();
  assert.equal(registrations.size, 0);
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  assert.ok(pkg.dsh.client.inject.includes('@deepseek-ai/dsh-client-ui-tool'));
});
test('progress renders only for active video generation and disappears on completion', () => {
  const context = vm.createContext({
    React: { useState: () => [30, () => {}], useRef: () => ({ current: 0 }), useEffect() {} },
    h: (tag, props, ...children) => ({ tag, props, children }), TOKENS: {}, MediaPreview: null,
  });
  Object.assign(context, api.createVideoProgress(context));
  const running = context.VideoTaskProgress({ block: { phase: 'start', name: 'metaontic_agent_forge_video_generate', args: { duration: 15 } }, callId: 'a', startedAt: 1 });
  assert.match(JSON.stringify(running), /progressbar/);
  assert.match(JSON.stringify(running), /metaontic-agent-forge-task-active/);
  assert.doesNotMatch(JSON.stringify(running), /max-width:420px/);
  assert.equal(context.VideoTaskProgress({ block: { phase: 'preparing', name: 'metaontic_agent_forge_video_generate' }, callId: 'a' }), null);
  assert.equal(context.VideoTaskProgress({ block: { phase: 'start', name: 'metaontic_agent_forge_video_generate' }, callId: 'a' }), null, 'native start is recorded before approval');
  assert.match(JSON.stringify(running), /🐢/, '执行中进度条上有跟着进度走的小乌龟');
  assert.match(JSON.stringify(running), /metaontic-agent-forge-task-turtle/);
  const runningJson = JSON.stringify(running);
  const percent = /"aria-valuenow":(\d+)/.exec(runningJson)[1];
  assert.match(runningJson, new RegExp(`"left":"${percent}%"`), '小乌龟位置跟着当前进度百分比');
  assert.doesNotMatch(runningJson, /metaontic-agent-forge-task-bee/);
  assert.match(runningJson, /\.metaontic-agent-forge-task-turtle \{[^}]*scaleX\(-1\)/, '乌龟要镜像成头朝右');
  assert.match(runningJson, /"className":"metaontic-agent-forge-task metaontic-agent-forge-task-running"/, '执行中给卡片加上呼吸灯类');
  assert.match(runningJson, /@keyframes metaontic-agent-forge-task-breath/, '外边框呼吸灯动画');
  const finished = context.VideoTaskProgress({ block: { kind: 'result', content: [{ type: 'text', text: 'succeeded' }] } });
  assert.equal(finished, null, 'completed results must not display generation progress');
  for (const toolName of ['metaontic_agent_forge_video_status', 'metaontic_agent_forge_video_prepare_image', 'metaontic_agent_forge_video_project']) assert.equal(context.VideoTaskProgress({ toolName, block: { phase: 'start' }, startedAt: 1 }), null);
  assert.match(JSON.stringify(context.VideoTaskProgress({ block: { phase: 'start', name: 'metaontic_agent_forge_video_generate', args: { duration: 15 } }, callId: 'a', startedAt: 1 })), /metaontic-agent-forge-task-rail/);
});

test('execution source waits for real execution and clears on settlement or interrupted turns', () => {
  const context = vm.createContext({ Map });
  Object.assign(context, { videoExecutionSource: api.videoExecutionSource });
  let window = { entries: [] };
  const listeners = new Set();
  const source = context.videoExecutionSource({ getSnapshot: () => window, subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); } });
  const append = (type, data = {}, time = 1000) => { window = { entries: [...window.entries, { event: { type, data, time } }] }; for (const fn of listeners) fn(); };
  append('tool/call', { callId: 'a' });
  append('approval/asked', { callId: 'a' });
  assert.equal(source.getSnapshot().size, 0);
  append('approval/decided', { callId: 'a', outcome: 'allowed-once' });
  assert.equal(source.getSnapshot().size, 0, 'approval alone does not imply execution');
  append('plugin:metaontic-agent-forge/execution', { callId: 'a', phase: 'start' }, 2000);
  const running = source.getSnapshot();
  assert.equal(running.get('a'), 2000);
  assert.equal(source.getSnapshot(), running, 'snapshot remains stable between events');
  append('approval/asked', { callId: 'another-call' });
  assert.equal(source.getSnapshot(), running, 'unrelated events do not reset timing');
  append('plugin:metaontic-agent-forge/execution', { callId: 'a', phase: 'end' }, 3000);
  assert.equal(source.getSnapshot().size, 0);
  append('plugin:metaontic-agent-forge/execution', { callId: 'b', phase: 'start' });
  append('turn/end');
  assert.equal(source.getSnapshot().size, 0);
  const otherSession = context.videoExecutionSource({ getSnapshot: () => ({ entries: [] }), subscribe: () => () => {} });
  assert.equal(otherSession.getSnapshot().size, 0);
});

test('execution signals surround only the actual tool body and settle on errors', async () => {
  const signals = [];
  const report = async (exec, phase) => signals.push([exec.callId, phase]);
  const exec = { callId: 'test' };
  const tool = api.withVideoExecution({ execute: async () => { signals.push('body'); return 'ok'; } }, undefined, report);
  assert.equal(signals.length, 0, 'registration and approval do not emit execution');
  assert.equal(await tool.execute({}, exec), 'ok');
  assert.deepEqual(signals, ['body', ['test', 'end']]);
  signals.length = 0;
  const failure = new Error('failed before task creation');
  const failed = api.withVideoExecution({ execute: async () => { throw failure; } }, undefined, report);
  await assert.rejects(failed.execute({}, exec), error => error === failure);
  assert.deepEqual(signals, [['test', 'end']]);
});

test('estimated progress follows video duration and waits for actual success', () => {
  const context = vm.createContext({});
  Object.assign(context, {estimatedVideoWait: api.estimatedVideoWait, estimatedVideoProgress: api.estimatedVideoProgress});
  for (const [duration, wait] of [[5, 120], [10, 135], [15, 150], [30, 195]]) {
    assert.equal(context.estimatedVideoWait(duration), wait);
    assert.equal(context.estimatedVideoProgress(wait / 2, duration), 50);
    assert.equal(context.estimatedVideoProgress(wait, duration), 99);
    assert.equal(context.estimatedVideoProgress(wait * 2, duration), 99);

  }
  for (const duration of [undefined, '', 0, -1, 'bad', Infinity]) {
    assert.equal(context.estimatedVideoWait(duration), 180);
  }
  assert.equal(context.estimatedVideoWait('5'), 120);
});

test('outside progress tracks active nested calls without relying on expanded tool cards', () => {
  const context = vm.createContext({ Set });
  Object.assign(context, { activeVideoCalls: api.activeVideoCalls });
  const running = { callId: 'video-1', name: 'metaontic_agent_forge_video_generate', args: { duration: 15 }, subCalls: [] };
  const root = { callId: 'dispatch', name: 'parallel', subCalls: [running] };
  const chat = { order: ['tool'], nodes: new Map([['tool', { kind: 'tool-call', data: { root } }]]) };
  assert.equal(context.activeVideoCalls(chat)[0].callId, 'video-1');
  chat.order = [];
  assert.equal(context.activeVideoCalls(chat)[0].callId, 'video-1', 'hidden running nodes remain tracked');
  root.subCalls = [{ kind: 'result', callId: 'video-1', call: running, subCalls: [] }];
  assert.equal(context.activeVideoCalls(chat).length, 0);
  assert.equal(context.activeVideoCalls(undefined).length, 0);
  const otherSession = { order: [], nodes: new Map() };
  assert.equal(context.activeVideoCalls(otherSession).length, 0);
});

test('outside progress dock is visible only while the current session has active video calls', () => {
  const context = vm.createContext({
    Set,
    h: (tag, props, ...children) => ({ tag, props, children }),
    VideoTaskProgress() {},
  });
  Object.assign(context, api.createVideoProgress({ ...context, React: {}, TOKENS: {} }));
  const running = { phase: 'start', callId: 'video-2', name: 'metaontic_agent_forge_video_extend', subCalls: [] };
  const chat = { order: ['tool'], nodes: new Map([['tool', { kind: 'tool-call', data: { root: running } }]]) };
  const hooks = { useChat: selector => selector(chat), useMetaonticAgentForgeVideoExecutions: selector => selector(new Map([['video-2', 1234]])) };
  const dock = context.VideoProgressDock(hooks);
  assert.equal(dock.props['data-field'], 'video-progress-dock');
  assert.equal(dock.props.style.maxWidth, 'var(--dsh-composer-card-max-width, 100%)');
  assert.match(dock.props.style.width, /--dsh-composer-side-clearance/);
  assert.equal(dock.props.style.margin, '0 auto');
  assert.equal(dock.children[0][0].props.callId, 'video-2');
  assert.equal(dock.children[0][0].props.startedAt, 1234);
  assert.equal(context.VideoProgressDock({ ...hooks, useMetaonticAgentForgeVideoExecutions: selector => selector(new Map()) }), null, 'call/start before approval does not show progress');
  running.phase = 'preparing';
  assert.equal(context.VideoProgressDock(hooks), null, 'streamed arguments never show progress');
  assert.equal(context.VideoProgressDock({ useChat: selector => selector(undefined) }), null);
});

 test('generation signals stop before delivery and always clear on failure', async () => {
  const signals = [];
  const report = async (_exec, phase) => signals.push(phase);
  await api.withGenerationProgress({}, async () => signals.push('generation'), report);
  signals.push('download', 'merge');
  assert.deepEqual(signals, ['start', 'generation', 'end', 'download', 'merge']);
  signals.length = 0;
  await assert.rejects(api.withGenerationProgress({}, async () => { throw Error('stopped'); }, report));
  assert.deepEqual(signals, ['start', 'end']);
 });

test('tool results route to media while progress is restricted to unfinished video calls', () => {
 const h=(tag,props)=>({tag,props});
 const MediaPreview=()=>{};const VideoTaskProgress=()=>{};
 const {ToolResultView}=api.createToolResultView({h,MediaPreview,VideoTaskProgress});
 for(const toolName of ['metaontic_agent_forge_video_generate','metaontic_agent_forge_video_extend','metaontic_agent_forge_video_status','metaontic_agent_forge_video_prepare_image']) {
  const result=ToolResultView({toolName,block:{kind:'result'}});
  assert.equal(result.tag,MediaPreview);
  const running=ToolResultView({toolName,block:{phase:'start'}});
  if(['metaontic_agent_forge_video_generate','metaontic_agent_forge_video_extend'].includes(toolName))assert.equal(running.tag,VideoTaskProgress);
  else assert.equal(running,null);
 }
});
