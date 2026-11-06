/** 保存端与运行端共用的非敏感连接默认值。 */
export const METAONTIC_BASE_URL = 'https://ai.bileego.com';

/**
 * A 服务端方式（service，邮箱登录领 API密钥）开关。
 *
 * true（当前）：设置页正常提供该方式，登录后领 API密钥并展示额度与使用情况。
 * 需要临时停用时改成 false：设置页不再提供该方式、也不显示登录与额度区，运行时拒绝按该方式
 * 发起调用；已有配置保持原值不动，不会静默改成别的渠道。
 */
export const SERVICE_MODE_AVAILABLE = true;

/** 该方式被停用时对用户说的话：设置页提示与运行时错误共用一份，避免两处措辞不一致。 */
export const SERVICE_UNAVAILABLE_MESSAGE = 'MetaOnticVideo 服务端方式暂时不可用：请在插件设置页把「接入方式」改为 MetaOntic AI 或火山引擎直连，填好 API密钥保存后重试。';

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
