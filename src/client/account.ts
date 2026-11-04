/** 邮箱登录、设备身份、额度和使用记录；状态由设置页持有。 */
export function createAccountActions(context: any) {
/** 服务地址：配置里有就用配置的（老版本固定写死，这里保留兜底）。 */
function registerApiRoot() {
    const configured = String(context.value.registerApi || '').trim();
    return (configured || context.DEFAULT_REGISTER_API).replace(/\/+$/, '');
}

/** 「已登出」标记：重置后置上，登录成功后清掉；期间不自动找回密钥。 */
function loggedOut() {
    try {
        return window.localStorage.getItem(context.LOGGED_OUT_KEY) === '1';
    }
    catch {
        return false;
    }
}

function setLoggedOut() {
    try {
        window.localStorage.setItem(context.LOGGED_OUT_KEY, '1');
    }
    catch {
        // 存不住也不影响本次会话的行为
    }
}

function clearLoggedOut() {
    try {
        window.localStorage.removeItem(context.LOGGED_OUT_KEY);
    }
    catch {
        // 同上
    }
}

/** 重置时抹掉本机设备凭据：下次登录会重新生成一对，重新绑定到同一个邮箱。 */
function forgetDevice() {
    try {
        window.localStorage.removeItem('metaontic-video.device-id');
        window.localStorage.removeItem('metaontic-video.device-secret');
    }
    catch {
        // 抹不掉只是下次还能取回，不影响重置本身
    }
    setLoggedOut();
}

/** 本机身份：本地持久化的设备标识 + 设备密钥，注册时一起交给服务端做绑定。 */
function deviceIdentity() {
    const ID_KEY = 'metaontic-video.device-id';
    const SECRET_KEY = 'metaontic-video.device-secret';
    const rand = () => Math.random().toString(36).slice(2, 10);
    let id = `dsh-${rand()}${Date.now().toString(36)}`;
    let secret = `dsk-${rand()}${rand()}${rand()}`;
    try {
        const savedId = window.localStorage.getItem(ID_KEY);
        const savedSecret = window.localStorage.getItem(SECRET_KEY);
        if (savedId)
            id = savedId;
        else
            window.localStorage.setItem(ID_KEY, id);
        if (savedSecret)
            secret = savedSecret;
        else
            window.localStorage.setItem(SECRET_KEY, secret);
    }
    catch {
        // 存不住就退化成「本次会话内有效」，至少不会把注册弄崩
    }
    return { id, secret };
}

/** 设备指纹：只做登记，让后台看得出这把 Key 是哪台机器领的。 */
function deviceFingerprint() {
    const pick = (read) => {
        try {
            const value = read();
            return value ? String(value).slice(0, 120) : undefined;
        }
        catch {
            return undefined;
        }
    };
    const nav = (): Navigator => window.navigator;
    const info = {
        app: 'Harness',
        plugin: 'metaontic-video',
        platform: pick(() => nav().userAgentData?.platform || nav().platform),
        os: pick(() => nav().userAgentData?.platform || nav().platform),
        language: pick(() => nav().language),
        timezone: pick(() => window.Intl?.DateTimeFormat().resolvedOptions().timeZone),
        screen: pick(() => `${window.screen?.width}x${window.screen?.height}`),
        agent: pick(() => nav().userAgent),
    };
    return Object.fromEntries(Object.entries(info).filter(([, v]) => v !== undefined));
}

function deviceLabel(info) {
    const platform = info?.platform || info?.os;
    return platform ? `Harness-${platform}` : 'Harness';
}

/**
 * 设备凭据（设备标识 + 设备密钥）要同步进插件配置。
 *
 * 生成视频前，主进程那侧的工具会拿它去服务端查这把 Key 的剩余额度，
 * 只在人工确认框里展示余额（余额不足不再阻断调用）；设备凭据平时只存在
 * 浏览器 localStorage 里，主进程读不到，所以这里写一份到配置里。
 * 值与配置一致时不重复写。
 */
function deviceWrites(device = undefined) {
    const identity = device || deviceIdentity();
    const current = context.form.getSnapshot().value || {};
    const writes: Array<[
        string,
        string
    ]> = [];
    if (!context.same(current.deviceId, identity.id))
        writes.push(['deviceId', identity.id]);
    if (!context.same(current.deviceSecret, identity.secret)) {
        writes.push(['deviceSecret', identity.secret]);
    }
    return writes;
}

/** 进设置页时补一次设备凭据（老版本没存过，注册过的人不用重新领 Key）。 */
async function syncDeviceIdentity() {
    if (!context.serviceActive())
        return;
    const writes = deviceWrites();
    if (!writes.length)
        return;
    context.connectionBusy.current = true;
    try {
        const pending = context.persistBatch(context.form, writes.map(([key, next]) => ({ op: 'set', path: [key], value: next })));
        context.connectionBusy.pending = pending;
        await pending;
        for (const [key] of writes)
            context.clear(key);
    }
    catch {
        // 后续登录仍可重新保存设备凭据。
    }
    finally {
        context.connectionBusy.current = false;
        context.connectionBusy.pending = null;
    }
}

/** 取注册服务的 JSON：后端是 {code, data, message} 信封，这里拆开并统一抛错。 */
async function callRegister(url: string, init: RequestInit = {}) {
    const controller = typeof AbortController === 'function' ? new AbortController() : null;
    const timer = controller ? window.setTimeout(() => controller.abort(), 90000) : null;
    const token = String(context.value.registerToken || context.DEFAULT_REGISTER_TOKEN);
    const options = { ...(init || {}) };
    options.headers = {
        accept: 'application/json',
        'x-register-token': token,
        // 本插件版本：服务端会记进请求日志，便于回溯「这版有没有问题」
        ...(context.PLUGIN_VERSION ? { 'x-plugin-version': context.PLUGIN_VERSION } : {}),
        ...((init && init.headers) || {}),
    };
    let response;
    try {
        response = await fetch(url, {
            signal: controller ? controller.signal : undefined,
            ...options,
        });
    }
    finally {
        if (timer)
            window.clearTimeout(timer);
    }
    const text = await response.text();
    let body = null;
    try {
        body = text ? JSON.parse(text) : null;
    }
    catch {
        body = null;
    }
    const payload = body && typeof body === 'object' && 'data' in body ? body.data : body;
    if (!response.ok || (body && typeof body === 'object' && body.code)) {
        const failure: any = new Error((body && (body.message || body.detail)) || text.slice(0, 200) || `HTTP ${response.status}`);
        failure.status = response.status;
        throw failure;
    }
    return payload || {};
}

/** 把服务端给的那把密钥写回配置（注册、取回都走这里）。 */
async function applyRegistration(result, fallbackBase, device) {
    // keyOrigin 是给宿主那侧看的标记：只有带这个标记（或早期版本的设备凭据 + 邮箱）
    // 的 Key 才被当成「服务端下发的」，手填的一律拒绝调用。
    if (context.connectionBusy.current) {
        if (!context.connectionBusy.pending)
            throw new Error(context.settingsError('settingsUnavailable'));
        await context.connectionBusy.pending;
    }
    const writes = [
        ['apiKey', result.api_key],
        ['keyOrigin', 'register'],
        ['baseUrl', result.base_url || fallbackBase || registerApiRoot()],
        ...await deviceWrites(device),
    ];
    // 邮箱是账号：存回本地，方便下次认出「这台机器绑的是哪个邮箱」；
    // 中转站里的密钥名由服务端生成唯一串，与邮箱的绑定关系在服务端。
    const account = result.email || result.display_name || '';
    if (account)
        writes.push(['registerEmail', account]);
    if (result.model)
        writes.push(['model', result.model]);
    if (context.connectionBusy.current)
        throw new Error(context.settingsError('settingsUnavailable'));
    context.connectionBusy.current = true;
    try {
        const pending = context.persistConnection(context.form, writes, 'service');
        context.connectionBusy.pending = pending;
        await pending;
        clearLoggedOut();
        for (const [key] of writes)
            context.clear(key);
        context.setRegisterStatus('ok');
    }
    catch (error) {
        throw new Error(context.settingsError(error));
    }
    finally {
        context.connectionBusy.current = false;
        context.connectionBusy.pending = null;
    }
    loadQuota().catch(() => { });
    loadUsage().catch(() => { });
    return true;
}

/** 本机取回：只有设备标识 + 设备密钥都对上，服务端才把注册信息给你。 */
async function lookupOwnKey() {
    const device = deviceIdentity();
    const result = await callRegister(`${registerApiRoot()}/api/v1/register/lookup`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({ device_id: device.id, device_secret: device.secret }),
    });
    if (!result.api_key)
        throw new Error(context.t('registerNoKey'));
    if (!await applyRegistration(result, null, device))
        return;
    context.setRegisterStatus('restored');
    return result;
}

