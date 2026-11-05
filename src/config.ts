import { METAONTIC_BASE_URL, SERVICE_MODE_AVAILABLE } from './connection-defaults.js';
/** config：从宿主入口拆出的独立职责模块。 */
import z from '@deepseek-ai/schemastery';

export const Config = z.object({
  // 服务端方式停用期间，新装默认落到 MetaOntic AI（否则新用户一进来就是不可用的方式）；
  // 已有配置的取值不受默认值影响，按停用规则被拒绝调用。
  connectionMode: z.union(['service', 'metaontic', 'volcengine']).default(SERVICE_MODE_AVAILABLE ? 'service' : 'metaontic')
    .description('接入方式：MetaOnticVideo 服务端领 Key（service）；MetaOntic AI（metaontic）；火山引擎直连（volcengine，当前设置页暂不提供选择）').volatile(),
  metaonticApiKey: z.string().default('').description('MetaOntic AI API Key').volatile(),
  volcengineApiKey: z.string().default('').description('火山引擎直连模式的火山 API Key').volatile(),
  entryId: z.string()
    .default('metaontic-video')
    .description('本插件在 profile patch 里的条目 id；配置工具用它把改动写回')
    .volatile(),
  apiKey: z.string()
    .default('')
    .description(
      'API Key：只在设置页点「登录」时由服务端下发并直接写进配置，不支持手填、'
      + '也不读环境变量；手改这里的值会被拒绝调用',
    )
    .volatile(),
  keyOrigin: z.string()
    .default('')
    .description("密钥来源标记：设置页「登录」成功后写入 'register'，插件只认服务端下发的 Key")
    .volatile(),
  baseUrl: z.string()
    .default('')
    .description(
      '基础地址（中转站站址）；留空时读环境变量 NEWAPI_VIDEO_BASE_URL / NEWAPI_BASE_URL，再使用 https://ai.bileego.com。'
      + '示例 https://ai.bileego.com（不要带 /v1，也不要重复 /api/v3）',
    )
    .volatile(),
  submitPath: z.string()
    .default('')
    .description('创建任务路径；留空用中转站默认值 /doubao/api/v3/contents/generations/tasks')
    .volatile(),
  queryPath: z.string()
    .default('')
    .description('查询任务路径，{task_id} 会被任务 ID 替换；留空用中转站默认值')
    .volatile(),
  imageUseVideoKey: z.boolean().default(true).description('图片模型与视频模型共用 Key').volatile(),
  imageApiKey: z.string().default('').description('不共用时填写的图片模型 API Key').volatile(),
  imageModel: z.union(['doubao-seedream-5-0-260128', 'doubao-seedream-5-0-pro-260628']).default('doubao-seedream-5-0-260128').description('A/B 真人参考图非真人化使用的图片模型').volatile(),
  model: z.string()
    .default('')
    .description('视频生成用的模型 ID（seedance 2.0 / 2.5 系列）；留空读 NEWAPI_VIDEO_MODEL 或内置默认值')
    .volatile(),
  registerEmail: z.string()
    .default('')
    .description('领 Key 用的邮箱（账号）：中转站里的密钥名由服务端生成唯一串，与这个邮箱绑定')
    .volatile(),
  registerToken: z.string()
    .default('metaontic-video-register-v1')
    .description('注册请求头 X-Register-Token 的值，要与服务端 REGISTER_CLIENT_TOKEN 一致；页面不显示')
    .volatile(),
  registerApi: z.string()
    .default('')
    .description('插件服务地址（领 Key / 查额度 / 使用记录）；留空用内置的视频服务域名')
    .volatile(),
  deviceId: z.string()
    .default('')
    .description('本机设备标识：设置页点「登录」时写入，用来查这把 Key 的剩余额度')
    .volatile(),
  deviceSecret: z.string()
    .default('')
    .description('本机设备密钥：与设备标识一起绑定归属；页面不显示')
    .volatile(),
  loginKey: z.string()
    .default('')
    .description('登录令牌（服务端下发，JWT）：之后每个服务端请求都带它证明账号身份；页面不显示')
    .volatile(),
  estimateGroupRatio: z.number().min(0).max(10)
    .default(0.8)
    .description('预估费用用的分组折扣（中转站 group_ratio：videosvip=0.8、default=1）')
    .volatile(),
  duration: z.number().step(1).min(4).max(30)
    .default(15)
    .description('兼容旧配置；分段默认按模型上限映射：2.0 为 15 秒、2.5 为 30 秒。需缩短分段时在工具调用中指定。')
    .volatile(),
  singleMaxSeconds: z.number().step(1).min(4).max(30)
    .default(15)
    .description('兼容旧配置；单次直出上限由模型决定：2.0 为 15 秒、2.5 为 30 秒。')
    .volatile(),
  seamTrimSeconds: z.string().default('').description('2.0 默认每接缝裁前段尾6帧、后段头1帧；填0关闭。覆盖为手动裁剪：逗号分隔秒数，对应第2、3…段开头，0–3秒；2.5留空不裁。先预览确认，避免切断对白。').volatile(),
  mergeMode: z.union(['seamless', 'copy', 'reencode'])
    .default('copy')
    .description(
      '合并方式：copy=直接拼接（默认，无画面叠化）；reencode=统一重编码后直接拼接；seamless为旧配置兼容值，按直接拼接处理。',
    )
    .volatile(),
  bgmFadeSeconds: z.number().min(0).max(3).default(0.8)
    .description('旧配置兼容字段，当前直接拼接不使用音频交叉淡化，修改此值不生效。').volatile(),
  outputDir: z.string()
    .default('')
    .description('成片输出目录；留空用会话工作目录下的 metaontic-video/')
    .volatile(),
  keepSegments: z.boolean()
    .default(true)
    .description('旧配置兼容字段；原始分段始终保留，此值不再控制删除。')
    .volatile(),
  resumeLockStaleMinutes: z.number().min(0)
    .default(60)
    .description(
      '暂停目录的「续做锁」超过多少分钟算过期残留（默认 60，0=永不过期）。'
      + '同一份暂停进度同时只能有一次 resume 在跑，否则剩下的段会被提交两遍、重复扣费；'
      + '上一次被强杀 / 宿主放弃调用时锁文件会留下，超过这个时间才允许后来者抢过来。',
    )
    .volatile(),
  ffmpegBinary: z.string()
    .default('ffmpeg')
    .description('ffmpeg 可执行文件；PATH 里没有时填绝对路径')
    .volatile(),
  ffprobeBinary: z.string()
    .default('ffprobe')
    .description('ffprobe 可执行文件；PATH 里没有时填绝对路径')
    .volatile(),
  mode: z.union(['continuous', 'closeup'])
    .default('continuous')
    .description('旧配置兼容字段，新任务不再读取；续拍方式由已审核脚本的工具参数与过渡描述决定')
    .volatile(),
  ratio: z.union(['16:9', '9:16', '4:3', '3:4', '1:1', 'adaptive'])
    .default('adaptive')
    .description('画面比例；seedance 2.5 延长时固定改用 adaptive')
    .volatile(),
  generateAudio: z.boolean()
    .default(true)
    .description('是否生成音频')
    .volatile(),
  watermark: z.boolean()
    .default(false)
    .description('是否添加水印；部分中转站只接受 true')
    .volatile(),
  extraParams: z.string()
    .default('')
    .description('JSON 对象字符串，合并进请求体，用于中转站的特有字段')
    .volatile(),
  pollIntervalMs: z.natural().min(1000)
    .default(5000)
    .description('轮询任务状态的间隔（毫秒）')
    .volatile(),
  maxWaitMs: z.natural().min(1000)
    .default(600000)
    .description('单次调用最长等待时间（毫秒）')
    .volatile(),
  pollErrorRetries: z.natural().min(1).max(60)
    .default(5)
    .description(
      '轮询期间「查询失败」的容忍次数：网络抖动、中转站限流、Key 中途被判无效都会让查询报错，'
      + '但任务在上游照常生成——连续失败到这个次数才放弃等待。'
      + '放弃时任务 ID 仍保留，可用 video_status 事后补查，不会把「查不到」当成「没生成」。'
      + '设置页不显示这一项：默认值 5 够用。',
    )
    .volatile(),
});

