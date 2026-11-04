import { sourceOf } from './source.mjs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { test } from 'node:test';

// 付款卡口（paymentGate）是「确认生成视频时先付款」的唯一入口：
// 从源码里单独取出来，配上假的支付客户端，验证它只在该拦的时候拦。
const source = sourceOf('providers/connection', 'workflow/approval');

function harness(webpay) {
  const context = vm.createContext({
    ref: (config, key, fallback) => config[key] ?? fallback,
    formatMoney: (value, symbol = '¥') => `${symbol}${Number(value).toFixed(2)}`,
    fetchWebpayStatus: webpay.status,
    createWebpayOrder: webpay.create,
    consumeWebpayOrder: webpay.consume || (async () => ({ status: 'unknown' })),
    // 余额这条路：默认「服务端没开钱包」，老用例照旧走直付
    fetchWalletStatus: webpay.wallet || (async () => ({ status: 'ok', data: { enabled: false } })),
    consumeWalletForGeneration: webpay.consumeWallet || (async () => ({ status: 'unknown' })),
    resolveModel: () => 'doubao-seedance-2-0-mini-260615',
    resolveResolution: () => '480p',
    // 卡口进程内的两个外部依赖：上次问到的收款开关（兜底）与插件服务地址。
    lastWebpayEnabled: webpay.lastEnabled || (async () => false),
    resolveRegisterApi: () => 'https://video.mybfs.cn',
    paidOrders: new WeakMap(),
  });
  for (const name of ['isVolcengine', 'isMetaontic', 'isManualKey', 'paymentInstruction', 'paymentMoment', 'rememberPaidOrder', 'takePaidNote', 'readWallet', 'paymentGate']) {
    const start = source.search(new RegExp(`(?:async )?function ${name}\\(`));
    assert.ok(start >= 0, name);
    vm.runInContext(source.slice(start, source.indexOf('\n}', start) + 2), context);
  }
  return context;
}

const order = {
  out_trade_no: 'WP123456',
  amount: '9.90',
  currency: 'CNY',
  subject: 'MetaOnticVideo AI 视频生成',
  status: 'PENDING_PAYMENT',
  ticket_status: 'UNUSED',
  pay_url: 'https://video.example.com/api/v1/webpay/checkout/WP123456',
};

test('只有生成/延长视频才走付款卡口', async () => {
  const h = harness({ status: async () => ({ enabled: true }) });
  for (const name of ['video_setup', 'video_prepare_image', 'media_submission']) {
    assert.equal(await h.paymentGate({}, { name, arguments: {} }), null);
  }
});

test('自带 Key 的接入方式（B MetaOntic AI / C 火山引擎）不收钱', async () => {
  let asked = 0;
  const h = harness({
    status: async () => { asked++; return { enabled: true }; },
  });
  for (const connectionMode of ['metaontic', 'volcengine']) {
    const gate = await h.paymentGate({ connectionMode }, { name: 'video_generate', arguments: {} });
    assert.equal(gate, null);
  }
  assert.equal(asked, 0);
});

test('服务端没开收款时不打扰生成流程', async () => {
  const h = harness({
    status: async () => ({ enabled: false }),
    create: async () => { throw new Error('must not create an order'); },
  });
  assert.equal(await h.paymentGate({}, { name: 'video_generate', arguments: {} }), null);
});

test('查不到「要不要收钱」时按不收钱处理，不能把生成堵死', async () => {
  const h = harness({
    status: async () => { throw new Error('offline'); },
    create: async () => { throw new Error('must not create an order'); },
  });
  assert.equal(await h.paymentGate({}, { name: 'video_generate', arguments: {} }), null);
});

