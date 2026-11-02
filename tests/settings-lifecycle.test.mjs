import { sourceOf } from './source.mjs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { test } from 'node:test';
const source = sourceOf('connection-defaults', 'client/state', 'client/settings', 'client/account', 'client/updates');
function extract(name) {
  const start = source.search(new RegExp(`(?:async )?function ${name}\\(`));
  assert.ok(start >= 0, name);
  // Bundled functions end at the same indentation as their declaration.
  const indent = source.slice(source.lastIndexOf('\n', start) + 1, start);
  const end = source.indexOf('\n' + indent + '}', start);
  return 'var context = globalThis;\n' + source.slice(start, end + indent.length + 2);
}
function setup(fail = false) {
  const state = { connectionMode: 'service', apiKey: 'previous', deviceSecret: 'device', model: 'model' };
  const events = []; let calls = 0;
  const ctx = vm.createContext({
    form: { async mutate(ops) { calls++; if (fail) return false; for (const op of ops) { if (op.op === 'unset') delete state[op.path[0]]; else state[op.path[0]] = op.value; } return true; } },
    connectionBusy: { current: false }, window: { confirm: () => true }, snapshot: { user: { ...state } },
    PLUGIN_OWNED_KEYS: Object.keys(state), serviceActive: () => true,
    clearLoggedOut: () => events.push('logged-in'), forgetDevice: () => events.push('forgot-device'),
    deviceWrites: () => [['deviceId', 'new-device'], ['deviceSecret', 'new-secret']],
    registerApiRoot: () => 'https://example.invalid',
    clear: () => {}, setSaveError: x => events.push(['error', x]),
    setStatus: x => events.push(['status', x]), setRegisterStatus: x => events.push(['register', x]),
    setDraft: () => {}, setVisibleKey: () => {}, setRegisterEmail: () => {}, setRegisterMessage: () => {}, setRegisterCode: () => {}, setQuota: () => {},
    flashStatus: x => events.push(['flash', x]),
    settingsError: e => e.message, t: (key, args) => args ? `${key}: ${args.message}` : key,
    loadQuota: async () => {}, loadUsage: async () => {},
  });
  vm.runInContext(sourceOf('connection-defaults'), ctx);
  for (const name of ['persistBatch', 'persistConnection', 'validateSettings', 'reset', 'applyRegistration']) vm.runInContext(extract(name), ctx);
  return { ctx, state, events, calls: () => calls };
}
test('login writes credentials together and only marks login after acceptance', async () => {
  const h = setup();
  assert.equal(await h.ctx.applyRegistration({ api_key: 'new', email: 'test@example.invalid', model: 'new-model' }), true);
  assert.equal(h.calls(), 1); assert.equal(h.state.apiKey, 'new'); assert.equal(h.state.deviceSecret, 'new-secret');
  assert.equal(h.state.metaonticApiKey, ''); assert.ok(h.events.includes('logged-in'));
  const rejected = setup(true);
  await assert.rejects(rejected.ctx.applyRegistration({ api_key: 'new' }), /atomicRejected/);
  assert.equal(rejected.calls(), 1); assert.equal(rejected.state.apiKey, 'previous'); assert.ok(!rejected.events.includes('logged-in'));
  assert.equal(rejected.ctx.connectionBusy.current, false);
});
test('reset clears in one operation and preserves local identity if rejected', async () => {
  const h = setup(); await h.ctx.reset();
  assert.equal(h.calls(), 1); assert.deepEqual(h.state, {}); assert.ok(h.events.includes('forgot-device'));
  assert.ok(h.events.some(e => Array.isArray(e) && e[0] === 'flash' && e[1] === 'reset'));
  const rejected = setup(true); await rejected.ctx.reset();
  assert.equal(rejected.calls(), 1); assert.equal(rejected.state.apiKey, 'previous'); assert.ok(!rejected.events.includes('forgot-device'));
  assert.ok(rejected.events.some(e => Array.isArray(e) && e[0] === 'error' && /resetFailed/.test(e[1])));
  assert.equal(rejected.ctx.connectionBusy.current, false);
});
test('wait and seam validation accepts defaults and rejects invalid combinations', () => {
  const { ctx } = setup();
  assert.doesNotThrow(() => ctx.validateSettings({}));
  assert.doesNotThrow(() => ctx.validateSettings({ pollIntervalMs: 1500, maxWaitMs: 2000, seamTrimSeconds: '0.5,0' }));
  for (const args of [{ pollIntervalMs: '' }, { pollIntervalMs: 500 }, { maxWaitMs: 1000 }, { maxWaitMs: Infinity }, { pollIntervalMs: 1000.5 }]) assert.throws(() => ctx.validateSettings(args), /invalidWait/);
  for (const seamTrimSeconds of ['0.5,', '-1', '3.1', 'bad']) assert.throws(() => ctx.validateSettings({ seamTrimSeconds }), /invalidSeam/);
});
test('wait controls show seconds, retain millisecond precision and preserve an empty draft', () => {
  const ctx = vm.createContext({
    draft: {}, value: { pollIntervalMs: 5500, maxWaitMs: 600000 }, snapshot: {}, SELECTS: {}, visibleKey: '', inputStyle: {},
    h: (tag, props, ...children) => ({ tag, props, children }),
    edit: (key, value) => { ctx.draft[key] = value; },
  });
  vm.runInContext(extract('control'), ctx);
  const field = { key: 'pollIntervalMs', kind: 'number' };
  let input = ctx.control(field); assert.equal(input.props.value, 5.5); assert.equal(input.props.min, 1);
  input.props.onChange({ target: { value: '1.125' } }); assert.equal(ctx.draft.pollIntervalMs, 1125);
  input = ctx.control(field); assert.equal(input.props.value, 1.125);
  input.props.onChange({ target: { value: '' } }); assert.equal(ctx.control(field).props.value, '');
  delete ctx.value.maxWaitMs; assert.equal(ctx.control({ key: 'maxWaitMs', kind: 'number' }).props.value, 600);
});
test('update bell only appears for newer versions and names the available version', () => {
  const ctx = vm.createContext({ h: (tag, props, ...children) => ({ tag, props, children }) });
  vm.runInContext(extract('isNewerVersion'), ctx);
  vm.runInContext(extract('updateBell'), ctx);
  const t = (_key, args) => `New version ${args.version}`;
  assert.equal(ctx.updateBell(t, '3.2.2', '3.2.2'), null);
  assert.equal(ctx.updateBell(t, '3.2.1', '3.2.2'), null);
  assert.equal(ctx.updateBell(t, '', '3.2.2'), null);
  const bell = ctx.updateBell(t, '3.2.3', '3.2.2');
  assert.equal(bell.props['data-field'], 'update-bell');
  assert.equal(bell.props['aria-label'], 'New version 3.2.3');
});
test('automatic update failures do not change page status; manual failures remain visible', async () => {
  const events = [];
  const ctx = vm.createContext({
    fetchLatestVersion: async () => { throw new Error('offline'); },
    setUpdateStatus: value => events.push(value), setUpdateMessage: value => events.push(value),
    t: (_key, args) => args.message,
  });
  vm.runInContext(extract('checkForUpdate'), ctx);
  assert.equal(await ctx.checkForUpdate(true), '');
  assert.deepEqual(events, []);
  assert.equal(await ctx.checkForUpdate(false), '');
  assert.ok(events.includes('failed')); assert.ok(events.includes('offline'));
});
for (const available of ['gitee', 'github']) test(`${available} can supply versions when the other source fails`, async () => {
  const ctx = vm.createContext({
    PLUGIN_VERSION: '3.3.0', UPDATE_FILE_API: 'gitee', UPDATE_TAGS_API: 'tags', UPDATE_MIRROR_FILES: ['mirror'],
    decodeBase64Text: value => value,
    fetchUpdateSource: async url => {
      if (String(url).includes(available)) return { json: async () => [{tag_name:'v3.3.1',prerelease:false}] };
      if (url === 'tags') throw new Error('unavailable');
      throw new Error('unavailable');
    },
  });
  for (const name of ['isNewerVersion', 'fetchRecentVersions', 'fetchLatestVersion']) vm.runInContext(extract(name), ctx);
  assert.equal(await Promise.race([ctx.fetchLatestVersion(), new Promise((_, reject) => setTimeout(() => reject(new Error('blocked by another source')), 100))]), '3.3.1');
});
test('all update sources failing rejects cleanly; an older successful source still works', async () => {
  let failed = true;
  const ctx = vm.createContext({
    PLUGIN_VERSION: '3.3.0', UPDATE_FILE_API: 'gitee', UPDATE_TAGS_API: 'tags', UPDATE_MIRROR_FILES: [],
    decodeBase64Text: value => value,
    fetchUpdateSource: async url => {
      if (!failed && String(url).includes('gitee')) return { json: async () => [{tag_name:'v3.2.2'}] };
      throw new Error('offline');
    },
  });
  for (const name of ['isNewerVersion', 'fetchRecentVersions', 'fetchLatestVersion']) vm.runInContext(extract(name), ctx);
  await assert.rejects(ctx.fetchLatestVersion(), /no published stable/);
  failed = false; assert.equal(await ctx.fetchLatestVersion(), '3.2.2');
});

