import { connectionDefaults, SERVICE_MODE_AVAILABLE, VOLCENGINE_MODE_AVAILABLE, SERVICE_UNAVAILABLE_MESSAGE } from '../connection-defaults.js';
/** tools/video-config：从宿主入口拆出的独立职责模块。 */
import { ref } from '../config.js';
import { isMetaontic, isVolcengine, resolveBaseUrl, resolveSubmitPath, relayPreset, resolveModel, resolveApiKey, isServerIssuedKey } from '../providers/connection.js';
import { modelMaxSeconds } from '../workflow/planning.js';

/** 用户可在插件内改的配置字段。 */
export const CONFIG_FIELDS = [
  'connectionMode', 'metaonticApiKey', 'volcengineApiKey', 'apiKey', 'baseUrl', 'submitPath', 'queryPath', 'model', 'imageModel', 'imageUseVideoKey', 'imageApiKey',
  'duration', 'singleMaxSeconds', 'ratio', 'generateAudio', 'watermark',
  'extraParams', 'pollIntervalMs', 'maxWaitMs',
  'pollErrorRetries',
  'seamTrimSeconds', 'mergeMode', 'outputDir', 'resumeLockStaleMinutes',
  'ffmpegBinary', 'ffprobeBinary',
  'registerEmail', 'registerApi', 'deviceId', 'estimateGroupRatio',
];

/**
 * 只读字段：密钥一律由服务端在「登录」时下发写入，页面和工具都不许改，
 * 免得手填一把没绑设备、查不到额度的 Key 出去瞎调。
 */
export const READ_ONLY_CONFIG_FIELDS = new Set(['apiKey', 'keyOrigin', 'deviceId', 'deviceSecret']);

export function maskSecrets(view) {
  return {
    ...view,
    metaonticApiKey: view.metaonticApiKey ? '（已配置）' : '',
    volcengineApiKey: view.volcengineApiKey ? '（已配置）' : '',
    imageApiKey: view.imageApiKey ? '（已配置）' : '',
    apiKey: view.apiKey ? '（已配置）' : '',
    deviceSecret: view.deviceSecret ? '（已配置）' : '',
  };
}

/** 当前配置：stored 是写进 profile patch 的值，effective 是实际生效（含预设与环境变量）。 */
export function configView(config) {
  const stored = {};
  for (const key of CONFIG_FIELDS) stored[key] = ref(config, key, undefined);
  return {
    stored: maskSecrets(stored),
    effective: {
      connectionMode: isMetaontic(config) ? 'metaontic' : isVolcengine(config) ? 'volcengine' : 'service',
      baseUrl: resolveBaseUrl(config),
      submitPath: resolveSubmitPath(config),
      queryPath: isVolcengine(config) ? '/api/v3/contents/generations/tasks/{task_id}' : String(ref(config, 'queryPath', '')).trim() || relayPreset().queryPath,
      model: resolveModel(config),
      imageUseVideoKey: !isMetaontic(config) || ref(config, 'imageUseVideoKey', true),
      imageModel: ref(config, 'imageModel', 'doubao-seedream-5-0-260128'),
      // 密钥只有一种合法来源：设置页「登录」时服务端下发
      apiKeySource: isMetaontic(config) ? (resolveApiKey(config) ? 'metaontic' : 'missing') : isVolcengine(config) ? (resolveApiKey(config) ? 'volcengine' : 'missing') : ref(config, 'apiKey', '')
        ? (isServerIssuedKey(config) ? 'register' : 'unverified')
        : 'missing',
    },
  };
}

