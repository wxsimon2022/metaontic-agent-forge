/**
 * 支付宝 AI 网页应用收款（网站支付）客户端。
 *
 * 「生成视频前先付钱」这条链路插件只做三步：
 *  1. 问服务端这次生成要不要先付款（服务端关掉收款时这一步就返回未开启）；
 *  2. 要付就先下单，把收银台链接交给用户，让他在浏览器里付款；
 *  3. 用户付完回来重试时，兑换那张「已支付票据」——兑不成就不放行生成；
 *  4. 拿到视频任务 ID 后回写订单（履约凭证），对账时能看出这次付款产出了哪个任务。
 *
 * 付款成功与否只看服务端（异步通知 / 交易查询），插件不在本地判断金额、验签或
 * 状态；一次付款只能兑换一张票据，所以「一次付款 = 一次生成」由服务端保证。
 */
import { DEFAULT_REGISTER_TOKEN, PLUGIN_VERSION, ref } from '../config.js';
import { isManualKey, resolveRegisterApi } from '../providers/connection.js';
import { rememberWebpayStatus } from './webpay-state.js';

/** 一次网站支付订单在插件眼里的样子。 */
export interface WebpayOrder {
  out_trade_no: string;
  amount: string;
  currency: string;
  subject: string;
  /** PENDING_PAYMENT / PAID / CLOSED / REFUNDED / UNKNOWN */
  status: string;
  ticket_status: string;
  pay_url: string;
}

export interface WebpayStatus {
  enabled: boolean;
  amount?: string;
  currency?: string;
  subject?: string;
  /** 服务端没答上来（网络不通 / 接口不可用）：不能据此当成「不收钱」。 */
  offline?: boolean;
  reason?: string;
}

export interface WebpayCall {
  status: 'ok' | 'unknown';
  reason?: string;
  data?: any;
}

function webpayHeaders(config) {
  return {
    accept: 'application/json',
    'content-type': 'application/json',
    'X-Register-Token': String(ref(config, 'registerToken', '')).trim() || DEFAULT_REGISTER_TOKEN,
    ...(PLUGIN_VERSION ? { 'X-Plugin-Version': PLUGIN_VERSION } : {}),
  };
}

function deviceBody(config) {
  return {
    device_id: String(ref(config, 'deviceId', '')).trim(),
    device_secret: String(ref(config, 'deviceSecret', '')).trim(),
    plugin_version: PLUGIN_VERSION || undefined,
  };
}

/**
 * 插件服务端的支付接口调用：任何异常都收敛成 `unknown`，由调用方决定放行还是拦。
 * 不收钱的操作（查状态）失败时不能把生成堵死；收钱的操作用 `ok` 判断，失败一律不生成。
 */
async function callApi(
  config,
  base: string,
  path: string,
  init: { method?: string; body?: unknown; signal?: AbortSignal } = {},
): Promise<WebpayCall> {
  const api = resolveRegisterApi(config);
  const timeout = AbortSignal.timeout(15000);
  const requestSignal = init.signal ? AbortSignal.any([init.signal, timeout]) : timeout;
  try {
    const response = await fetch(`${api}/api/v1${base}${path}`, {
      method: init.method || 'GET',
      headers: webpayHeaders(config),
      ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
      signal: requestSignal,
    });
    const text = await response.text();
    let body: any = {};
    if (text) {
      try {
        body = JSON.parse(text);
      } catch {
        body = { message: text.slice(0, 200) };
      }
    }
    const payload = body && typeof body === 'object' && body.data !== undefined ? body.data : body;
    if (!response.ok || (body && typeof body === 'object' && body.code)) {
      return {
        status: 'unknown',
        reason: (body && (body.message || body.detail)) || `HTTP ${response.status}`,
      };
    }
    return { status: 'ok', data: payload || {} };
  } catch (error) {
    return { status: 'unknown', reason: error?.message || String(error) };
  }
}

async function callWebpay(config, path: string, init: { method?: string; body?: unknown; signal?: AbortSignal } = {}): Promise<WebpayCall> {
  return callApi(config, '/webpay', path, init);
}

async function callWallet(config, path: string, init: { method?: string; body?: unknown; signal?: AbortSignal } = {}): Promise<WebpayCall> {
  return callApi(config, '/wallet', path, init);
}

/**
 * 这次生成要不要先付钱。
 *
 * 只有接入方式 A（服务端领 Key，也就是 MetaOnticVideo 这条接入方式）才可能收钱：
 * B MetaOntic AI / C 火山引擎是用户自己的 Key，插件不经过本服务，也就不走网站支付。
 * 服务端没答上来时返回带 ``offline`` 的结论（调用方按上次问到的结论判断），
 * 只有「自带 Key 的接入方式」才返回 null（这条路根本不经本服务）。
 */
