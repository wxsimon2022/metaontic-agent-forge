import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { test } from 'node:test';
const source = readFileSync(new URL('../client.js', import.meta.url), 'utf8');
function extract(name) {
  const start = source.indexOf(`function ${name}(`);
  assert.ok(start >= 0);
  const indent = source.slice(source.lastIndexOf('\n', start) + 1, start);
  const end = source.indexOf('\n' + indent + '}', start);
  return source.slice(start, end + indent.length + 2);
}
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
  assert.deepEqual([...registrations.keys()], ['video_generate', 'video_extend', 'video_status', 'video_prepare_image']);
  for (const dispose of disposers.reverse()) dispose();
  assert.equal(registrations.size, 0);
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  assert.ok(pkg.dsh.client.inject.includes('@deepseek-ai/dsh-client-ui-tool'));
});
test('running video card renders progress and a completed success reaches 100 percent', () => {
  const context = vm.createContext({
    React: { useState: () => [30, () => {}], useRef: () => ({ current: 0 }), useEffect() {} },
    h: (tag, props, ...children) => ({ tag, props, children }), TOKENS: {}, MediaPreview: null,
  });
  vm.runInContext(extract('estimatedVideoWait') + '\n' + extract('estimatedVideoProgress') + '\n' + extract('VideoTaskProgress'), context);
  const running = context.VideoTaskProgress({ block: { phase: 'start', name: 'video_generate', args: { duration: 15 } }, callId: 'a', startedAt: 1 });
  assert.match(JSON.stringify(running), /progressbar/);
  assert.match(JSON.stringify(running), /mov-task-active/);
  assert.doesNotMatch(JSON.stringify(running), /max-width:420px/);
  assert.equal(context.VideoTaskProgress({ block: { phase: 'preparing', name: 'video_generate' }, callId: 'a' }), null);
  assert.equal(context.VideoTaskProgress({ block: { phase: 'start', name: 'video_generate' }, callId: 'a' }), null, 'native start is recorded before approval');
  assert.match(JSON.stringify(running), /🐢/, '执行中进度条上有跟着进度走的小乌龟');
  assert.match(JSON.stringify(running), /mov-task-turtle/);
  const runningJson = JSON.stringify(running);
  const percent = /"aria-valuenow":(\d+)/.exec(runningJson)[1];
  assert.match(runningJson, new RegExp(`"left":"${percent}%"`), '小乌龟位置跟着当前进度百分比');
  assert.doesNotMatch(runningJson, /mov-task-bee/);
  assert.match(runningJson, /\.mov-task-turtle \{[^}]*scaleX\(-1\)/, '乌龟要镜像成头朝右');
  assert.match(runningJson, /"className":"mov-task mov-task-running"/, '执行中给卡片加上呼吸灯类');
  assert.match(runningJson, /@keyframes mov-task-breath/, '外边框呼吸灯动画');
  const finished = context.VideoTaskProgress({ block: { kind: 'result', content: [{ type: 'text', text: 'succeeded' }] } });
  assert.equal(finished, null, 'completed results must not display generation progress');
  for (const toolName of ['video_status', 'video_prepare_image', 'video_project']) assert.equal(context.VideoTaskProgress({ toolName, block: { phase: 'start' }, startedAt: 1 }), null);
  assert.match(JSON.stringify(context.VideoTaskProgress({ block: { phase: 'start', name: 'video_generate', args: { duration: 15 } }, callId: 'a', startedAt: 1 })), /mov-task-rail/);
});

test('execution source waits for real execution and clears on settlement or interrupted turns', () => {
  const context = vm.createContext({ Map });
  vm.runInContext(extract('videoExecutionSource'), context);
  let window = { entries: [] };
  const listeners = new Set();
  const source = context.videoExecutionSource({ getSnapshot: () => window, subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); } });
  const append = (type, data = {}, time = 1000) => { window = { entries: [...window.entries, { event: { type, data, time } }] }; for (const fn of listeners) fn(); };
  append('tool/call', { callId: 'a' });
  append('approval/asked', { callId: 'a' });
  assert.equal(source.getSnapshot().size, 0);
  append('approval/decided', { callId: 'a', outcome: 'allowed-once' });
  assert.equal(source.getSnapshot().size, 0, 'approval alone does not imply execution');
  append('plugin:metaontic-video/execution', { callId: 'a', phase: 'start' }, 2000);
  const running = source.getSnapshot();
  assert.equal(running.get('a'), 2000);
  assert.equal(source.getSnapshot(), running, 'snapshot remains stable between events');
  append('approval/asked', { callId: 'another-call' });
  assert.equal(source.getSnapshot(), running, 'unrelated events do not reset timing');
  append('plugin:metaontic-video/execution', { callId: 'a', phase: 'end' }, 3000);
  assert.equal(source.getSnapshot().size, 0);
  append('plugin:metaontic-video/execution', { callId: 'b', phase: 'start' });
  append('turn/end');
  assert.equal(source.getSnapshot().size, 0);
  const otherSession = context.videoExecutionSource({ getSnapshot: () => ({ entries: [] }), subscribe: () => () => {} });
  assert.equal(otherSession.getSnapshot().size, 0);
});

