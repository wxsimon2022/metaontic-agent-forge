/** 保存端与运行端共用的非敏感连接默认值。 */
export const METAONTIC_BASE_URL = 'https://ai.bileego.com';

/**
 * A 服务端方式（service，邮箱登录领 Key）临时停用开关。
 *
 * false 时：设置页不再提供该方式、也不显示登录与额度区，运行时拒绝按该方式发起调用；
 * 已有配置保持原值不动，不会静默改成别的渠道。恢复时把这一行改回 true 即可。
 */
export const SERVICE_MODE_AVAILABLE = false;

/** 停用期间对用户说的话：设置页提示与运行时错误共用一份，避免两处措辞不一致。 */
export const SERVICE_UNAVAILABLE_MESSAGE = 'MetaOnticVideo 服务端方式暂时不可用：请在插件设置页把「接入方式」改为 MetaOntic AI 或火山引擎直连，填好 Key 保存后重试。';

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
