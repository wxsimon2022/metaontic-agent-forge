/** 保存端与运行端共用的非敏感连接默认值。 */
export const METAONTIC_BASE_URL = 'https://ai.bileego.com';

/**
 * C 火山引擎直连方式开关。
 *
 * true：设置页正常提供该方式；false（当前）时只在设置页隐藏：下拉里选不到它，
 * 已经有该配置的安装继续按原值调用，不会被静默换成别的渠道，也不会丢 API密钥。
 * 恢复时把这一行改回 true，并把 settings.ts 的 SELECTS 候选一起补齐即可。
 */
export const VOLCENGINE_MODE_AVAILABLE = false;

/**
 * 图片（Seedream）模型：5.0 的旧型号已下线，当前只在售 pro 版。
 *
 * 旧配置里存着下线型号时，读取（保存端与运行端）就归一到在售型号：下线型号上游不再接受，
 * 保持原值只会让图片任务直接失败。归一只改生效值，不写回磁盘，用户不动它也不会丢配置。
 */
export const IMAGE_MODEL = 'doubao-seedream-5-0-pro-260628';
const RETIRED_IMAGE_MODELS = ['doubao-seedream-5-0-260128'];
export function resolveImageModel(value) {
  const model = String(value ?? '').trim();
  if (!model || RETIRED_IMAGE_MODELS.includes(model)) return IMAGE_MODEL;
  return model;
}

export function connectionDefaults(values) {
  const text = (key, fallback) => String(values[key] ?? '').trim() || fallback;
  const volc = values.connectionMode === 'volcengine';
  return {
    ...(volc ? { baseUrl: 'https://ark.cn-beijing.volces.com' }
      : { baseUrl: text('baseUrl', METAONTIC_BASE_URL).replace(/\/+$/, '') }),
    submitPath: volc ? '/api/v3/contents/generations/tasks' : text('submitPath', '/doubao/api/v3/contents/generations/tasks'),
    queryPath: volc ? '/api/v3/contents/generations/tasks/{task_id}' : text('queryPath', '/doubao/api/v3/contents/generations/tasks/{task_id}'),
    model: text('model', 'doubao-seedance-2-0-mini-260615'),
    imageModel: resolveImageModel(text('imageModel', IMAGE_MODEL)),
    imageUseVideoKey: values.imageUseVideoKey !== false,
  };
}
