import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { sourceOf } from './source.mjs';

function setup() {
  const saved = new Map();
  const state = { latest: '3.5.0', deferred: '', confirmed: false, installs: 0, reads: 0 };
  const h = vm.createContext({ window: { localStorage: {
    getItem: key => saved.get(key) || null, setItem: (key, value) => saved.set(key, value), removeItem: key => saved.delete(key),
  } } });
  vm.runInContext(sourceOf('client/updates'), h);
  const context = {
    UPDATE_CACHE_KEY: 'test', UPDATE_MAX_AGE_MS: 1000, updateCommit: { current: '' },
    get updateLatest() { return state.latest; }, get updateConfirm() { return state.confirmed; },
    setUpdateDeferred: value => { state.deferred = value; }, setUpdateConfirm: value => { state.confirmed = value; },
    setUpdateLatest: value => { state.latest = value; }, setUpdateStatus() {}, setUpdateMessage() {}, setUpdateAt() {},
    fetchLatestVersion: async () => { state.reads++; return '3.5.0'; }, fetchLatestCommit: async () => 'abc',
    manager: () => ({ manager: { listBundles: async () => ({ok:true,value:[{name:'metaontic-video',installed:true,source:'https://example.invalid/metaontic-video.tgz'}]}), installBundle: async () => { state.installs++; return { ok: true, value: { application: 'applied', version: '3.5.0' } }; } } }),
    PLUGIN_PACKAGE: 'metaontic-video', UPDATE_SPEC: 'git+https://example.invalid/plugin.git', UPDATE_ATTEMPTS: 1,
    t: key => key,
  };
  return { h, state, saved, actions: h.createUpdateActions(context) };
}

test('automatic checks and deferral never install, and manual checks restore the reminder', async () => {
  const { actions, state, saved } = setup();
  await actions.checkForUpdate(true);
  assert.equal(state.installs, 0);
  actions.deferUpdate();
  assert.equal(state.deferred, '3.5.0');
  assert.equal(saved.get('test.deferred'), '3.5.0');
  assert.equal(state.confirmed, false);
  await actions.checkForUpdate(true);
  assert.equal(state.deferred, '3.5.0');
  await actions.checkForUpdate(false);
  assert.equal(state.deferred, '');
  assert.equal(saved.has('test.deferred'), false);
  assert.equal(state.installs, 0);
});

test('install requires explicit confirmation even if runOnlineUpdate is called directly', async () => {
  const { actions, state } = setup();
  await actions.runOnlineUpdate();
  assert.equal(state.installs, 0);
  state.confirmed = true;
  await actions.runOnlineUpdate();
  assert.equal(state.installs, 1);
  assert.equal(state.confirmed, false);
});

test('reminder hides deferred versions, returns for a newer version and exposes separate choices', () => {
  const { h } = setup();
  const props = { h: (tag, props, ...children) => ({ tag, props, children }), t: key => key,
    available: true, latest: '3.5.0', deferred: '3.5.0', status: 'ok', confirmed: false,
    onUpdate() {}, onLater() {} };
  assert.equal(h.renderUpdateNotice(props), null);
  assert.equal(h.renderUpdateNotice({ ...props, available: false }), null);
  const find = (node, action) => node?.props?.['data-action'] === action ? node
    : node?.children?.flat(Infinity).map(child => find(child, action)).find(Boolean);
  const notice = h.renderUpdateNotice({ ...props, latest: '3.6.0' });
  assert.equal(notice.props.role, 'status');
  assert.ok(find(notice, 'update-notice-open'));
  assert.ok(find(notice, 'update-later'));
  assert.equal(find(notice, 'update-notice-confirm'), undefined);
  const confirmed = h.renderUpdateNotice({ ...props, latest: '3.6.0', confirmed: true });
  assert.ok(find(confirmed, 'update-notice-confirm'));
  assert.equal(h.renderUpdateNotice({ ...props, latest: '3.6.0', status: 'installing' }), null);
});