export function normalizeConnectionPatch(config, input) {
  const patch = { ...input };
  if (patch.connectionMode === undefined) return { ...patch, ...connectionDefaults({ ...Object.fromEntries(Object.keys(config || {}).map(key => [key, ref(config, key, undefined)])), ...patch }) };
  const mode = patch.connectionMode;
  if (!['service', 'metaontic', 'volcengine'].includes(mode)) throw new Error('未知接入方式');
  if (mode === 'service' && !SERVICE_MODE_AVAILABLE) throw new Error(SERVICE_UNAVAILABLE_MESSAGE);
  const inactive = mode === 'volcengine'
    ? ['metaonticApiKey', 'apiKey', 'keyOrigin', 'baseUrl', 'submitPath', 'queryPath', 'registerEmail', 'deviceId', 'deviceSecret', 'registerApi', 'registerToken']
    : mode === 'metaontic'
      ? ['volcengineApiKey', 'apiKey', 'keyOrigin', 'registerEmail', 'deviceId', 'deviceSecret', 'registerApi', 'registerToken']
      : ['volcengineApiKey', 'metaonticApiKey'];
  if (ref(config, 'connectionMode', 'service') === 'volcengine' && mode !== 'volcengine') {
    for (const key of ['baseUrl', 'submitPath', 'queryPath']) if (patch[key] === undefined) patch[key] = '';
  }
  for (const key of inactive) patch[key] = '';
  return { ...patch, ...connectionDefaults({ ...Object.fromEntries(Object.keys(config || {}).map(key => [key, ref(config, key, undefined)])), ...patch }) };
}

/** 把字段改动合并进本插件在 profile patch 里的那条条目。 */
export async function writeProfileConfig(settings, config, patch) {
  const entryId = String(ref(config, 'entryId', 'metaontic-video')).trim();
  const descriptors = settings.describe({ redactSecrets: true });
  const entry = descriptors.find((item) => item.ns === entryId);
  if (!entry) {
    throw new Error(
      `profile patch 里没有可编辑的 ${entryId} 条目，无法写回配置。`
      + '请先在 profile 的 cordis.patch.yml 里加一条覆盖项：\n'
      + `- id: ${entryId}\n  name: 'metaontic-video'\n  config: { apiKey: 'sk-...', baseUrl: '...', model: '...' }\n`
      + '（也可以让 Agent 代写这一条。）',
    );
  }
  await settings.update(entryId, patch, entry.revision);
  return entryId;
}