/** 倒计时：同一个邮箱 60 秒才能再发一封，按钮上直接显示还剩几秒。 */
function startCooldown(seconds) {
    const total = Math.max(Math.round(Number(seconds) || 0), 0);
    if (!total)
        return;
    context.setCodeCooldown(total);
    const tick = (left) => {
        if (left <= 0) {
            context.setCodeCooldown(0);
            return;
        }
        context.setCodeCooldown(left);
        window.setTimeout(() => tick(left - 1), 1000);
    };
    window.setTimeout(() => tick(total - 1), 1000);
}

/** 获取验证码：邮箱是账号，服务端把验证码发到这个邮箱。 */
async function sendEmailCode() {
    const account = context.registerEmail.trim();
    if (!account) {
        context.setCodeStatus('failed');
        context.setCodeMessage(context.t('registerNeedEmail'));
        return;
    }
    context.setCodeStatus('working');
    context.setCodeMessage('');
    try {
        const status = await callRegister(`${registerApiRoot()}/api/v1/register/status`);
        if (!status.enabled) {
            context.setCodeStatus('failed');
            context.setCodeMessage(context.t('registerDisabled', { message: status.hint || '-' }));
            return;
        }
        const result = await callRegister(`${registerApiRoot()}/api/v1/register/email/code`, {
            method: 'POST',
            headers: { 'content-type': 'application/json', accept: 'application/json' },
            body: JSON.stringify({ email: account }),
        });
        context.setCodeStatus('sent');
        context.setCodeMessage(context.t('registerCodeSent', { email: result.email || account }));
        startCooldown(result.retry_after ?? 60);
        context.setRegisterStatus('idle');
        context.setRegisterMessage('');
    }
    catch (error) {
        context.setCodeStatus('failed');
        context.setCodeMessage(error?.message || String(error));
    }
}