test('execution signals surround only the actual tool body and settle on errors', async () => {
  const host = readFileSync(new URL('../index.js', import.meta.url), 'utf8');
  const start = host.indexOf('function withVideoExecution(');
  const end = host.indexOf('\n}', start) + 2;
  const signals = [];
  const context = vm.createContext({ appendVideoExecution: async (exec, phase) => signals.push([exec.callId, phase]) });
  vm.runInContext(host.slice(start, end), context);
  const exec = { callId: 'test' };
  const tool = context.withVideoExecution({ execute: async () => { signals.push('body'); return 'ok'; } });
  assert.equal(signals.length, 0, 'registration and approval do not emit execution');
  assert.equal(await tool.execute({}, exec), 'ok');
  assert.deepEqual(signals, ['body', ['test', 'end']]);
  signals.length = 0;
  const failure = new Error('failed before task creation');
  const failed = context.withVideoExecution({ execute: async () => { throw failure; } });
  await assert.rejects(failed.execute({}, exec), error => error === failure);
  assert.deepEqual(signals, [['test', 'end']]);
});

test('estimated progress follows video duration and waits for actual success', () => {
  const context = vm.createContext({});
  vm.runInContext(extract('estimatedVideoWait') + '\n' + extract('estimatedVideoProgress'), context);
  for (const [duration, wait] of [[5, 120], [10, 135], [15, 150], [30, 195]]) {
    assert.equal(context.estimatedVideoWait(duration), wait);
    assert.equal(context.estimatedVideoProgress(wait / 2, false, duration), 50);
    assert.equal(context.estimatedVideoProgress(wait, false, duration), 99);
    assert.equal(context.estimatedVideoProgress(wait * 2, false, duration), 99);
    assert.equal(context.estimatedVideoProgress(1, true, duration), 100);
  }
  for (const duration of [undefined, '', 0, -1, 'bad', Infinity]) {
    assert.equal(context.estimatedVideoWait(duration), 180);
  }
  assert.equal(context.estimatedVideoWait('5'), 120);
});

test('outside progress tracks active nested calls without relying on expanded tool cards', () => {
  const context = vm.createContext({ Set });
  vm.runInContext(extract('activeVideoCalls'), context);
  const running = { callId: 'video-1', name: 'video_generate', args: { duration: 15 }, subCalls: [] };
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
  vm.runInContext(extract('activeVideoCalls') + '\n' + extract('VideoProgressDock'), context);
  const running = { phase: 'start', callId: 'video-2', name: 'video_extend', subCalls: [] };
  const chat = { order: ['tool'], nodes: new Map([['tool', { kind: 'tool-call', data: { root: running } }]]) };
  const hooks = { useChat: selector => selector(chat), useVideoExecutions: selector => selector(new Map([['video-2', 1234]])) };
  const dock = context.VideoProgressDock(hooks);
  assert.equal(dock.props['data-field'], 'video-progress-dock');
  assert.equal(dock.props.style.maxWidth, 'var(--dsh-composer-card-max-width, 100%)');
  assert.match(dock.props.style.width, /--dsh-composer-side-clearance/);
  assert.equal(dock.props.style.margin, '0 auto');
  assert.equal(dock.children[0][0].props.callId, 'video-2');
  assert.equal(dock.children[0][0].props.startedAt, 1234);
  assert.equal(context.VideoProgressDock({ ...hooks, useVideoExecutions: selector => selector(new Map()) }), null, 'call/start before approval does not show progress');
  running.phase = 'preparing';
  assert.equal(context.VideoProgressDock(hooks), null, 'streamed arguments never show progress');
  assert.equal(context.VideoProgressDock({ useChat: selector => selector(undefined) }), null);
});

 test('generation signals stop before delivery and always clear on failure', async () => {
  const host = readFileSync(new URL('../index.js', import.meta.url), 'utf8');
  const start = host.indexOf('async function withGenerationProgress(');
  const end = host.indexOf('\n}', start) + 2;
  const signals = [];
  const context = vm.createContext({ appendVideoExecution: async (_exec, phase) => signals.push(phase) });
  vm.runInContext(host.slice(start, end), context);
  await context.withGenerationProgress({}, async () => signals.push('generation'));
  signals.push('download', 'merge');
  assert.deepEqual(signals, ['start', 'generation', 'end', 'download', 'merge']);
  signals.length = 0;
  await assert.rejects(context.withGenerationProgress({}, async () => { throw Error('stopped'); }));
  assert.deepEqual(signals, ['start', 'end']);
 });
