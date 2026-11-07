import { sourceOf } from './source.mjs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { test } from 'node:test';
const source = sourceOf('config', 'providers/connection', 'workflow/approval');
function harness({ serviceAvailable = true } = {}) {
  const context = vm.createContext({ characterChoiceGate: async () => null,
    METAONTIC_BASE_URL: 'https://ai.bileego.com',
    SERVICE_MODE_AVAILABLE: serviceAvailable,
    SERVICE_UNAVAILABLE_MESSAGE: 'MetaOnticVideo 服务端方式暂时不可用：请在插件设置页把「接入方式」改为 MetaOntic AI 或火山引擎直连，填好 API密钥保存后重试。',
    ref: (config, key, fallback) => config[key] ?? fallback,
    envValue: () => '',
    relayPreset: () => ({ baseUrl: 'https://ai.bileego.com', submitPath: '/doubao/api/v3/contents/generations/tasks', queryPath: '/doubao/api/v3/contents/generations/tasks/{task_id}' }),
    resumeDirOf: value => value || '',
    readPauseFile: async () => ({ operationState: {} }),
    FIXED_RESOLUTION: '720p',
    estimateArgsFor: async (_config, _tool, args) => ({ ...args, remainingPlan: [{ kind: 'extend', seconds: 5 }] }),
    // 续做入口的确认要报「整条还差多少秒」，算的是剩下的分段时长。
    sumStepSeconds: steps => steps.reduce((total, step) => total + (step.seconds || 0), 0),
    approvalPolicy: () => 'ask', ffmpegConsentGate: async () => null,
    resolveModel: () => 'seedance',
    // 预检确认框里的费用口径（钱包数字格式化 + 额度/汇率兜底）
    finiteNumber: value => (Number.isFinite(Number(value)) ? Number(value) : null),
    formatMoney: (value, symbol = '¥') => `${symbol}${Number(value).toFixed(2)}`,
    DEFAULT_QUOTA_PER_UNIT: 500000,
    DEFAULT_USD_EXCHANGE_RATE: 7.3,
    estimateUsage: () => { throw new Error('must not estimate'); },
    resolveRegisterApi: () => { throw new Error('must not query service'); },
    isServerIssuedKey: () => false,
    DEFAULT_REGISTER_TOKEN: 'metaontic-video-register-v1',
    PLUGIN_VERSION: '3.14.0',
  });
  for (const name of ['resolveResolution', 'isVolcengine', 'isMetaontic', 'isManualKey', 'connectionLabel', 'resolveApiKey', 'resolveBaseUrl', 'resolveSubmitPath', 'resolveQueryPath', 'assertConfigured', 'remainingCostText', 'segmentContinueLine', 'planSummary', 'preflightGate']) {
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
  assert.throws(() => h.assertConfigured({ connectionMode: 'service' }, 'manual'), /选择接入方式/);
});
for (const connectionMode of ['metaontic', 'volcengine']) test(`${connectionMode}: generation, extension and resume bypass service quota and estimates`, async () => {
  const h = harness(), config = { connectionMode, metaonticApiKey: 'm', volcengineApiKey: 'v' };
  assert.equal((await h.remainingCostText(config, {}, [])).remain, '');
  // 手填 API密钥的接入方式不判断额度：预检任何一步都不该去查这把 API密钥的额度。
  h.fetchDeviceQuota = async () => { throw new Error('metaontic/volcengine must not query service quota'); };
  for (const name of ['video_generate', 'video_extend']) {
    const gate = await h.preflightGate({}, config, { name, arguments: { resume: '/tmp/progress' } });
    assert.equal(gate.kind, 'ask');
    assert.match(gate.displayReason.zh, /按当前 API密钥在渠道的实际用量计费/);
    assert.doesNotMatch(gate.displayReason.zh, /账号余额|查询额度/);
    assert.doesNotMatch(gate.displayReason.en, /balance/i);
  }
});

const serviceConfig = () => ({
  connectionMode: 'service', apiKey: 'sk-service',
  deviceId: 'd', deviceSecret: 's', registerEmail: 'a@b.c',
});
const okQuota = over => async () => ({
  status: 'ok',
  data: { remain_quota: 10000, remain_amount: 100, quota_per_unit: 68500, usd_exchange_rate: 7.3, currency_symbol: '\u00a5', ...over },
});
const estimateOf = usd => () => ({
  model: 'doubao-seedance', resolution: '720p', usd,
  tokens: 1000, seconds: 15, segments: [{ seconds: 15, usd, tokens: 1000 }],
});

const imageCall = { name: 'video_prepare_image', arguments: { operation: 'create_character', prompt: '角色', style: '二维动画' } };

test('MetaOntic AI 图片调用不查额度、确认框不带余额', async () => {
  const h = harness(), config = { connectionMode: 'metaontic', metaonticApiKey: 'm' };
  h.fetchDeviceQuota = async () => { throw new Error('metaontic must not query service quota'); };
  const gate = await h.preflightGate({}, config, imageCall);
  assert.equal(gate.kind, 'ask');
  assert.doesNotMatch(gate.displayReason.zh, /\u4f59\u989d|\u989d\u5ea6/);
  assert.match(gate.displayReason.zh, /\u5355\u72ec\u8ba1\u8d39/);
});

test('removed or unknown connections cannot reuse old credentials', () => {
  const h = harness();
  for (const connectionMode of ['service', 'unknown']) {
    assert.throws(() => h.resolveApiKey({ connectionMode, apiKey: 'old-issued', metaonticApiKey: 'manual' }), /选择/);
    assert.throws(() => h.assertConfigured({ connectionMode }, 'old-issued'), /选择/);
  }
  assert.equal(h.resolveApiKey({ metaonticApiKey: 'manual' }), 'manual');
});