test('还没付款时把收银台链接和订单号退给模型', async () => {
  const h = harness({ status: async () => ({ enabled: true, amount: '9.90', currency: 'CNY' }), create: async () => order });
  const gate = await h.paymentGate({}, { name: 'video_generate', arguments: {} });
  assert.equal(gate.kind, 'deny');
  assert.match(gate.reason, /需要先付款/);
  assert.match(gate.reason, /¥9\.90/);
  assert.match(gate.reason, /WP123456/);
  assert.match(gate.reason, /https:\/\/video\.example\.com\/api\/v1\/webpay\/checkout\/WP123456/);
  assert.match(gate.reason, /重新调用 video_generate/);
  assert.equal(gate.info.webpayPending, true);
  assert.equal(gate.info.out_trade_no, 'WP123456');
  // 付款前要说清这次付的是什么：模型与清晰度。
  assert.match(gate.reason, /doubao-seedance-2-0-mini-260615 · 480p/);
  assert.match(gate.reason, /付过款就不再另弹确认框/);
});

test('续拍段的付款说明指向 video_extend', async () => {
  const h = harness({ status: async () => ({ enabled: true }), create: async () => order });
  const gate = await h.paymentGate({}, { name: 'video_extend', arguments: {} });
  assert.equal(gate.kind, 'deny');
  assert.match(gate.reason, /重新调用 video_extend/);
});

test('已支付且凭据兑换成功时回「已付款」，由预检直接放行', async () => {
  const h = harness({
    status: async () => ({ enabled: true }),
    create: async () => ({ ...order, status: 'PAID', paid_at: '2026-11-04 15:12:32.938501' }),
    consume: async () => ({ status: 'ok', data: { ticket_status: 'USED' } }),
  });
  const exec = { name: 'video_generate', arguments: {} };
  const gate = await h.paymentGate({}, exec);
  assert.equal(gate.kind, 'paid');
  assert.equal(gate.outTradeNo, 'WP123456');
  assert.equal(gate.money, '¥9.90');
  // 复用了以前那笔付款：结果里必须写清「用的是哪笔钱」，否则用户会以为支付被跳过了。
  const note = h.takePaidNote(exec);
  assert.match(note, /WP123456/);
  assert.match(note, /¥9\.90/);
  assert.match(note, /不再重复收费/);
  assert.match(note, /2026-11-04 2[0-9]:12/); // 服务端给的是 UTC，写进结果要按本机时间
  assert.equal(h.takePaidNote(exec), ''); // 一次生成只说一次
});

test('没兑换过凭据时不写「用了以前那笔付款」的说明', async () => {
  const h = harness({ status: async () => ({ enabled: true }), create: async () => order });
  const exec = { name: 'video_generate', arguments: {} };
  await h.paymentGate({}, exec);
  assert.equal(h.takePaidNote(exec), '');
});

test('收款接口连不上、但此前问到的结论是「这里收钱」时停下，不放行生成', async () => {
  const h = harness({
    status: async () => ({ enabled: false, offline: true, reason: 'fetch failed' }),
    lastEnabled: async () => true,
    create: async () => { throw new Error('must not create an order'); },
  });
  const gate = await h.paymentGate({}, { name: 'video_generate', arguments: {} });
  assert.equal(gate.kind, 'deny');
  assert.match(gate.reason, /收款服务连不上/);
  assert.match(gate.reason, /没有调用模型、没有产生费用/);
});

test('收款接口连不上、也从没问到过收钱（老服务端）时照常放行', async () => {
  const h = harness({
    status: async () => ({ enabled: false, offline: true, reason: 'fetch failed' }),
    lastEnabled: async () => false,
    create: async () => { throw new Error('must not create an order'); },
  });
  assert.equal(await h.paymentGate({}, { name: 'video_generate', arguments: {} }), null);
});

test('服务端明确说「不收钱」时不受兜底影响', async () => {
  const h = harness({
    status: async () => ({ enabled: false }),
    lastEnabled: async () => { throw new Error('must not ask the cache'); },
    create: async () => { throw new Error('must not create an order'); },
  });
  assert.equal(await h.paymentGate({}, { name: 'video_generate', arguments: {} }), null);
});