async function register() {
    const root = registerApiRoot();
    const account = context.registerEmail.trim();
    const code = context.registerCode.trim();
    if (!account) {
        context.setRegisterStatus('failed');
        context.setRegisterMessage(context.t('registerNeedEmail'));
        return;
    }
    if (!code) {
        context.setRegisterStatus('failed');
        context.setRegisterMessage(context.t('registerNeedCode'));
        return;
    }
    context.setRegisterStatus('working');
    context.setRegisterMessage('');
    const device = deviceIdentity();
    const fingerprint = deviceFingerprint();
    try {
        const status = await callRegister(`${root}/api/v1/register/status`);
        if (!status.enabled) {
            context.setRegisterStatus('disabled');
            context.setRegisterMessage(context.t('registerDisabled', { message: status.hint || '-' }));
            return;
        }
        const result = await callRegister(`${root}/api/v1/register`, {
            method: 'POST',
            headers: { 'content-type': 'application/json', accept: 'application/json' },
            body: JSON.stringify({
                email: account,
                code,
                device_id: device.id,
                device_secret: device.secret,
                device_info: fingerprint,
                note: `Harness 插件设置页注册（${deviceLabel(fingerprint)}）`,
            }),
        });
        if (!result.api_key) {
            context.setRegisterStatus('failed');
            context.setRegisterMessage(context.t('registerNoKey'));
            return;
        }
        await applyRegistration(result, status.base_url || root, device);
    }
    catch (error) {
        // 本机早就领过了（或本地密钥丢了）：直接把自己那把取回来
        if (error?.status === 409 || error?.status === 404) {
            try {
                await lookupOwnKey();
                return;
            }
            catch {
                // 取不回来说明不是本机领的，照原样报错
            }
        }
        context.setRegisterStatus('failed');
        context.setRegisterMessage(context.t('registerFailed', { message: error?.message || String(error) }));
    }
}

/**
 * 额度：服务端拿管理端凭据去中转站读这把 Key 的用量。
 * 只有本机（设备标识 + 设备密钥都对上）才拿得到，展示的必然是自己那把。
 */
async function loadQuota() {
    if (!context.serviceMode || !context.serviceActive())
        return;
    const device = deviceIdentity();
    context.setQuotaStatus('working');
    context.setQuotaMessage('');
    try {
        const result = await callRegister(`${registerApiRoot()}/api/v1/register/quota`, {
            method: 'POST',
            headers: { 'content-type': 'application/json', accept: 'application/json' },
            body: JSON.stringify({ device_id: device.id, device_secret: device.secret }),
        });
        if (!context.serviceActive())
            return;
        context.setQuota(result);
        context.setQuotaAt(new Date().toLocaleTimeString());
        context.setQuotaStatus('ok');
        return result;
    }
    catch (error) {
        context.setQuota(null);
        context.setQuotaStatus('failed');
        context.setQuotaMessage(error?.status === 404
            ? context.t('quotaNotRegistered')
            : context.t('quotaFailed', { message: error?.message || String(error) }));
        throw error;
    }
}

