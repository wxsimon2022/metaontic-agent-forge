/**
 * 支付宝 AI 网页应用收款（网站支付）客户端。
 *
 * 「生成视频前先付钱」这条链路插件只做三步：
 *  1. 问服务端这次生成要不要先付款（服务端关掉收款时这一步就返回未开启）；
 *  2. 要付就先下单，把收银台链接交给用户，让他在浏览器里付款；
 *  3. 用户付完回来重试时，兑换那张「已支付票据」——兑不成就不放行生成。
 *
 * 付款成功与否只看服务端（异步通知 / 交易查询），插件不在本地判断金额、验签或
 * 状态；一次付款只能兑换一张票据，所以「一次付款 = 一次生成」由服务端保证。
 */
import { DEFAULT_REGISTER_TOKEN, PLUGIN_VERSION, ref } from '../config.js';
import { isManualKey, resolveRegisterApi } from '../providers/connection.js';

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
async function callWebpay(config, path: string, init: { method?: string; body?: unknown; signal?: AbortSignal } = {}): Promise<WebpayCall> {
  const api = resolveRegisterApi(config);
  const timeout = AbortSignal.timeout(15000);
  const requestSignal = init.signal ? AbortSignal.any([init.signal, timeout]) : timeout;
  try {
    const response = await fetch(`${api}/api/v1/webpay${path}`, {
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

/**
 * 这次生成要不要先付钱。
 *
 * 只有接入方式 A（服务端领 Key，也就是 MetaOnticVideo 这条接入方式）才可能收钱：
 * B MetaOntic AI / C 火山引擎是用户自己的 Key，插件不经过本服务，也就不走网站支付。
 * 服务端关掉收款、或接口不可用时返回 null（按不收钱处理）。
 */
export async function fetchWebpayStatus(config, signal?): Promise<WebpayStatus | null> {
  if (isManualKey(config)) return null;
  const result = await callWebpay(config, '/status', { signal });
  if (result.status !== 'ok') return null;
  return {
    enabled: result.data?.enabled === true,
    amount: result.data?.amount,
    currency: result.data?.currency,
    subject: result.data?.subject,
  };
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

/** 兑换已支付票据：只有服务端确认「已支付且没兑过」时才返回 ok。 */
export async function consumeWebpayOrder(config, outTradeNo: string, signal?): Promise<WebpayCall> {
  return callWebpay(config, `/orders/${encodeURIComponent(outTradeNo)}/consume`, {
    method: 'POST',
    body: { device_id: String(ref(config, 'deviceId', '')).trim() },
    signal,
  });
}