test('兑换不到凭据时停下，不让用户白付也没生成', async () => {
  const h = harness({
    status: async () => ({ enabled: true }),
    create: async () => ({ ...order, status: 'PAID' }),
    consume: async () => ({ status: 'unknown', reason: '订单未支付或票据已经兑换过' }),
  });
  const gate = await h.paymentGate({}, { name: 'video_generate', arguments: {} });
  assert.equal(gate.kind, 'deny');
  assert.match(gate.reason, /没能兑换/);
  assert.match(gate.reason, /不要重复付款/);
  assert.doesNotMatch(gate.reason, /https:\/\/video\.example\.com/);
});

test('开着收款却下不了单时停下，并说明没有产生费用', async () => {
  const h = harness({ status: async () => ({ enabled: true }), create: async () => null });
  const gate = await h.paymentGate({}, { name: 'video_generate', arguments: {} });
  assert.equal(gate.kind, 'deny');
  assert.match(gate.reason, /收款服务暂时不可用/);
  assert.match(gate.reason, /没有调用模型、没有产生费用/);
});

test('下单抛异常也不能变成放行', async () => {
  const h = harness({
    status: async () => ({ enabled: true }),
    create: async () => { throw new Error('boom'); },
  });
  const gate = await h.paymentGate({}, { name: 'video_generate', arguments: {} });
  assert.equal(gate.kind, 'deny');
});

test('余额够时直接扣余额放行，不把用户甩到浏览器付款', async () => {
  let created = 0;
  const h = harness({
    status: async () => ({ enabled: true, amount: '9.90', currency: 'CNY' }),
    create: async () => { created++; return order; },
    wallet: async () => ({
      status: 'ok',
      data: { enabled: true, balance: '30.00', price: '9.90', currency_symbol: '¥' },
    }),
    consumeWallet: async () => ({ status: 'ok', data: { out_trade_no: 'WD123456', paid_at: '2026-11-05T06:00:00' } }),
  });
  const exec = { name: 'video_generate', arguments: {} };
  const gate = await h.paymentGate({}, exec);
  assert.equal(gate.kind, 'paid');
  assert.equal(gate.outTradeNo, 'WD123456');
  assert.equal(created, 0);
  assert.match(h.takePaidNote(exec) || '', /余额/, '应说明这次是从余额扣的');
});

test('余额不够时停下并提示去设置页充值', async () => {
  let consumed = 0;
  const h = harness({
    status: async () => ({ enabled: true, amount: '9.90', currency: 'CNY' }),
    create: async () => { throw new Error('must not create an order'); },
    wallet: async () => ({
      status: 'ok',
      data: { enabled: true, balance: '1.00', price: '9.90', currency_symbol: '¥' },
    }),
    consumeWallet: async () => { consumed++; return { status: 'unknown' }; },
  });
  const gate = await h.paymentGate({}, { name: 'video_generate', arguments: {} });
  assert.equal(gate.kind, 'deny');
  assert.match(gate.reason, /余额不足/);
  assert.match(gate.reason, /充值/);
  assert.equal(consumed, 0);
});

test('余额扣减失败（刚好被用掉）时退回直付，而不是把生成堵死', async () => {
  const h = harness({
    status: async () => ({ enabled: true, amount: '9.90', currency: 'CNY' }),
    create: async () => order,
    wallet: async () => ({
      status: 'ok',
      data: { enabled: true, balance: '30.00', price: '9.90', currency_symbol: '¥' },
    }),
    consumeWallet: async () => ({ status: 'unknown', reason: '余额不足' }),
  });
  const gate = await h.paymentGate({}, { name: 'video_generate', arguments: {} });
  assert.equal(gate.kind, 'deny');
  assert.match(gate.reason, /WP123456/, '应给出这张直付订单的收银台链接');
});