const DEFAULT_MODEL = 'doubao-seedance-2-0-mini-260615';

export const MAX_SEGMENTS = 10;

export const MIN_SECONDS = 4;

export const MIN_SEGMENT_SECONDS = 4;

/** 单段延长（续拍）的秒数上限：Seedance 原生延长只接受 4 至模型上限（2.0 为 15、2.5 为 30） 秒。 */
export const MAX_SEGMENT_SECONDS = 15;

/**
 * 单条成片的目标时长上限：段数上限内排得出来的最长时长，先按 120 秒卡住。
 * 段数越少接缝越少，但一条片子拖太长可用的质检/重跑余地也小，所以这里封顶 120 秒。
 */
export const MAX_TOTAL_SECONDS = 120;

/** 旧导出保留为默认值，实际清晰度由 resolveResolution 统一解析。 */
export const FIXED_RESOLUTION = '720p';
export function resolveResolution(config, args: any = {}) {
  const resolution = String(args?.resolution ?? FIXED_RESOLUTION).toLowerCase();
  if (!['480p', '720p'].includes(resolution)) throw new Error('视频清晰度仅支持 480P 或 720P。');
  return resolution;
}

/** 输出目录的默认子目录名。 */
export const DEFAULT_OUTPUT_DIR = 'metaontic-video';

