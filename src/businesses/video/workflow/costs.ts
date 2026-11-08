import { validateExtensionDuration } from './planning.js';
/** workflow/costs：从宿主入口拆出的独立职责模块。 */
import { ESTIMATE_RATES, MAX_SEGMENTS, MIN_SECONDS, FIXED_RESOLUTION, resolveResolution, ESTIMATE_PIXELS, ESTIMATE_FPS, ESTIMATE_TOKEN_DIVISOR, ref } from '../config.js';
import { clampInteger, finiteNumber } from '../../../core/utils/validation.js';
import { modelMaxSeconds, resolveTargetPlan } from './planning.js';
import { resolveModel } from '../providers/connection.js';

/* ---------------- 调用前预检：预估费用 + 人工确认 + 额度是否够 ---------------- */

/** 金额显示与中转站一致：|x| ≥ 1 保留 2 位小数，否则保留 4 位，末尾多余的 0 去掉。 */
function formatAmount(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return '0';
  const text = number.toFixed(Math.abs(number) >= 1 ? 2 : 4);
  return text.includes('.') ? text.replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '') : text;
}

export function formatMoney(value, symbol = '¥') {
  return `${symbol}${formatAmount(value)}`;
}

/** 每 100 万 token 的美元价：仅含视频输入时使用 video 档；参考图和首尾帧仍属无视频输入。 */
function estimateRate(model, usesReference) {
  const id = String(model || '').toLowerCase();
  const hit = ESTIMATE_RATES.find(([prefix]) => id.startsWith(prefix));
  const table = hit ? hit[1] : ESTIMATE_RATES[0][1];
  return usesReference ? table.video : table.none;
}

/** 这次调用会拆几段：和真正执行用的是同一套规划（直出 + 逐段延长）。 */
export function estimatePlan(config, toolName, args) {
  if (toolName === 'video_extend') {
    validateExtensionDuration(config, args);
    const count = clampInteger(args?.segments, 1, MAX_SEGMENTS, 1);
    const fallback = modelMaxSeconds(config);
    const seconds = clampInteger(
      args?.duration ?? fallback,
      MIN_SECONDS,
      modelMaxSeconds(config),
      fallback,
    );
    return Array.from({ length: count }, () => ({ kind: 'extend', seconds }));
  }
  return resolveTargetPlan(config, args).plan;
}

/**
 * 每段的预估用量（token / 美元）。全量估算和「还要生成几段」的确认框共用这一套价目，
 * 两边算出来的数字才不会打架。
 * @param steps - 每段要有 seconds / kind，以及 inputSeconds（真实输入视频时长）。
 */
export function estimateSteps(config, steps, selectedResolution = undefined) {
  const resolution = resolveResolution(config, { resolution: selectedResolution });
  const model = resolveModel(config);
  const pixels = resolution === '480p' && /^doubao-seedance-2-5/.test(model) ? [854, 480] : ESTIMATE_PIXELS[resolution] || ESTIMATE_PIXELS[FIXED_RESOLUTION];
  const tokensPerSecond = (pixels[0] * pixels[1] * ESTIMATE_FPS) / ESTIMATE_TOKEN_DIVISOR;
  return {
    model,
    resolution,
    segments: steps.map((step, index) => {
      const usesReference = step.kind === 'extend' || step.usesVideoInput === true;
      const inputSeconds = usesReference ? Number(step.inputSeconds ?? steps[index - 1]?.seconds) : 0;
      if (!Number.isFinite(inputSeconds) || inputSeconds < 0 || (usesReference && inputSeconds === 0)) throw new Error('续拍估价缺少实际输入视频时长，不能按纯生成费用估算。');
      const tokens = Math.round(tokensPerSecond * (inputSeconds + step.seconds));
      return {
        index: index + 1,
        kind: step.kind,
        seconds: step.seconds,
        inputSeconds,
        billingMode: usesReference ? 'with_video_input' : 'without_video_input',
        tokens,
        usesReference,
        usd: (tokens * estimateRate(model, usesReference)) / 1e6,
      };
    }),
  };
}

/**
 * 调用模型前的估算：拆几段、多少 token、大概多少美元。
 * 只按价目表与分辨率算，实际以中转站结算为准（确认框里写的是「预估」）。
 */
export function estimateUsage(config, toolName, args, actualPlan = undefined) {
  const plan = actualPlan ?? estimatePlan(config, toolName, args);
  const groupRatio = finiteNumber(ref(config, 'estimateGroupRatio', 0.8)) ?? 1;
  // 首段无视频输入（即使有参考图）；续拍按上一段完整视频输入计费。
  const { model, resolution, segments } = estimateSteps(
    config,
    plan.map((step, index) => ({ ...step, inputSeconds: step.inputSeconds ?? (step.kind === 'extend' ? (index ? plan[index - 1].seconds : args?.inputVideoSeconds) : 0) })),
    resolveResolution(config, args),
  );
  const usd = segments.reduce((sum, item) => sum + item.usd, 0) * groupRatio;
  return {
    model,
    resolution,
    segments,
    seconds: segments.reduce((sum, item) => sum + item.seconds, 0),
    tokens: segments.reduce((sum, item) => sum + item.tokens, 0),
    usd: Math.round(usd * 1e6) / 1e6,
  };
}