test('online updates report hot application, required restart and inactive installation separately', async () => {
  for (const [application, status, message] of [
    ['applied', 'applied', 'versionUpdateDone'],
    ['restart-required', 'restart', 'versionUpdateRestart'],
    ['overridden', 'applied', 'versionUpdatePending'],
    ['cancelled', 'ok', 'versionUpdateCancelled'],
  ]) {
    const states = [], messages = [];
    const ctx = vm.createContext({
      setUpdateConfirm() {}, setUpdateStatus: value => states.push(value), setUpdateMessage: value => messages.push(value),
      manager: () => ({ manager: { listBundles: async () => ({ok:true,value:[{name:'metaontic-video',installed:true,source:'https://example.invalid/metaontic-video.tgz'}]}), installBundle: async () => ({ ok: true, value: { application, version: '3.4.0' } }) } }),
      PLUGIN_PACKAGE: 'metaontic-video', UPDATE_SPEC: 'git+https://example.invalid/plugin.git', UPDATE_ATTEMPTS: 2,
      updateConfirm: true, updateCommit: { current: '' }, updateLatest: '3.4.0', setUpdateLatest() {}, forgetUpdateCheck() {},
      t: key => key,
    });
    vm.runInContext(extract('runOnlineUpdate'), ctx);
    await ctx.runOnlineUpdate();
    assert.equal(states.at(-1), status, application);
    assert.equal(messages.at(-1), message, application);
  }
});