/** 判断「上游返回的是累计成片」的容差：累计时长的 25%，且至少 1.5 秒。 */
export const CUMULATIVE_TOLERANCE_RATIO = 0.25;

export const CUMULATIVE_TOLERANCE_MIN_SECONDS = 1.5;

/** 插件服务地址（领 Key、查额度、使用记录）：配置留空时用这个固定域名。 */
export const DEFAULT_REGISTER_API = 'https://video.mybfs.cn';

/** 服务端握手头的兜底值（与服务端 REGISTER_CLIENT_TOKEN 对齐）。 */
export const DEFAULT_REGISTER_TOKEN = 'metaontic-video-register-v1';

/** 密钥来源标记：设置页「登录」成功后写进配置，表示这把 Key 是服务端下发的。 */
export const KEY_ORIGIN_REGISTER = 'register';

/** 额度/汇率兜底：服务端会回真实值，只有拿不到时才用这两个。 */
export const DEFAULT_QUOTA_PER_UNIT = 500000;

export const DEFAULT_USD_EXCHANGE_RATE = 7.3;

/** 会真正调用视频模型、因而必须人工确认的工具。 */
export const GATED_TOOLS = ['video_generate', 'video_extend', 'video_setup', 'video_prepare_image', 'media_submission'];

/**
 * 预估费用的价目表：照抄中转站 /api/pricing 里 seedance 的 billing_expr。
 *
 * 中转站按 token 计费：``tokens = 宽 × 高 × 帧率 × 秒数 ÷ 1024``
 * （720p/24fps 正好 21600 token/秒），再乘「每 100 万 token 的美元价」得到美元。
 * 实测 15 秒 720p 直出 = 324000 token → 408329 额度，与中转站日志里的预扣费一致，
 * 所以这套算法够用来做「够不够、大概多少钱」的预检。实际以中转站结算为准。
 */
export const ESTIMATE_PIXELS = { '480p': [864, 496], '720p': [1280, 720], '1080p': [1920, 1080] };

export const ESTIMATE_FPS = 24;

export const ESTIMATE_TOKEN_DIVISOR = 1024;

/** 每 100 万 token 的美元价：none = 无视频输入（包括参考图/首尾帧），video = 有视频输入。 */
export const ESTIMATE_RATES: Array<[string, { none: number; video: number }]> = [
  ['doubao-seedance-2-0-mini', { none: 3.150684931507, video: 1.917808219178 }],
  ['doubao-seedance-2-0-fast', { none: 5.068493150685, video: 3.013698630137 }],
];

