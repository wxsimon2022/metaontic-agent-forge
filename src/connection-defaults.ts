/** 保存端与运行端共用的非敏感连接默认值。 */
export const METAONTIC_BASE_URL = 'https://ai.bileego.com';

/**
 * A 服务端方式（service，邮箱登录领 Key）开关。
 *
 * true（当前）：设置页正常提供该方式，登录后领 Key 并展示额度与使用情况。
 * 需要临时停用时改成 false：设置页不再提供该方式、也不显示登录与额度区，运行时拒绝按该方式
 * 发起调用；已有配置保持原值不动，不会静默改成别的渠道。
 */
export const SERVICE_MODE_AVAILABLE = true;

/** 该方式被停用时对用户说的话：设置页提示与运行时错误共用一份，避免两处措辞不一致。 */
export const SERVICE_UNAVAILABLE_MESSAGE = 'MetaOnticVideo 服务端方式暂时不可用：请在插件设置页把「接入方式」改为 MetaOntic AI 或火山引擎直连，填好 Key 保存后重试。';

/**
 * C 火山引擎直连方式开关。
 *
 * true：设置页正常提供该方式；false（当前）时只在设置页隐藏：下拉里选不到它，
 * 已经有该配置的安装继续按原值调用，不会被静默换成别的渠道，也不会丢 Key。
 * 恢复时把这一行改回 true，并把 settings.ts 的 SELECTS 候选一起补齐即可。
 */
export const VOLCENGINE_MODE_AVAILABLE = false;

export function connectionDefaults(values) {
  const text = (key, fallback) => String(values[key] ?? '').trim() || fallback;
  const volc = values.connectionMode === 'volcengine';
  return {
    ...(volc ? { baseUrl: 'https://ark.cn-beijing.volces.com' }
      : { baseUrl: text('baseUrl', METAONTIC_BASE_URL).replace(/\/+$/, '') }),
    submitPath: volc ? '/api/v3/contents/generations/tasks' : text('submitPath', '/doubao/api/v3/contents/generations/tasks'),
    queryPath: volc ? '/api/v3/contents/generations/tasks/{task_id}' : text('queryPath', '/doubao/api/v3/contents/generations/tasks/{task_id}'),
    model: text('model', 'doubao-seedance-2-0-mini-260615'),
    imageModel: text('imageModel', 'doubao-seedream-5-0-260128'),
    imageUseVideoKey: values.imageUseVideoKey !== false,
  };
}