/**
 * 余额（钱包）：生成视频优先从余额扣。服务端按设备凭据认账号（邮箱），
 * 换设备重新登录后余额还在；服务端没开钱包（404）时这条链路整体不存在。
 */
async function loadWallet() {
    if (!context.serviceMode || !context.serviceActive())
        return;
    const device = deviceIdentity();
    context.setWalletStatus('working');
    try {
        const result = await callRegister(`${registerApiRoot()}/api/v1/wallet/status`, {
            method: 'POST',
            headers: { 'content-type': 'application/json', accept: 'application/json' },
            body: JSON.stringify({ device_id: device.id, device_secret: device.secret }),
        });
        if (!context.serviceActive())
            return;
        context.setWallet(result);
        context.setWalletStatus('ok');
        return result;
    }
    catch (error) {
        context.setWallet(null);
        // 404 = 服务端没开钱包：不是错误，页面上不显示余额这一栏
        context.setWalletStatus(error?.status === 404 ? 'off' : 'failed');
        if (error?.status !== 404)
            context.setWalletMessage(context.t('quotaFailed', { message: error?.message || String(error) }));
        return null;
    }
}

/** 充值下单：金额由用户填，拿回收银台链接（服务端只认设备凭据对应的账号）。 */
async function startRecharge(amount) {
    const device = deviceIdentity();
    return callRegister(`${registerApiRoot()}/api/v1/wallet/recharge`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({
            device_id: device.id,
            device_secret: device.secret,
            amount: String(amount),
        }),
    });
}

/** 查充值订单：`credited=true` 表示钱已经进余额。 */
async function fetchRecharge(outTradeNo) {
    const device = deviceIdentity();
    return callRegister(`${registerApiRoot()}/api/v1/wallet/recharge/status`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({
            device_id: device.id,
            device_secret: device.secret,
            out_trade_no: outTradeNo,
        }),
    });
}

/**
 * 等付款到账：每 3 秒查一次，最多约 2 分钟；到账就顺手刷新余额与额度。
 * 查询失败不抛错——付款本身在支付宝那边，这里只是「到账没有」的提示。
 */
async function waitRecharge(outTradeNo, { tries = 40, intervalMs = 3000 } = {}) {
    for (let index = 0; index < tries; index += 1) {
        const result = await fetchRecharge(outTradeNo).catch(() => null);
        if (result && result.credited) {
            await loadWallet().catch(() => { });
            await loadQuota().catch(() => { });
            return result;
        }
        if (result && result.status === 'CLOSED') return result;
        await new Promise((resolve) => { window.setTimeout(resolve, intervalMs); });
    }
    return null;
}

/**
 * 使用记录：服务端按「设备标识 + 设备密钥」认出是本机那把 Key，
 * 再去读它的调用日志（谁什么时候出了片、消耗多少），一次任务只显示一行。
 */
async function loadUsage() {
    if (!context.serviceMode || !context.serviceActive() || context.usageInFlight.current)
        return;
    context.usageInFlight.current = true;
    const device = deviceIdentity();
    context.setUsageStatus('working');
    context.setUsageMessage('');
    try {
        const result = await callRegister(`${registerApiRoot()}/api/v1/usage/list`, {
            method: 'POST',
            headers: { 'content-type': 'application/json', accept: 'application/json' },
            body: JSON.stringify({
                device_id: device.id,
                device_secret: device.secret,
                limit: 10,
            }),
        });
        if (!context.serviceActive())
            return;
        context.setUsage(result);
        context.setUsageAt(new Date().toLocaleTimeString());
        context.setUsageStatus('ok');
        return result;
    }
    catch (error) {
        context.setUsageStatus('failed');
        context.setUsageMessage(error?.status === 404
            ? context.t('quotaNotRegistered')
            : context.t('usageFailed', { message: error?.message || String(error) }));
        throw error;
    }
    finally {
        context.usageInFlight.current = false;
    }
}
  return { registerApiRoot, loggedOut, setLoggedOut, clearLoggedOut, forgetDevice, deviceIdentity, deviceFingerprint, deviceLabel, deviceWrites, syncDeviceIdentity, callRegister, applyRegistration, lookupOwnKey, startCooldown, sendEmailCode, register, loadQuota, loadUsage, loadWallet, startRecharge, waitRecharge };
}
