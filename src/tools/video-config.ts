import { VOLCENGINE_MODE_AVAILABLE, IMAGE_MODEL, resolveImageModel } from '../connection-defaults.js';
/** tools/video-config：从宿主入口拆出的独立职责模块。 */
import { ref } from '../config.js';
import { isMetaontic, isVolcengine, resolveBaseUrl, resolveSubmitPath, relayPreset, resolveModel, resolveApiKey } from '../providers/connection.js';
import { modelMaxSeconds } from '../workflow/planning.js';

/** 用户可在插件内改的配置字段。 */
export const CONFIG_FIELDS = [
  'connectionMode', 'metaonticApiKey', 'volcengineApiKey', 'baseUrl', 'submitPath', 'queryPath', 'model', 'imageModel', 'imageUseVideoKey', 'imageApiKey',
  'duration', 'singleMaxSeconds', 'ratio', 'generateAudio', 'watermark',
  'extraParams', 'pollIntervalMs', 'maxWaitMs',
  'pollErrorRetries',
  'seamTrimSeconds', 'mergeMode', 'outputDir', 'resumeLockStaleMinutes',
  'ffmpegBinary', 'ffprobeBinary',
  'estimateGroupRatio',
];

/** 配置工具仅允许读取，密钥以配置状态显示。 */
export const READ_ONLY_CONFIG_FIELDS = new Set();

export function maskSecrets(view) {
  return {
    ...view,
    metaonticApiKey: view.metaonticApiKey ? '（已配置）' : '',
    volcengineApiKey: view.volcengineApiKey ? '（已配置）' : '',
    imageApiKey: view.imageApiKey ? '（已配置）' : '',
  };
}

/** 当前配置：stored 是写进 profile patch 的值，effective 是实际生效（含预设与环境变量）。 */
export function configView(config) {
  const stored = {};
  for (const key of CONFIG_FIELDS) stored[key] = ref(config, key, undefined);
  return {
    stored: maskSecrets(stored),
    effective: {
      connectionMode: isVolcengine(config) ? 'volcengine' : 'metaontic',
      baseUrl: resolveBaseUrl(config),
      submitPath: resolveSubmitPath(config),
      queryPath: isVolcengine(config) ? '/api/v3/contents/generations/tasks/{task_id}' : String(ref(config, 'queryPath', '')).trim() || relayPreset().queryPath,
      model: resolveModel(config),
      imageUseVideoKey: !isMetaontic(config) || ref(config, 'imageUseVideoKey', true),
      imageModel: resolveImageModel(ref(config, 'imageModel', IMAGE_MODEL)),
      apiKeySource: resolveApiKey(config) ? (isVolcengine(config) ? 'volcengine' : 'metaontic') : 'missing',
    },
  };
}

export function configTool(config, settings) {
  return {
    name: 'video_config',
    description:
      '只读查看 MetaOnticVideo 插件自己的配置（baseUrl、submitPath、queryPath、model、imageModel、'
      + 'duration、singleMaxSeconds、ratio、generateAudio、'
      + 'watermark、extraParams、pollIntervalMs、maxWaitMs、mergeMode、'
      + 'outputDir、resumeLockStaleMinutes、'
      + 'ffmpegBinary、ffprobeBinary、estimateGroupRatio）。'
      + '对话里禁止改配置：接入方式、API密钥、模型、地址、时长等任何一项都只能由用户在插件设置页'
      + '（「插件 → 已安装插件 → MetaOnticVideo → 查看」）修改并保存，宿主重载后生效；'
      + '本工具没有修改能力，action=set 会被直接拒绝。'
      + '用户要改配置时，说明改的是哪一项并引导他去设置页改，不要代改、不要索取或展示 API密钥。'
      + '看当前值用 action=get；'
      + 'duration 是每段新增秒数上限（4 至模型上限（2.0 为 15、2.5 为 30），默认按模型上限、段数最少），singleMaxSeconds 为兼容旧配置保留，直出上限由模型映射。',
    parameters: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['get'],
          description: 'get=查看当前配置；配置改动只能在插件设置页完成，本工具不提供修改。',
        },
        connectionMode: {
          type: 'string', enum: ['metaontic', 'volcengine'],
          description: '接入方式：MetaOntic AI / 火山引擎直连（当前设置页隐藏）',
        },
        metaonticApiKey: { type: 'string', description: 'MetaOntic AI 手动 API密钥，无需登录' },
        volcengineApiKey: { type: 'string', description: '火山引擎直连模式的火山 API密钥' },
        baseUrl: { type: 'string', description: '基础地址，即中转站站址，例如 https://ai.bileego.com。' },
        estimateGroupRatio: { type: 'number', description: '预估费用用的分组折扣（中转站 group_ratio：默认 0.8）。' },
        submitPath: { type: 'string', description: '创建任务路径，例如 /doubao/api/v3/contents/generations/tasks。' },
        queryPath: { type: 'string', description: '查询任务路径，{task_id} 会被替换。' },
        imageUseVideoKey: { type: 'boolean', description: '图片与视频是否共用 API密钥，默认 true' },
        imageApiKey: { type: 'string', description: '关闭共用时必须填写的图片模型 API密钥，地址仍沿用当前 MetaOntic AI 连接' },
        imageModel: { type: 'string', enum: [IMAGE_MODEL], description: 'MetaOntic AI 真人参考图非真人化模型（旧型号已下线，按 pro 版调用）' },
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
          patchPath: { type: 'string' },
          stored: { type: 'object' },
          effective: { type: 'object' },
          error: { type: 'string' },
        },
      },
      render(_args, value) {
        const { stored, effective, patchPath, error } = value || {};
        if (error) return [{ type: 'text', text: error }];
        const lines = [
          '当前配置（只读，改配置请在插件设置页）：',
          ...Object.entries(stored || {})
            .filter(([, field]) => field !== undefined && field !== '')
            .map(([key, field]) => `  ${key}: ${typeof field === 'object' ? JSON.stringify(field) : field}`),
          `生效值：baseUrl=${effective?.baseUrl} model=${effective?.model}`,
          `  submitPath=${effective?.submitPath}`,
          `  apiKey 来源：${{
            missing: '未配置——请到设置页填写 API密钥',
          }[effective?.apiKeySource] || effective?.apiKeySource}`,
          patchPath ? `配置文件：${patchPath}` : '',
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
        return { action, ...view, patchPath };
      }
      if (action === 'set') {
        throw new Error(
          '插件配置不能在对话里改：video_config 是只读的，接入方式、API密钥、模型、地址、时长等任何一项都只能由用户'
          + '在插件设置页（「插件 → 已安装插件 → MetaOnticVideo → 查看」）修改并保存。'
          + '请说明要改的是哪一项并引导用户去设置页，不要代改、不要索取或展示 API密钥。',
        );
      }
      throw new Error('action 只能是 get：插件配置只能在设置页修改，本工具不提供写入。');
    },
  };
}
