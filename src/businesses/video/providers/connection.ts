/** providers/connection：从宿主入口拆出的独立职责模块。 */
import { RELAY_PRESET, ref, envValue } from '../config.js';
import { IMAGE_MODEL, resolveImageModel } from '../connection-defaults.js';

export function relayPreset() {
  // 只走 New API 中转站，路径/模型都取这一份预设。
  return RELAY_PRESET;
}

export function isVolcengine(config) {
  return ref(config, 'connectionMode', 'metaontic') === 'volcengine';
}

export function isMetaontic(config) {
  return ref(config, 'connectionMode', 'metaontic') === 'metaontic';
}

export function isManualKey(config) {
  return isVolcengine(config) || isMetaontic(config);
}

export function connectionLabel(config) {
  return isMetaontic(config) ? 'MetaOntic AI' : '火山引擎';
}

export function resolveApiKey(config) {
  if (isMetaontic(config)) return String(ref(config, 'metaonticApiKey', '')).trim();
  if (isVolcengine(config)) return String(ref(config, 'volcengineApiKey', '')).trim();
  throw new Error('请在设置页选择 MetaOntic AI 或火山引擎直连并保存配置。');
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
    if (!apiKey) throw new Error('请在 MetaOntic AI 模式中配置 API密钥。');
    return;
  }
  if (isVolcengine(config)) {
    if (!apiKey) throw new Error('请在火山引擎直连模式中配置火山 API密钥。');
    return;
  }
  throw new Error('请在设置页选择接入方式并保存配置。');
}

/** 一次调用固定连接和模型；引用更新只影响下一次调用，密钥不写进断点。 */
export function snapshotConfig(config) {
  if (!isManualKey(config)) throw new Error('请在设置页选择有效接入方式并保存。');
  const snapshot: Record<string, any> = {};
  for (const key of Object.keys(config || {})) snapshot[key] = ref(config, key, undefined);
  snapshot.connectionMode = isVolcengine(config) ? 'volcengine' : 'metaontic';
  snapshot.baseUrl = resolveBaseUrl(config);
  snapshot.model = resolveModel(config);
  snapshot.imageModel = resolveImageModel(ref(config, 'imageModel', IMAGE_MODEL));
  snapshot.submitPath = resolveSubmitPath(config);
  snapshot.queryPath = isVolcengine(config) ? '/api/v3/contents/generations/tasks/{task_id}' : String(ref(config, 'queryPath', '')).trim() || relayPreset().queryPath;
  return Object.freeze(snapshot);
}

/** 图片沿用当前地址，独立 API密钥仅替换本次图片连接快照。 */
export function imageConfig(config) {
  const snapshot = snapshotConfig(config);
  if (!isMetaontic(snapshot) || ref(snapshot, 'imageUseVideoKey', true) !== false) return snapshot;
  const key = String(ref(snapshot, 'imageApiKey', '')).trim();
  if (!key) throw new Error('已关闭图片与视频共用 API密钥，请单独填写图片模型 API密钥。');
  return Object.freeze({ ...snapshot, [isMetaontic(snapshot) ? 'metaonticApiKey' : 'apiKey']: key });
}
