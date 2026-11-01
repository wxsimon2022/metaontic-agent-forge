import { sourceOf } from './source.mjs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { test } from 'node:test';
const source = sourceOf('connection-defaults', 'client/state');
const context = vm.createContext({});
vm.runInContext(source + '\nObject.assign(globalThis, createSettingsState({}));', context);
const modes = ['service', 'metaontic', 'volcengine'];
const keyFor = { service: 'apiKey', metaontic: 'metaonticApiKey', volcengine: 'volcengineApiKey' };
for (const from of modes) for (const to of modes) test(`atomic save ${from} -> ${to} clears inherited credentials`, async () => {
  const inherited = { apiKey: 'old-service', metaonticApiKey: 'old-meta', volcengineApiKey: 'old-volcano', deviceSecret: 'old-device' };
  const disk = { connectionMode: from }; let calls = 0;
  await context.persistConnection({
    async mutate(ops) { calls++; const staged = { ...disk }; for (const op of ops) staged[op.path[0]] = op.value; Object.assign(disk, staged); return true; },
    getSnapshot() { if (calls) throw new Error('disposed controller snapshot must not be used'); return {status:'ready', writable:true, revision:1, value:{...disk}}; },
  }, [['connectionMode', to], [keyFor[to], 'new-key']], to);
  assert.equal(calls, 1); assert.ok(disk.baseUrl); assert.ok(disk.submitPath); assert.ok(disk.queryPath); assert.ok(disk.model); assert.ok(disk.imageModel); assert.equal(disk.connectionMode, to); assert.equal(disk[keyFor[to]], 'new-key');
  for (const mode of modes.filter(mode => mode !== to)) assert.equal(({ ...inherited, ...disk })[keyFor[mode]], '');
});
test('rejected atomic writes report failure without falling back to partial writes', async () => {
  let calls = 0;
  await assert.rejects(context.persistConnection({ async mutate() { calls++; return false; }, async set() { throw new Error('partial writes forbidden'); } }, [], 'metaontic'), /atomicRejected/);
  assert.equal(calls, 1);
  await assert.rejects(context.persistConnection({}, [], 'metaontic'), /atomicUnsupported/);
});

test('stale revision recovers and saves the full connection in one user action', async () => {
  const disk = { connectionMode: 'service', apiKey: 'issued', model: 'video' };
  let revision = 'old', calls = 0;
  const seen = [];
  const form = {
    getSnapshot() { return { status: 'ready', writable: true, revision, value: { ...disk }, user: { ...disk } }; },
    async mutate(ops) {
      calls++; seen.push(JSON.stringify(ops));
      if (calls === 1) { revision = 'recovered'; return false; }
      for (const op of ops) disk[op.path[0]] = op.value;
      return true;
    },
  };
  await context.persistConnection(form, [['connectionMode', 'metaontic'], ['metaonticApiKey', 'new-key']], 'metaontic');
  assert.equal(calls, 2); assert.equal(seen[0], seen[1]);
  assert.equal(disk.connectionMode, 'metaontic'); assert.equal(disk.metaonticApiKey, 'new-key'); assert.equal(disk.apiKey, '');
});
for (const variant of ['same-revision', 'changed-field', 'read-only', 'loading', 'second-rejected']) test(`atomic recovery stops safely: ${variant}`, async () => {
  const state = { status: 'ready', writable: true, revision: 1, value: { connectionMode: 'service' } };
  let calls = 0;
  const form = {
    getSnapshot: () => state,
    async mutate() {
      calls++;
      if (variant !== 'same-revision') state.revision++;
      if (variant === 'changed-field') state.value.connectionMode = 'volcengine';
      if (variant === 'read-only') state.writable = false;
      if (variant === 'loading') state.status = 'loading';
      return false;
    },
  };
  const reason = { 'changed-field': /settingsConflict/, 'second-rejected': /settingsConflict/, 'read-only': /readOnly/, loading: /settingsUnavailable/ }[variant] || /atomicRejected/;
  await assert.rejects(context.persistConnection(form, [['connectionMode', 'metaontic']], 'metaontic'), reason);
  assert.equal(calls, variant === 'second-rejected' ? 2 : 1);
});
test('accepted write never reads a disposed controller after success', async () => {
  let disposed = false;
  await context.persistBatch({
    getSnapshot() { if (disposed) throw new Error('disposed'); return { status: 'ready', revision: 1, value: {} }; },
    async mutate() { disposed = true; return true; },
  }, [{ op: 'set', path: ['ratio'], value: '9:16' }]);
});

