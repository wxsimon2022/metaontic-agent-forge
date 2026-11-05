import { sourceOf } from './source.mjs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { test } from 'node:test';
const source = sourceOf('config', 'providers/connection', 'workflow/approval');
function harness({ serviceAvailable = true } = {}) {
  const context = vm.createContext({ characterChoiceGate: async () => null,
    METAONTIC_BASE_URL: 'https://ai.bileego.com',
    SERVICE_MODE_AVAILABLE: serviceAvailable,
    SERVICE_UNAVAILABLE_MESSAGE: 'MetaOnticVideo 服务端方式暂时不可用：请在插件设置页把「接入方式」改为 MetaOntic AI 或火山引擎直连，填好 Key 保存后重试。',
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
    // 预检确认框里的费用口径（钱包数字格式化 + 额度/汇率兜底）
    finiteNumber: value => (Number.isFinite(Number(value)) ? Number(value) : null),
    formatMoney: (value, symbol = '¥') => `${symbol}${Number(value).toFixed(2)}`,
    DEFAULT_QUOTA_PER_UNIT: 500000,
    DEFAULT_USD_EXCHANGE_RATE: 7.3,
    estimateUsage: () => { throw new Error('must not estimate'); },
    resolveRegisterApi: () => { throw new Error('must not query service'); },
    isServerIssuedKey: () => false,
  });
  for (const name of ['resolveResolution', 'isVolcengine', 'isMetaontic', 'isService', 'isManualKey', 'assertServiceAvailable', 'connectionLabel', 'resolveApiKey', 'resolveBaseUrl', 'resolveSubmitPath', 'resolveQueryPath', 'assertConfigured', 'fetchDeviceQuota', 'remainingCostText', 'segmentContinueLine', 'preflightGate']) {
    const start = source.search(new RegExp(`(?:async )?function ${name}\\(`));
    assert.ok(start >= 0, name);
    vm.runInContext(source.slice(start, source.indexOf('\n}', start) + 2), context);
  }
  return context;
}
test('service mode is refused end to end while it is temporarily unavailable', async () => {
  const h = harness({ serviceAvailable: false }), config = { connectionMode: 'service', apiKey: 'issued', deviceId: 'd', deviceSecret: 's', registerEmail: 'a@b.c' };
  assert.equal(h.isService(config), true);
  assert.equal(h.resolveApiKey(config), '');
  assert.throws(() => h.assertServiceAvailable(config), /暂时不可用/);
  assert.throws(() => h.assertConfigured(config, 'issued'), /暂时不可用/);
  assert.equal(h.assertServiceAvailable({ connectionMode: 'metaontic' }), undefined);
  const quota = await h.fetchDeviceQuota(config, undefined);
  assert.equal(quota.status, 'unknown');
  assert.match(quota.reason, /暂时不可用/);
  const gate = await h.preflightGate({}, config, { name: 'video_generate', arguments: {} });
  assert.equal(gate.kind, 'deny');
  assert.match(gate.reason, /暂时不可用/);
});
test('service mode keeps its own key rules when it is available', () => {
  const h = harness(), config = { connectionMode: 'service', apiKey: 'issued' };
  assert.equal(h.resolveApiKey(config), 'issued');
  assert.equal(h.assertServiceAvailable(config), undefined);
});
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

test('service 模式不读也不提额度：能不能开始只看服务端支付结果', async () => {
  const h = harness(), config = { connectionMode: 'service', apiKey: 'sk-service' };
  let asked = 0;
  h.fetchDeviceQuota = async () => { asked += 1; throw new Error('must not read quota'); };
  const gate = await h.preflightGate({}, config, { name: 'video_generate', arguments: {} });
  assert.equal(gate.kind, 'ask');
  assert.equal(asked, 0, 'MetaOnticVideo 接入不该去读中转站额度');
  assert.match(gate.displayReason.zh, /按插件服务的支付与用量结算/);
  assert.doesNotMatch(gate.displayReason.zh, /额度|剩余/);
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