/** provider 预设：字段留空时按这里的顺序回退到环境变量，再回退到预设默认值。 */
export const RELAY_PRESET = {
    baseUrl: METAONTIC_BASE_URL,
    submitPath: '/doubao/api/v3/contents/generations/tasks',
    queryPath: '/doubao/api/v3/contents/generations/tasks/{task_id}',
    model: DEFAULT_MODEL,
    baseEnv: ['NEWAPI_VIDEO_BASE_URL', 'NEWAPI_BASE_URL'],
  modelEnv: ['NEWAPI_VIDEO_MODEL'],
};

export const SUCCESS_STATES = new Set(['succeeded', 'success', 'completed', 'complete', 'done', 'finished']);

export const FAILED_STATES = new Set(['failed', 'failure', 'error', 'cancelled', 'canceled', 'expired']);

export const CANCEL_STATES = new Set(['cancelled', 'canceled']);

export const QUOTA_HINTS = ['quota', 'insufficient', 'balance', '预扣费', '剩余额度'];

export const PRICE_HINTS = ['model_price_error', '阶梯计价', 'u("input_images")'];

export const CONTENT_HINTS = [
  'real person', 'privacyinformation', 'privacy information', 'content policy',
  'content_policy', 'contentpolicy', 'content safety', 'safety policy',
  'sensitive', '违规', '敏感', '涉政',
];

export const VIDEO_URL_KEYS = [
  'video_url', 'videourl', 'download_url', 'play_url', 'result_url', 'output_url',
];

export const GENERIC_URL_KEYS = new Set(['url', 'output', 'video', 'file']);

export const IMAGE_KEY_TOKENS = ['cover', 'image', 'thumb', 'poster', 'frame', 'snapshot', 'preview'];

export const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.bmp', '.gif'];

export const CONTINUOUS_TRANSITION =
  '本段第一帧必须紧接视频1最后一帧，保持同一构图、人物大小、左右位置、'
  + '头部朝向、视线、手部位置和动作阶段。动作保持原有方向和速度，'
  + '不重复前段动作、不定格等待、不从画面另一侧重新入场；不擅自切镜或重新居中。';

export const FORWARD_TRANSITION =
  '向前延长时，本段最后一帧必须紧接视频1第一帧，保持同一构图、人物大小、左右位置、'
  + '头部朝向、视线、手部位置和动作阶段。动作朝向视频1的开场动作发展，'
  + '不重复前段动作、不定格等待、不从画面另一侧重新入场；不擅自切镜或重新居中。';

export const CLOSEUP_TRANSITION =
  '镜头衔接建议（仅在本段未明确指定运镜或切镜安排时采用）：在完整台词结束处自然切到'
  + '下一位说话人的近景或听话人的反应近景，再继续本段剧情。保持轴线、视线方向、'
  + '左右人物关系、服装和音色，不交换角色；只改变景别，不新增场景。';

export const CONTENT_REJECTION_HINT =
  '参考视频被上游内容审核拒绝，延长已停止。Seedance 含人脸续拍需使用同一上游账号的'
  + '受信原始视频或授权素材；请确认中转站透传了原始 video_url 与 reference_video，'
  + '且前后请求使用同一上游账号。不会自动去掉参考视频生成，以免人物不一致。';

/**
 * 读取一个配置字段。`.volatile()` 声明的字段由宿主包装成引用（`.get()` 取快照，
 * 改动后无需重启即可生效），未声明的普通配置是普通值；两种形态都能读。
 */
export function ref(config, key, fallback) {
  const raw = config?.[key];
  const value = raw && typeof raw.get === 'function' ? raw.get() : raw;
  return value === undefined || value === null || value === '' ? fallback : value;
}

export function envValue(names) {
  for (const name of names) {
    const value = process.env[name];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

/** 本插件版本：构建时由 esbuild --define 从 package.json 注入，跟着请求带给服务端。 */
export const PLUGIN_VERSION = typeof __PLUGIN_VERSION__ === 'string'
  ? __PLUGIN_VERSION__.trim().replace(/^v/i, '')
  : '';