test('recovery fences the retry revision against a second concurrent edit', async () => {
  let revision = 1; const seen = [];
  const form = {
    getSnapshot: () => ({status: 'ready', writable: true, revision, value: {model: 'old'}}),
    async mutate(ops, expected) { seen.push(expected); revision++; return false; },
  };
  await assert.rejects(context.persistBatch(form, [{op:'set',path:['model'],value:'new'}]), /settingsConflict/);
  assert.deepEqual(seen, [1, 2]);
});
test('transport failure is not retried or leaked through diagnostics', async () => {
  const warnings = []; const local = vm.createContext({console: {warn: (...args) => warnings.push(args)}});
  vm.runInContext(source + '\nObject.assign(globalThis, createSettingsState({}));', local);
  let calls = 0;
  await assert.rejects(local.persistBatch({
    getSnapshot: () => ({status:'ready',writable:true,revision:1,value:{apiKey:'secret-key'}}),
    async mutate() { calls++; throw new Error('secret-key https://private.example'); },
  }, [{op:'set',path:['apiKey'],value:'new-secret'}]), /settingsTransport/);
  assert.equal(calls,1); assert.equal(warnings.length,1);
  assert.ok(!JSON.stringify(warnings).includes('secret')); assert.ok(!JSON.stringify(warnings).includes('private'));
});
test('unready and read-only forms do not attempt writes', async () => {
  for (const state of [{status:'loading',writable:true},{status:'ready',writable:false}]) {
    await assert.rejects(context.persistBatch({ getSnapshot: () => state, async mutate() { assert.fail('must not write'); } }, []), /settingsUnavailable|readOnly/);
  }
});

test('saved manual connection reloads with complete addresses, models and isolated keys', async () => {
  const runtime = vm.createContext({
    ref: (config, key, fallback) => config[key] ?? fallback,
    envValue: () => '',
    RELAY_PRESET: {baseUrl:'https://ai.bileego.com', submitPath:'/doubao/api/v3/contents/generations/tasks', queryPath:'/doubao/api/v3/contents/generations/tasks/{task_id}',model:'doubao-seedance-2-0-mini-260615'},
  });
  vm.runInContext(sourceOf('connection-defaults', 'providers/connection'), runtime);
  for (const mode of ['metaontic', 'volcengine']) {
    const disk = {};
    await context.persistConnection({
      getSnapshot: () => ({status:'ready',revision:1,value:disk}),
      async mutate(ops) { for (const op of ops) disk[op.path[0]]=op.value; return true; },
    }, [[keyFor[mode], 'video-key'], ['imageUseVideoKey', false], ['imageApiKey', 'image-key']], mode);
    const reloaded = JSON.parse(JSON.stringify(disk));
    const snap = runtime.snapshotConfig(reloaded);
    assert.equal(snap.baseUrl, mode === 'metaontic' ? 'https://ai.bileego.com' : 'https://ark.cn-beijing.volces.com');
    for (const field of ['baseUrl','submitPath','queryPath','model','imageModel']) assert.ok(reloaded[field], field);
    assert.equal(runtime.resolveApiKey(snap), 'video-key');
    if(mode === 'metaontic') assert.equal(runtime.resolveApiKey(runtime.imageConfig(snap)), 'image-key');
  }
  assert.equal(runtime.resolveBaseUrl({connectionMode:'metaontic'}),'https://ai.bileego.com');
});

test('save preserves custom relay address and models without copying hidden secret values', async () => {
  const disk = {connectionMode:'metaontic',baseUrl:'https://custom.example',model:'custom-video',imageModel:'custom-image'};
  let writes;
  await context.persistConnection({
    getSnapshot: () => ({status:'ready',revision:1,value:disk,secrets:{metaonticApiKey:true}}),
    async mutate(ops) {writes=ops; for(const op of ops) disk[op.path[0]]=op.value; return true;},
  }, [], 'metaontic');
  assert.equal(disk.baseUrl,'https://custom.example');
  assert.equal(disk.model,'custom-video'); assert.equal(disk.imageModel,'custom-image');
  assert.ok(!writes.some(op=>op.path[0]==='metaonticApiKey'));
});

 test('switching from Volcano restores relay endpoints instead of retaining direct paths', async () => {
 const disk = {connectionMode:'volcengine',baseUrl:'https://ark.cn-beijing.volces.com',submitPath:'/api/v3/contents/generations/tasks',queryPath:'/api/v3/contents/generations/tasks/{task_id}'};
 await context.persistConnection({getSnapshot:()=>({status:'ready',revision:1,value:disk}),async mutate(ops){for(const op of ops) disk[op.path[0]]=op.value; return true;}}, [['metaonticApiKey','manual']], 'metaontic');
 assert.equal(disk.baseUrl,'https://ai.bileego.com');
 assert.equal(disk.submitPath,'/doubao/api/v3/contents/generations/tasks');
 });
