import { sourceOf } from './source.mjs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { test } from 'node:test';
const source = sourceOf('config', 'providers/connection', 'workflow/approval');
function harness() {
  const context = vm.createContext({ characterChoiceGate: async () => null,
    METAONTIC_BASE_URL: 'https://ai.bileego.com',
    ref: (config, key, fallback) => config[key] ?? fallback,
    envValue: () => '',
    relayPreset: () => ({ baseUrl: 'https://ai.bileego.com', submitPath: '/doubao/api/v3/contents/generations/tasks', queryPath: '/doubao/api/v3/contents/generations/tasks/{task_id}' }),
    resumeDirOf: value => value || '',
    readPauseFile: async () => ({ operationState: {} }),
    FIXED_RESOLUTION: '720p',
    estimateArgsFor: async (_config, _tool, args) => ({ ...args, remainingPlan: [{ kind: 'extend', seconds: 5 }] }),
    // 续做入口的确认要报「整条还差多少秒」，算的是剩下的分段时长。
    sumStepSeconds: steps => steps.reduce((total, step) => total + (step.seconds || 0), 0),
    approvalPolicy: () => 'ask', ffmpegConsentGate: async () => null, paymentGate: async () => null,
    resolveModel: () => 'seedance',
    estimateUsage: () => { throw new Error('must not estimate'); },
    resolveRegisterApi: () => { throw new Error('must not query service'); },
    isServerIssuedKey: () => false,
  });
  for (const name of ['resolveResolution', 'isVolcengine', 'isMetaontic', 'isManualKey', 'connectionLabel', 'resolveApiKey', 'resolveBaseUrl', 'resolveSubmitPath', 'resolveQueryPath', 'assertConfigured', 'fetchDeviceQuota', 'remainingCostText', 'segmentContinueLine', 'preflightGate']) {
    const start = source.search(new RegExp(`(?:async )?function ${name}\\(`));
    assert.ok(start >= 0, name);
    vm.runInContext(source.slice(start, source.indexOf('\n}', start) + 2), context);
  }
  return context;
}
test('MetaOntic key is independent; relay routes match service and secrets do not fall back', () => {
  const h = harness(), config = { connectionMode: 'metaontic', metaonticApiKey: ' manual ', apiKey: 'service', volcengineApiKey: 'volcano' };
  assert.equal(h.resolveApiKey(config), 'manual');
  assert.doesNotThrow(() => h.assertConfigured(config, h.resolveApiKey(config)));
  for (const baseUrl of [undefined, 'https://custom.example/']) {
    const shared = { baseUrl };
    assert.equal(h.resolveBaseUrl({ ...config, ...shared }), h.resolveBaseUrl(shared));
    assert.equal(h.resolveSubmitPath(config), h.resolveSubmitPath({}));
    assert.equal(h.resolveQueryPath(config, 'a/b'), h.resolveQueryPath({}, 'a/b'));
  }
  config.metaonticApiKey = '';
  assert.equal(h.resolveApiKey(config), '');
  assert.throws(() => h.assertConfigured(config, ''), /MetaOntic AI/);
  assert.throws(() => h.assertConfigured({ connectionMode: 'service' }, 'manual'), /不是服务端下发/);
});
for (const connectionMode of ['metaontic', 'volcengine']) test(`${connectionMode}: generation, extension and resume bypass service quota and estimates`, async () => {
  const h = harness(), config = { connectionMode, metaonticApiKey: 'm', volcengineApiKey: 'v' };
  assert.equal((await h.fetchDeviceQuota(config)).status, 'unknown');
  assert.equal((await h.remainingCostText(config, {}, [])).remain, '');
  for (const name of ['video_generate', 'video_extend']) {
    const gate = await h.preflightGate({}, config, { name, arguments: { resume: '/tmp/progress' } });
    assert.equal(gate.kind, 'ask');
    assert.match(gate.displayReason.zh, /按渠道账户实际用量计费。确认后开始。/);
    assert.doesNotMatch(gate.displayReason.zh, /预估|核对|额度/);
    assert.doesNotMatch(gate.displayReason.en, /estimate|balance/i);
  }
});

test('service 模式付过款就直接放行，不再弹一次费用确认', async () => {
  const h = harness(), config = { connectionMode: 'service', apiKey: 'sk-service' };
  h.paymentGate = async () => ({ kind: 'paid', outTradeNo: 'WP123456', money: '¥9.90' });
  const gate = await h.preflightGate({}, config, { name: 'video_generate', arguments: {} });
  assert.equal(gate.kind, 'allow');

  // 没付款时仍然退回付款说明，不放行
  h.paymentGate = async () => ({ kind: 'deny', reason: '本次生成需要先付款' });
  const denied = await h.preflightGate({}, config, { name: 'video_generate', arguments: {} });
  assert.equal(denied.kind, 'deny');
  assert.match(denied.reason, /需要先付款/);
});