export function configTool(config, settings) {
  return {
    name: 'video_config',
    description:
      '读取或修改 MetaOnticVideo 插件自己的配置（baseUrl、submitPath、queryPath、model、imageModel、'
      + 'duration、singleMaxSeconds、ratio、generateAudio、'
      + 'watermark、extraParams、pollIntervalMs、maxWaitMs、mergeMode、'
      + 'outputDir、resumeLockStaleMinutes、'
      + 'ffmpegBinary、ffprobeBinary、registerEmail、registerApi、estimateGroupRatio）。'
      + 'apiKey 只能由设置页「登录」时服务端下发，这里只能看、不能改；'
      + '仅服务端模式换 Key 需要登录；MetaOntic AI 使用 metaonticApiKey，可手动配置；'
      + '火山直连使用 volcengineApiKey，可手动配置，但该方式当前在设置页暂不提供选择，不要主动帮用户切过去。'
      + '改动写进 profile 的 cordis.patch.yml，'
      + '宿主重载后生效。'
      + '用户说「把中转站地址/模型/时长改成 X」时用 action=set，看当前值用 action=get；'
      + 'duration 是每段新增秒数上限（4 至模型上限（2.0 为 15、2.5 为 30），默认按模型上限、段数最少），singleMaxSeconds 为兼容旧配置保留，直出上限由模型映射。',
    parameters: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['get', 'set'],
          description: 'get=查看当前配置；set=修改配置（至少给一个要改的字段）。',
        },
        connectionMode: {
          type: 'string', enum: ['service', 'metaontic', 'volcengine'],
          description: SERVICE_MODE_AVAILABLE
            ? (VOLCENGINE_MODE_AVAILABLE
              ? '接入方式：MetaOnticVideo 服务端（邮箱登录领 Key）/ MetaOntic AI / 火山引擎直连'
              : '接入方式：MetaOnticVideo 服务端（service，邮箱登录领 Key）/ MetaOntic AI（metaontic）；火山引擎直连当前暂不提供选择，不要主动设置')
            : (VOLCENGINE_MODE_AVAILABLE
              ? '接入方式：MetaOntic AI（metaontic）/ 火山引擎直连（volcengine）；service 服务端方式暂时不可用，不要设置'
              : '接入方式：MetaOntic AI（metaontic）；service 服务端方式与火山引擎直连当前都暂不提供，不要设置'),
        },
        metaonticApiKey: { type: 'string', description: 'MetaOntic AI 手动 API Key，无需登录' },
        volcengineApiKey: { type: 'string', description: '火山引擎直连模式的火山 API Key' },
        baseUrl: { type: 'string', description: '基础地址，即中转站站址，例如 https://ai.bileego.com。' },
        registerEmail: { type: 'string', description: '领 Key 用的邮箱（账号）；注册要邮箱验证码，一个邮箱只发一把。' },
        registerApi: { type: 'string', description: '插件服务地址（领 Key / 查额度 / 使用记录）；留空用内置域名。' },
        estimateGroupRatio: { type: 'number', description: '预估费用用的分组折扣（中转站 group_ratio：默认 0.8）。' },
        submitPath: { type: 'string', description: '创建任务路径，例如 /doubao/api/v3/contents/generations/tasks。' },
        queryPath: { type: 'string', description: '查询任务路径，{task_id} 会被替换。' },
        imageUseVideoKey: { type: 'boolean', description: '仅 B 方式可选择是否共用 Key，默认 true；A 固定共用登录下发的 Key' },
        imageApiKey: { type: 'string', description: '关闭共用时必须填写的图片模型 Key，地址仍沿用当前 A/B 连接' },
        imageModel: { type: 'string', enum: ['doubao-seedream-5-0-260128', 'doubao-seedream-5-0-pro-260628'], description: 'A/B 真人参考图非真人化模型' },
        model: { type: 'string', description: '模型 ID，例如 doubao-seedance-2-0-mini-260615。' },
        duration: { type: 'integer', minimum: 4, maximum: modelMaxSeconds(config), description: '每段新增秒数上限（4 至模型上限（2.0 为 15、2.5 为 30） 的整数，默认按模型上限、段数最少）。' },
        ratio: {
          type: 'string',
          enum: ['16:9', '9:16', '4:3', '3:4', '1:1', 'adaptive'],
          description: '画面比例。',
        },
        generateAudio: { type: 'boolean', description: '是否生成音频。' },
        watermark: { type: 'boolean', description: '是否加水印。' },
        extraParams: { type: 'string', description: '额外请求参数（JSON 对象字符串）。' },
        pollIntervalMs: { type: 'integer', minimum: 1000, description: '轮询间隔（毫秒）。' },
        maxWaitMs: { type: 'integer', minimum: 1000, description: '单次调用最长等待（毫秒）。' },
        pollErrorRetries: {
          type: 'integer',
          minimum: 1,
          maximum: 60,
          description: '轮询「查询失败」的容忍次数（默认 5）：连续失败这么多次才放弃等待；'
            + '放弃时任务 ID 仍保留，可用 video_status 补查。',
        },
        singleMaxSeconds: {
          type: 'integer',
          minimum: 4,
          maximum: modelMaxSeconds(config),
          description: '单次直出上限（秒）：不超过它一次生成，超过它才分段延长。',
        },
        seamTrimSeconds: { type: 'string', description: '预览确认后裁剪各接缝：如 0.5,0 表示仅裁第2段开头0.5秒；留空时2.0裁前段尾6帧和后段头1帧，2.5不裁；填0关闭。音视频同步裁剪，实际时长缩短。' },
        mergeMode: {
          type: 'string',
          enum: ['seamless', 'copy', 'reencode'],
          description: '合并方式：copy=直接无损拼接（默认，不做画面叠化）；reencode=统一重编码后直接拼接；旧配置 seamless 按 copy 处理。',
        },
        outputDir: { type: 'string', description: '成片输出目录；留空用会话工作目录下的 metaontic-video/。' },
        resumeLockStaleMinutes: {
          type: 'number',
          minimum: 0,
          description: '暂停目录的续做锁多久算过期（分钟，默认 60，0=永不过期）。',
        },
        ffmpegBinary: { type: 'string', description: 'ffmpeg 可执行文件路径。' },
        ffprobeBinary: { type: 'string', description: 'ffprobe 可执行文件路径。' },
      },
      required: ['action'],
    },
    output: {
      schema: {
        type: 'object',
        properties: {
          action: { type: 'string' },
          entryId: { type: 'string' },
          editable: { type: 'boolean' },
          patchPath: { type: 'string' },
          stored: { type: 'object' },
          effective: { type: 'object' },
          patch: { type: 'object' },
          error: { type: 'string' },
        },
      },
      render(_args, value) {
        const { action, stored, effective, entryId, patchPath, patch, error } = value || {};
        if (error) return [{ type: 'text', text: error }];
        const lines = [
          action === 'set' ? `已写入 profile patch（条目 ${entryId}）` : '当前配置：',
          ...Object.entries(stored || {})
            .filter(([, field]) => field !== undefined && field !== '')
            .map(([key, field]) => `  ${key}: ${typeof field === 'object' ? JSON.stringify(field) : field}`),
          `生效值：baseUrl=${effective?.baseUrl} model=${effective?.model}`,
          `  submitPath=${effective?.submitPath}`,
          `  apiKey 来源：${{
            register: '服务端下发（登录写入）',
            unverified: '非服务端下发——调用会被拒绝，请到设置页点「登录」',
            missing: '未配置——请到设置页点「登录」',
          }[effective?.apiKeySource] || effective?.apiKeySource}`,
          patchPath ? `配置文件：${patchPath}` : '',
          patch && Object.keys(patch).length ? '改动会在宿主重载配置后生效。' : '',
        ].filter(Boolean);
        return [{ type: 'text', text: lines.join('\n') }];
      },
    },
    timeoutMs: 30000,
    isConcurrencySafe() {
      return false;
    },
    async execute(args) {
      const action = args?.action;
      const view = configView(config);
      const patchPath = settings?.documentPath;

      if (action === 'get') {
        return { action, ...view, editable: Boolean(settings), patchPath };
      }
      if (action !== 'set') {
        throw new Error('action 只能是 get 或 set。');
      }
      if (args?.mode !== undefined) throw new Error('续拍方式由已审核脚本决定，请在 video_generate/video_extend 的本次参数或过渡描述中指定，不再作为插件设置保存。');
      const readonly = Object.keys(args || {}).filter((key) => READ_ONLY_CONFIG_FIELDS.has(key));
      if (readonly.length) {
        throw new Error(
          `${readonly.join('、')} 由服务端在「登录」时下发，不能手动改；`
          + '要换 Key 请在「插件 → 已安装插件 → MetaOnticVideo → 查看」点「登录」重新领取。',
        );
      }
      let patch = {};
      for (const key of CONFIG_FIELDS) {
        if (args?.[key] !== undefined && !READ_ONLY_CONFIG_FIELDS.has(key)) patch[key] = args[key];
      }
      if (!Object.keys(patch).length) {
        throw new Error('set 需要至少一个要修改的字段（如 baseUrl、model、duration）。');
      }
      if (!settings) {
        throw new Error(
          '宿主没有提供 settings 服务，无法写回配置。请手动编辑 profile 的 cordis.patch.yml 里 '
          + "metaontic-video 那一条的 config（见插件 README）。",
        );
      }
      patch = normalizeConnectionPatch(config, patch);
      const entryId = await writeProfileConfig(settings, config, patch);
      const updated = {};
      for (const key of CONFIG_FIELDS) updated[key] = patch[key] !== undefined ? patch[key] : ref(config, key, undefined);
      return { action, entryId, patchPath, patch: maskSecrets(patch), ...configView(updated) };
    },
  };
}