test('first Save waits for background device synchronization instead of silently returning', async () => {
  const h = setup();
  let release;
  const pending = new Promise(resolve => { release = resolve; });
  h.ctx.connectionBusy.current = true; h.ctx.connectionBusy.pending = pending;
  h.ctx.saveInFlight = { current: false };
  h.ctx.draft = { connectionMode: 'metaontic', metaonticApiKey: 'video-key' };
  h.ctx.same = (a,b) => a === b;
  h.ctx.form.getSnapshot = () => ({ value: { ...h.state } });
  vm.runInContext(extract('save'), h.ctx);
  const first = h.ctx.save();
  await h.ctx.save(); // double click while waiting cannot queue a second save
  assert.equal(h.calls(), 0);
  h.ctx.connectionBusy.current = false; h.ctx.connectionBusy.pending = null; release();
  await first;
  assert.equal(h.calls(), 1); assert.equal(h.state.connectionMode, 'metaontic');
  assert.equal(h.state.metaonticApiKey, 'video-key'); assert.equal(h.state.apiKey, '');
  assert.equal(h.ctx.saveInFlight.current, false);
  assert.ok(h.events.some(e => Array.isArray(e) && e[0] === 'flash' && e[1] === 'saved'));
});

test('registration exposes its pending write so Save can wait instead of dropping a click', async () => {
  const h = setup(); let release;
  h.ctx.form.mutate = () => new Promise(resolve => { release = resolve; });
  const registration = h.ctx.applyRegistration({api_key:'new'});
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(h.ctx.connectionBusy.current, true);
  assert.equal(typeof h.ctx.connectionBusy.pending?.then, 'function');
  release(true); await registration;
  assert.equal(h.ctx.connectionBusy.current, false); assert.equal(h.ctx.connectionBusy.pending, null);
});

test('save retains edits made while the write is in flight', async () => {
  const h = setup(); let release; let currentDraft = { model: 'submitted' };
  h.ctx.saveInFlight = {current:false}; h.ctx.draft = {...currentDraft};
  h.ctx.same = (a,b) => a === b;
  h.ctx.form.getSnapshot = () => ({value:{...h.state}});
  h.ctx.form.mutate = () => new Promise(resolve => { release = resolve; });
  h.ctx.setDraft = update => { currentDraft = typeof update === 'function' ? update(currentDraft) : update; };
  vm.runInContext(extract('save'), h.ctx);
  const saving = h.ctx.save();
  currentDraft = {model:'edited-again',ratio:'16:9'};
  release(true); await saving;
  assert.deepEqual(JSON.parse(JSON.stringify(currentDraft)), {model:'edited-again',ratio:'16:9'});
});
