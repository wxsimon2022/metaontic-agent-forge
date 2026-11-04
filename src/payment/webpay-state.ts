/**
 * payment/webpay-state：记住「这台机器上次问到的收款开关」。
 *
 * 插件跑在用户机器上，判断「这次生成要不要先付钱」靠的是问服务端。问不到的时候
 * 既可能是老服务端（根本没有这套接口），也可能是网络/接口出问题——两者不能用同一套
 * 处理：前者必须照常生成，后者如果直接放行，「把收款接口打不通」就成了免费生成的通道。
 * 所以每次成功问到结论都落一份，之后问不到时按上次的结论处理：上次说收钱就先停下。
 */
import path from 'node:path';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dshHome } from '../media/references.js';

const STATE_FILE = 'webpay-state.json';
/** 结论的保鲜期：太久以前的记录不再拿来拦生成（服务端可能早就改了收款开关）。 */
const FRESH_DAYS = 30;

function stateFile() {
  return path.join(dshHome(), 'metaontic-video', STATE_FILE);
}

function normalizeBase(api) {
  return String(api || '').trim().replace(/\/+$/, '');
}

/** 记下这个服务端「收不收钱」。写不进去不影响生成，只是下次没得兜底。 */
export async function rememberWebpayStatus(api, status) {
  const base = normalizeBase(api);
  if (!base) return;
  try {
    const file = stateFile();
    let payload;
    try {
      payload = JSON.parse(await readFile(file, 'utf8'));
    } catch {
      payload = null;
    }
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) payload = {};
    payload[base] = { enabled: status?.enabled === true, enabledAt: new Date().toISOString() };
    await mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
    await writeFile(file, JSON.stringify(payload), { mode: 0o600 });
  } catch {
    // 记不住不影响生成结果：下次问不到就当「不知道」，按老服务端处理。
  }
}

/** 上次问到的结论：true 表示这个服务端收钱。读不到、没记过或记录太旧都当「不知道」。 */
export async function lastWebpayEnabled(api, now = Date.now()) {
  const base = normalizeBase(api);
  if (!base) return false;
  try {
    const payload = JSON.parse(await readFile(stateFile(), 'utf8'));
    const record = payload && typeof payload === 'object' ? payload[base] : null;
    if (!record || record.enabled !== true) return false;
    const at = Date.parse(String(record.enabledAt || ''));
    if (!Number.isFinite(at)) return false;
    return now - at <= FRESH_DAYS * 24 * 60 * 60 * 1000;
  } catch {
    return false;
  }
}
