import { sourceOf } from './source.mjs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { test } from 'node:test';

// 支付客户端：只验证「跟服务端怎么说话」这一层（路径、请求头、设备凭据、错误收敛）。
const source = sourceOf('config', 'providers/connection', 'payment/webpay');

function harness(responses) {
  const calls = [];
  const fetch = async (url, init = {}) => {
    calls.push({ url, init });
    const next = responses.shift();
    if (!next) throw new Error('unexpected request');
    if (next instanceof Error) throw next;
    return {
      ok: next.ok !== false,
      status: next.status ?? 200,
      text: async () => (next.body === undefined ? '' : JSON.stringify(next.body)),
    };
  };
  // config.ts 里的配置模型只在插件启动时用，这里给个最简替身让源码能跑起来
  const schema = new Proxy({}, { get: () => () => schema });
  const context = vm.createContext({
    METAONTIC_BASE_URL: 'https://ai.bileego.com',
    z: schema,
    AbortSignal,
    fetch,
    __PLUGIN_VERSION__: '3.13.16',
  });
  vm.runInContext(source, context);
  return { context, calls };
}

const CONFIG = { connectionMode: 'service', deviceId: 'dev-1', deviceSecret: 'secret-1' };

test('自带 Key 的接入方式不问收款接口', async () => {
  const { context, calls } = harness([]);
  for (const connectionMode of ['metaontic', 'volcengine']) {
    assert.equal(await context.fetchWebpayStatus({ ...CONFIG, connectionMode }), null);
  }
  assert.equal(calls.length, 0);
});

test('收款接口说得清价格和标题', async () => {
  const { context, calls } = harness([
    { body: { code: 0, data: { enabled: true, amount: '9.90', currency: 'CNY', subject: '生成一条视频' } } },
  ]);
  const status = await context.fetchWebpayStatus(CONFIG);
  // vm 里造出来的对象跟外面不同源，逐字段比而不是整体深比
  assert.equal(status.enabled, true);
  assert.equal(status.amount, '9.90');
  assert.equal(status.currency, 'CNY');
  assert.equal(status.subject, '生成一条视频');
  assert.equal(calls[0].url, 'https://video.mybfs.cn/api/v1/webpay/status');
  assert.equal(calls[0].init.method, 'GET');
  assert.equal(calls[0].init.headers['X-Register-Token'], 'metaontic-video-register-v1');
});

test('收款接口不可用时返回 null，不把生成堵死', async () => {
  const { context } = harness([
    { status: 404, body: { code: 404, message: '没有这个接口' } },
    new Error('offline'),
  ]);
  assert.equal(await context.fetchWebpayStatus(CONFIG), null);
  assert.equal(await context.fetchWebpayStatus(CONFIG), null);
});

test('下单带设备凭据，回包直接当订单用', async () => {
  const order = {
    out_trade_no: 'WP1', amount: '9.90', currency: 'CNY', subject: '生成一条视频',
    status: 'PENDING_PAYMENT', ticket_status: 'UNUSED', pay_url: 'https://video.mybfs.cn/api/v1/webpay/checkout/WP1',
  };
  const { context, calls } = harness([{ body: { code: 0, data: order } }]);
  const placed = await context.createWebpayOrder(CONFIG);
  for (const [key, value] of Object.entries(order)) assert.equal(placed[key], value);
  assert.equal(calls[0].url, 'https://video.mybfs.cn/api/v1/webpay/orders');
  assert.equal(calls[0].init.method, 'POST');
  const body = JSON.parse(calls[0].init.body);
  assert.equal(body.device_id, 'dev-1');
  assert.equal(body.device_secret, 'secret-1');
  assert.equal(body.plugin_version, '3.13.16');
});

test('下单没有订单号时按「拿不到可信订单」处理', async () => {
  const { context } = harness([
    { body: { code: 0, data: { status: 'PENDING_PAYMENT' } } },
    new Error('offline'),
  ]);
  assert.equal(await context.createWebpayOrder(CONFIG), null);
  assert.equal(await context.createWebpayOrder(CONFIG), null);
});

test('兑换票据走 consume 路径并带上设备标识', async () => {
  const { context, calls } = harness([{ body: { code: 0, data: { ticket_status: 'USED' } } }]);
  const result = await context.consumeWebpayOrder(CONFIG, 'WP/1');
  assert.equal(result.status, 'ok');
  assert.equal(calls[0].url, 'https://video.mybfs.cn/api/v1/webpay/orders/WP%2F1/consume');
  assert.equal(calls[0].init.method, 'POST');
  assert.equal(JSON.parse(calls[0].init.body).device_id, 'dev-1');
});

test('兑换失败时把服务端原因带回去', async () => {
  const { context } = harness([{ status: 402, body: { code: 402, message: '订单未支付或票据已经兑换过' } }]);
  const result = await context.consumeWebpayOrder(CONFIG, 'WP1');
  assert.equal(result.status, 'unknown');
  assert.match(result.reason, /订单未支付或票据已经兑换过/);
});