export async function fetchWebpayStatus(config, signal?): Promise<WebpayStatus | null> {
  if (isManualKey(config)) return null;
  const api = resolveRegisterApi(config);
  const result = await callWebpay(config, '/status', { signal });
  if (result.status !== 'ok') {
    return { enabled: false, offline: true, reason: result.reason || '服务端没有响应' };
  }
  const status: WebpayStatus = {
    enabled: result.data?.enabled === true,
    amount: result.data?.amount,
    currency: result.data?.currency,
    subject: result.data?.subject,
  };
  // 这次的结论留着：以后问不到时按它处理，免得「打不通收款接口」变成免费生成的通道。
  await rememberWebpayStatus(api, status);
  return status;
}

/**
 * 下单（同一设备已有可用订单时服务端会复用，不会一次刷新就堆一堆废单）。
 * 返回 null 表示拿不到可信订单，调用方必须按「没付款」处理。
 */
export async function createWebpayOrder(config, signal?): Promise<WebpayOrder | null> {
  const result = await callWebpay(config, '/orders', { method: 'POST', body: deviceBody(config), signal });
  if (result.status !== 'ok' || !result.data?.out_trade_no) return null;
  return result.data as WebpayOrder;
}

/**
 * 履约回写：把视频任务 ID 交给服务端记到这笔订单上，代表「这次付款真的产出了任务」。
 * 只作凭证与对账，回写失败不影响用户已经拿到的视频（调用方自己决定重试）。
 */
export async function fulfillWebpayOrder(config, outTradeNo: string, taskId: string, signal?): Promise<WebpayCall> {
  const id = String(taskId || '').trim();
  if (!id) return { status: 'unknown', reason: '缺少任务 ID' };
  return callWebpay(config, `/orders/${encodeURIComponent(outTradeNo)}/fulfill`, {
    method: 'POST',
    body: { ...deviceBody(config), task_id: id },
    signal,
  });
}

/** 兑换已支付票据：只有服务端确认「已支付且没兑过」时才返回 ok。 */
export async function consumeWebpayOrder(config, outTradeNo: string, signal?): Promise<WebpayCall> {
  return callWebpay(config, `/orders/${encodeURIComponent(outTradeNo)}/consume`, {
    method: 'POST',
    body: { device_id: String(ref(config, 'deviceId', '')).trim() },
    signal,
  });
}

/** 账户余额（钱包）：生成前先看余额够不够，够就不用跳浏览器付款。 */
export interface WalletStatus {
  enabled: boolean;
  email?: string | null;
  /** 余额与每次生成的价格（元，两位小数字符串） */
  balance: string;
  price: string;
  currency: string;
  currency_symbol: string;
  subject?: string;
  recharge_min: string;
  recharge_max: string;
}

/** 余额状态：自带 Key 的接入方式没有余额可查，返回 unknown。 */
export async function fetchWalletStatus(config, signal?): Promise<WebpayCall> {
  if (isManualKey(config)) return { status: 'unknown', reason: '自带 Key 的接入方式不走本服务余额' };
  return callWallet(config, '/status', { method: 'POST', body: deviceBody(config), signal });
}

/** 扣余额生成：服务端扣一次并直接给一张「已支付」订单，不用浏览器付款。 */
export async function consumeWalletForGeneration(config, signal?): Promise<WebpayCall> {
  return callWallet(config, '/consume', { method: 'POST', body: deviceBody(config), signal });
}

/** 充值下单：金额由用户在设置页填，返回收银台链接。 */
export async function createRechargeOrder(config, amount: string | number, signal?): Promise<WebpayCall> {
  return callWallet(config, '/recharge', {
    method: 'POST',
    body: { ...deviceBody(config), amount: String(amount) },
    signal,
  });
}

/** 充值状态：轮询到 `credited=true` 就是余额已经到账。 */
export async function fetchRechargeOrder(config, outTradeNo: string, signal?): Promise<WebpayCall> {
  return callWallet(config, '/recharge/status', {
    method: 'POST',
    body: { ...deviceBody(config), out_trade_no: outTradeNo },
    signal,
  });
}

/** 释放凭据：一段都没生成成时把这次的凭据还回去（余额扣减的会把钱退回余额）。 */
export async function releaseWebpayOrder(config, outTradeNo: string, signal?): Promise<WebpayCall> {
  return callWebpay(config, `/orders/${encodeURIComponent(outTradeNo)}/release`, {
    method: 'POST',
    body: deviceBody(config),
    signal,
  });
}
