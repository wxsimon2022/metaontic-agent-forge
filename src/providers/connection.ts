/** providers/connection：从宿主入口拆出的独立职责模块。 */
import { RELAY_PRESET, ref, KEY_ORIGIN_REGISTER, envValue, DEFAULT_REGISTER_API } from '../config.js';
import { SERVICE_MODE_AVAILABLE, SERVICE_UNAVAILABLE_MESSAGE } from '../connection-defaults.js';

export function relayPreset() {
  // 只走 New API 中转站，路径/模型都取这一份预设。
  return RELAY_PRESET;
}

export function isVolcengine(config) {
  return ref(config, 'connectionMode', 'service') === 'volcengine';
}

export function isMetaontic(config) {
  return ref(config, 'connectionMode', 'service') === 'metaontic';
}

export function isManualKey(config) {
  return isVolcengine(config) || isMetaontic(config);
}

export function isService(config) {
  return ref(config, 'connectionMode', 'service') === 'service';
}

/** A 服务端方式停用期间，任何按该方式发起的连接都直接拒绝。 */
export function assertServiceAvailable(config) {
  if (SERVICE_MODE_AVAILABLE || !isService(config)) return;
  throw new Error(SERVICE_UNAVAILABLE_MESSAGE);
}

export function connectionLabel(config) {
  return isMetaontic(config) ? 'MetaOntic AI' : '火山引擎';
}

export function resolveApiKey(config) {
  if (isMetaontic(config)) return String(ref(config, 'metaonticApiKey', '')).trim();
  if (isVolcengine(config)) return String(ref(config, 'volcengineApiKey', '')).trim();
  // 停用期间不交出这把 Key，任何绕开 assertServiceAvailable 的路径也不会带着它发请求。
  if (!SERVICE_MODE_AVAILABLE) return '';
  // 只认配置里那一把——它只能由设置页「登录」时服务端下发写入，
  // 不读环境变量、也不认手填，避免用到没绑设备 / 没额度的野 Key。
  return String(ref(config, 'apiKey', '')).trim();
}

/**
 * 这把 Key 是不是服务端下发的。
 *
 * 登录成功后设置页会写 keyOrigin=register；更早的版本没写这个标记，
 * 用「设备凭据 + 邮箱」兜底认出来（这两项也只有登录流程会写）。
 */
export function isServerIssuedKey(config) {
  if (String(ref(config, 'keyOrigin', '')).trim() === KEY_ORIGIN_REGISTER) return true;
  return Boolean(String(ref(config, 'deviceId', '')).trim())
    && Boolean(String(ref(config, 'deviceSecret', '')).trim())
    && Boolean(String(ref(config, 'registerEmail', '')).trim());
}

export function resolveBaseUrl(config) {
  if (isVolcengine(config)) return 'https://ark.cn-beijing.volces.com';
  const preset = relayPreset();
  return (String(ref(config, 'baseUrl', '')).trim() || envValue(preset.baseEnv) || preset.baseUrl)
    .replace(/\/+$/, '');
}

export function resolveSubmitPath(config) {
  if (isVolcengine(config)) return '/api/v3/contents/generations/tasks';
  return String(ref(config, 'submitPath', '')).trim() || relayPreset().submitPath;
}

export function resolveQueryPath(config, taskId) {
  if (isVolcengine(config)) return `/api/v3/contents/generations/tasks/${encodeURIComponent(taskId)}`;
  const path = String(ref(config, 'queryPath', '')).trim() || relayPreset().queryPath;
  return path.replace('{task_id}', encodeURIComponent(taskId));
}

export function resolveModel(config) {
  const preset = relayPreset();
  return String(ref(config, 'model', '')).trim() || envValue(preset.modelEnv) || preset.model;
}

/** seedance 2.5 的延长走 omni 参考模式，需要固定 ratio 与任务类型。 */
export function isOmniExtendModel(model) {
  const lowered = String(model).toLowerCase();
  return lowered.includes('seedance-2-5') || lowered.includes('seedance-2.5');
}

export function parseExtraParams(config) {
  const raw = String(ref(config, 'extraParams', '')).trim();
  if (!raw) return {};
  let value;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new Error('配置 extraParams 不是合法 JSON 对象字符串。');
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('配置 extraParams 必须是 JSON 对象。');
  }
  return value;
}

export function assertConfigured(config, apiKey) {
  if (isMetaontic(config)) {
    if (!apiKey) throw new Error('请在 MetaOntic AI 模式中配置 API Key。');
    return;
  }
  if (isVolcengine(config)) {
    if (!apiKey) throw new Error('请在火山引擎直连模式中配置火山 API Key。');
    return;
  }
  assertServiceAvailable(config);
  if (!apiKey) {
    throw new Error(
      '未配置 API Key（重置后需重新登录，无需重装或重启）：打开「插件 → 已安装插件 → MetaOnticVideo → 查看」，点「登录」领一把——'
      + '服务端会把 Key、上游地址和模型直接写进配置，不用手填。',
    );
  }
  if (!isServerIssuedKey(config)) {
    throw new Error(
      '当前 apiKey 不是服务端下发的，插件拒绝调用：密钥只能在插件详情页点「登录」由服务端下发。'
      + '同一个邮箱再登录一次会把原来那把还给你，不会多开一把。',
    );
  }
  if (!resolveBaseUrl(config)) {
    throw new Error(
      '未配置 baseUrl：正常由「登录」时服务端下发中转站地址；'
      + '缺失时请重新登录，或检查设置页里的上游地址。',
    );
  }
}

/** 插件服务地址：配置优先，留空用固定域名。 */
export function resolveRegisterApi(config) {
  return (String(ref(config, 'registerApi', '')).trim() || DEFAULT_REGISTER_API).replace(/\/+$/, '');
}

/** 一次调用固定连接和模型；引用更新只影响下一次调用，密钥不写进断点。 */
export function snapshotConfig(config) {
  const snapshot: Record<string, any> = {};
  for (const key of Object.keys(config || {})) snapshot[key] = ref(config, key, undefined);
  snapshot.connectionMode = isVolcengine(config) ? 'volcengine' : isMetaontic(config) ? 'metaontic' : 'service';
  snapshot.baseUrl = resolveBaseUrl(config);
  snapshot.model = resolveModel(config);
  snapshot.submitPath = resolveSubmitPath(config);
  snapshot.queryPath = isVolcengine(config) ? '/api/v3/contents/generations/tasks/{task_id}' : String(ref(config, 'queryPath', '')).trim() || relayPreset().queryPath;
  return Object.freeze(snapshot);
}

/** 图片沿用当前地址，独立 Key 仅替换本次图片连接快照。 */
export function imageConfig(config) {
  const snapshot = snapshotConfig(config);
  if (!isMetaontic(snapshot) || ref(snapshot, 'imageUseVideoKey', true) !== false) return snapshot;
  const key = String(ref(snapshot, 'imageApiKey', '')).trim();
  if (!key) throw new Error('已关闭图片与视频共用 Key，请单独填写图片模型 API Key。');
  return Object.freeze({ ...snapshot, [isMetaontic(snapshot) ? 'metaonticApiKey' : 'apiKey']: key });
}
