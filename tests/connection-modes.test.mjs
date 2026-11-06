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
  for (const name of ['resolveResolution', 'isVolcengine', 'isMetaontic', 'isService', 'isManualKey', 'assertServiceAvailable', 'connectionLabel', 'resolveApiKey', 'resolveBaseUrl', 'resolveSubmitPath', 'resolveQueryPath', 'assertConfigured', 'fetchDeviceQuota', 'remainingCostText', 'segmentContinueLine', 'planSummary', 'unlimitedQuota', 'imageQuotaNotice', 'preflightGate']) {
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
  // 手填 API密钥的接入方式不判断额度：预检任何一步都不该去查这把 API密钥的额度。
  h.fetchDeviceQuota = async () => { throw new Error('metaontic/volcengine must not query service quota'); };
  for (const name of ['video_generate', 'video_extend']) {
    const gate = await h.preflightGate({}, config, { name, arguments: { resume: '/tmp/progress' } });
    assert.equal(gate.kind, 'ask');
    assert.match(gate.displayReason.zh, /按当前 API密钥在渠道的实际用量计费。确认后开始。/);
    assert.doesNotMatch(gate.displayReason.zh, /预估|核对|额度/);
    assert.doesNotMatch(gate.displayReason.en, /estimate|balance/i);
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

test('service 模式调用前先读这把 API密钥的额度，够就弹人工确认', async () => {
  const h = harness(), config = serviceConfig();
  let asked = 0;
  h.fetchDeviceQuota = async (...args) => { asked += 1; return okQuota()(...args); };
  h.estimateUsage = estimateOf(0.1);
  const gate = await h.preflightGate({}, config, { name: 'video_generate', arguments: {} });
  assert.equal(asked, 1, 'MetaOnticVideo 接入要在调用前读一次额度');
  assert.equal(gate.kind, 'ask');
  assert.match(gate.displayReason.zh, /\u70b9\u4e86\u300c\u5141\u8bb8\u300d\u624d\u4f1a\u771f\u6b63\u8c03\u7528/);
  assert.match(gate.displayReason.zh, /\u5f53\u524d\u8d26\u53f7\u4f59\u989d \u00a5100\.00/);
});

test('service 模式额度不够就不调用，提示充值', async () => {
  const h = harness(), config = serviceConfig();
  h.fetchDeviceQuota = okQuota();
  h.estimateUsage = estimateOf(1);
  const gate = await h.preflightGate({}, config, { name: 'video_generate', arguments: {} });
  assert.equal(gate.kind, 'deny');
  assert.match(gate.reason, /\u989d\u5ea6\u4e0d\u8db3\uff0c\u5df2\u505c\u6b62\u8c03\u7528/);
  assert.match(gate.reason, /\u5145\u503c/);
  assert.match(gate.reason, /\u8fd9\u6b21\u6ca1\u6709\u8c03\u7528\u6a21\u578b\u3001\u6ca1\u6709\u4ea7\u751f\u8d39\u7528/);
  // 服务端运行时关掉在线充值：设置页没有「充值」按钮，不能把用户往那个按钮上引。
  assert.match(gate.reason, /没有「充值」按钮/);
});

test('service 模式额度读不到时不拦，仍弹人工确认并说明读不到', async () => {
  const h = harness(), config = serviceConfig();
  h.fetchDeviceQuota = async () => ({ status: 'unknown', reason: 'service did not return quota' });
  h.estimateUsage = estimateOf(0.1);
  const gate = await h.preflightGate({}, config, { name: 'video_generate', arguments: {} });
  assert.equal(gate.kind, 'ask');
  assert.match(gate.displayReason.zh, /\u5f53\u524d\u8d26\u53f7\u4f59\u989d\u8bfb\u4e0d\u5230/);
});

test('service 模式查额度带登录令牌：服务端现在只认它', async () => {
  const h = harness(), config = { ...serviceConfig(), loginKey: 'login-token-abc' };
  const seen = [];
  h.AbortSignal = AbortSignal;
  h.resolveRegisterApi = () => 'https://register.example';
  h.fetch = async (url, init) => {
    seen.push({ url: String(url), headers: init.headers });
    return { ok: true, status: 200, text: async () => JSON.stringify({ code: 0, data: { remain_quota: 100 } }) };
  };
  const quota = await h.fetchDeviceQuota(config, undefined);
  assert.equal(quota.status, 'ok');
  assert.equal(seen.length, 1);
  assert.equal(seen[0].url, 'https://register.example/api/v1/register/quota');
  assert.equal(seen[0].headers['X-Login-Key'], 'login-token-abc');
  assert.equal(seen[0].headers['X-Register-Token'], 'metaontic-video-register-v1');
});

test('service 模式不限额度（unlimited_quota）的 API密钥不比较余额、不误拦', async () => {
  const h = harness(), config = serviceConfig();
  // 服务端创建不限额度 API密钥时 remain_quota 只是占位数字：按它比较会误判成「额度不足、请充值」。
  h.fetchDeviceQuota = okQuota({ unlimited_quota: true, remain_quota: 5000, remain_amount: 0.01 });
  h.estimateUsage = estimateOf(1);
  const gate = await h.preflightGate({}, config, { name: 'video_generate', arguments: {} });
  assert.equal(gate.kind, 'ask');
  assert.match(gate.displayReason.zh, /\u4e0d\u9650\u989d\u5ea6/);
  assert.doesNotMatch(gate.displayReason.zh, /\u989d\u5ea6\u4e0d\u8db3/);
  assert.doesNotMatch(gate.displayReason.zh, /\u00a50\.01/);
});

test('service 模式续做确认与额度判断共用一次额度读取', async () => {
  const h = harness(), config = serviceConfig();
  const quota = okQuota();
  let asked = 0;
  h.fetchDeviceQuota = async () => { asked += 1; return quota(); };
  h.estimateUsage = estimateOf(0.1);
  h.readPauseFile = async () => ({ operationState: {}, done: 1, steps: [{ seconds: 15 }] });
  h.estimateArgsFor = async (_config, _tool, args) => ({ ...args, inputVideoSeconds: 15, remainingPlan: [{ kind: 'extend', seconds: 5 }] });
  const gate = await h.preflightGate({}, config, { name: 'video_generate', arguments: { resume: '/tmp/progress' } });
  assert.equal(gate.kind, 'ask');
  assert.equal(asked, 1, '续做确认与「够不够」只读一次额度');
  assert.match(gate.displayReason.zh, /\u6574\u6761\u8fd8\u5dee 5 \u79d2/);
});

const imageCall = { name: 'video_prepare_image', arguments: { operation: 'create_character', prompt: '角色', style: '二维动画' } };

test('service 模式图片调用先看余额，余额为 0 就停下提示充值', async () => {
  const h = harness(), config = serviceConfig();
  h.fetchDeviceQuota = okQuota({ remain_quota: 0, remain_amount: 0 });
  const gate = await h.preflightGate({}, config, imageCall);
  assert.equal(gate.kind, 'deny');
  assert.match(gate.reason, /\u989d\u5ea6\u4e0d\u8db3/);
  assert.match(gate.reason, /\u5145\u503c/);
  assert.match(gate.reason, /\u6ca1\u6709\u8c03\u7528\u6a21\u578b\u3001\u6ca1\u6709\u4ea7\u751f\u8d39\u7528/);
  assert.match(gate.reason, /没有「充值」按钮/);
});

test('service 模式图片确认带上本机余额，够用就照常确认', async () => {
  const h = harness(), config = serviceConfig();
  h.fetchDeviceQuota = okQuota();
  const gate = await h.preflightGate({}, config, imageCall);
  assert.equal(gate.kind, 'ask');
  assert.match(gate.displayReason.zh, /\u5f53\u524d\u8d26\u53f7\u4f59\u989d \u00a5100\.00/);
  assert.match(gate.displayReason.zh, /\u5355\u72ec\u8ba1\u8d39/);
});

test('MetaOntic AI 图片调用不查额度、确认框不带余额', async () => {
  const h = harness(), config = { connectionMode: 'metaontic', metaonticApiKey: 'm' };
  h.fetchDeviceQuota = async () => { throw new Error('metaontic must not query service quota'); };
  const gate = await h.preflightGate({}, config, imageCall);
  assert.equal(gate.kind, 'ask');
  assert.doesNotMatch(gate.displayReason.zh, /\u4f59\u989d|\u989d\u5ea6/);
  assert.match(gate.displayReason.zh, /\u5355\u72ec\u8ba1\u8d39/);
});
