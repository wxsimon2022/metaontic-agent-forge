/** 脚本审核用的只读双方案试算，不调用模型、不查余额、不读取密钥。 */
import { ref } from '../config.js';
import { resolveModel, isVolcengine, isMetaontic } from '../providers/connection.js';
import { resolveTargetPlan, planVideoSegments } from '../workflow/planning.js';

const RATES = [
  ['doubao-seedance-2-0-mini', [23, 14]],
  ['doubao-seedance-2-0-fast', [37, 22]],
  ['doubao-seedance-2-0', [46, 28]],
  ['doubao-seedance-2-5', [70, 42]],
] as const;
const PRICE_DATE = '2026-11-01';

export function compareVideoCosts(config, args) {
  const duration = args?.duration;
  if (!Number.isInteger(duration) || duration < 4 || duration > 120) throw new Error('目标时长须为4–120秒整数。');
  if (!['480p', '720p'].includes(args?.resolution)) throw new Error('请先由用户确认480P或720P，再试算。');
  const ratio = args?.ratio ?? ref(config, 'ratio', '9:16');
  if (!['16:9', '9:16'].includes(ratio)) throw new Error('当前仅有16:9和9:16的像素计费依据，其他画幅需核对实际宽高后试算，不能套用横屏价格。');
  const model = resolveModel(config);
  const rates = RATES.find(([prefix]) => model.startsWith(prefix));
  if (!rates) throw new Error(`尚无${model}的可靠价目，不能套用其他模型报价。`);
  const planned = resolveTargetPlan(config, args);
  if (planned.total !== duration) throw new Error('该时长超出当前分段方案能力，请先调整分段计划。');
  // 手填Key的分组权限未知，默认按1；仅明确确认的倍率可覆盖。
  const groupRatio = args?.groupRatio ?? (isVolcengine(config) || isMetaontic(config) ? 1 : ref(config, 'estimateGroupRatio', 0.8));
  if (!Number.isFinite(groupRatio) || groupRatio < 0 || groupRatio > 10) throw new Error('分组倍率须为0–10的有效数字。');
  if (isVolcengine(config) && groupRatio !== 1) throw new Error('火山直连不适用中转分组折扣。');
  // 超15秒比较2.5制作路线；超过30秒也如实列为多次生成/续拍，不伪称一次直出。
  const officialModel = duration > 15 ? 'doubao-seedance-2-5' : model;
  const officialRates = RATES.find(([prefix]) => officialModel.startsWith(prefix))![1];
  const officialPlan = planVideoSegments(duration, officialModel.startsWith('doubao-seedance-2-5') ? 30 : 15, officialModel.startsWith('doubao-seedance-2-5') ? 30 : 15);
  function calculate(id, plan, price, multiplier) {
    const pixels = args.resolution === '720p' ? [1280, 720] : id.startsWith('doubao-seedance-2-5') ? [854, 480] : [864, 496];
    const dimensions = ratio === '9:16' ? [...pixels].reverse() : pixels;
    const segments = plan.map((step, index) => {
      const inputSeconds = index ? plan[index - 1].seconds : 0;
      const tokens = (inputSeconds + step.seconds) * pixels[0] * pixels[1] * 24 / 1024;
      const rateCnyPerMillion = price[inputSeconds ? 1 : 0] * multiplier;
      return { index: index + 1, kind: step.kind, seconds: step.seconds, inputSeconds, tokens, rateCnyPerMillion, cny: tokens * rateCnyPerMillion / 1e6 };
    });
    return { model: id, dimensions, groupRatio: multiplier, segments, cny: Math.round(segments.reduce((sum, s) => sum + s.cny, 0) * 10000) / 10000 };
  }
  return {
    duration, resolution: args.resolution, ratio, fps: 24, priceDate: PRICE_DATE, currency: 'CNY', estimateType: '基础公式估价',
    official: calculate(officialModel, officialPlan, officialRates, 1),
    plugin: calculate(model, planned.plan, rates[1], groupRatio),
    pluginChannel: isVolcengine(config) ? '火山直连（无中转折扣）' : 'MetaOnticVideo中转制作方案',
    sources: ['https://docs.volcengine.com/docs/ark/model-pricing?lang=zh', 'https://ai.bileego.com/pricing'],
    notes: ['这是视频API基础公式估价，非固定报价；含视频输入的最低用量补足尚未计入，实际以渠道账单为准。', '续拍输入按上一段完整视频时长计入，不按累计成片输入；参考图片不等同参考视频，不使用含视频单价。', '不含图片生成或转换、重试、独立配音及其他额外调用；本地合并不产生视频模型调用费，接缝裁剪会缩短交付时长。', '不同模型的质量与能力有差异；火山官方为API刊例价，不是网页积分或套餐价格。', '中转倍率仅在Key确有对应分组权限且实际使用该分组时成立；价格日期后可能调整，制作前需复核。'],
  };
}

export function estimateTool(config) {
  return {
    name: 'video_estimate',
    description: '脚本审核前必须调用的只读双方案费用试算：火山官方方案与当前MetaOnticVideo插件方案。duration为完整目标时长，resolution须用户已确认；按真实分段计入上一段视频输入。不会生成视频、扣费、查余额或修改配置。未知模型/画幅拒绝猜价。每次改稿涉及时长、清晰度、模型或分段须重算。',
    parameters: { type: 'object', properties: {
      duration: { type: 'integer', minimum: 4, maximum: 120, description: '当前完整脚本的目标总时长' },
      resolution: { type: 'string', enum: ['480p', '720p'], description: '用户已确认的视频清晰度' },
      ratio: { type: 'string', enum: ['16:9', '9:16'], description: '脚本画幅，其他画幅暂不可靠试算' },
      segmentSeconds: { type: 'integer', minimum: 4, maximum: 30, description: '与实际生成一致的续拍分段时长上限' },
      groupRatio: { type: 'number', minimum: 0, maximum: 10, description: '仅在已核对Key分组权限和实际倍率时传入；不得为了显示低价假设0.8' },
    }, required: ['duration', 'resolution'] },
    output: { schema: { type: 'object' }, render(_args, value) {
      const line = (name, item) => `${name}：约¥${item.cny.toFixed(2)}；${item.model}；${item.segments.map(s => s.seconds).join('+')}秒；倍率${item.groupRatio}`;
      return [{ type: 'text', text: [`${value.duration}秒 / ${value.resolution.toUpperCase()} / ${value.ratio}（${value.estimateType}）`, line('火山官方方案', value.official), line('MetaOnticVideo插件方案', value.plugin), `价格核对日期：${value.priceDate}`, ...value.notes].join('\n') }];
    } },
    isConcurrencySafe() { return true; },
    async execute(args) { return compareVideoCosts(config, args); },
  };
}
