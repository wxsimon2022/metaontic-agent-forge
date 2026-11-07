/** workflow/planning：从宿主入口拆出的独立职责模块。 */
import { isOmniExtendModel, resolveModel } from '../providers/connection.js';
import { clampInteger } from '../utils/validation.js';
import { MIN_SEGMENT_SECONDS, MAX_TOTAL_SECONDS, MAX_SEGMENTS, MIN_SECONDS } from '../config.js';

/* ---------------- 时长规划：不超上限就直出，超过就延长 ---------------- */

/** 模型能力决定单次生成上限，避免旧配置的 15 秒限制影响 2.5。 */
export function modelMaxSeconds(config) {
  return isOmniExtendModel(resolveModel(config)) ? 30 : 15;
}

export function resolveSingleMax(config) {
  return modelMaxSeconds(config);
}

/** 默认按模型上限续拍；调用方可显式请求更短的分段。 */
export function resolveSegmentSeconds(config, requested = undefined) {
  const max = modelMaxSeconds(config);
  return clampInteger(requested, MIN_SEGMENT_SECONDS, max, max);
}

/**
 * 本次配置能排出的最长时长：120 秒与「首段上限 + 每段上限 ×（最大段数-1）」取小。
 * 注意用的是**本次每段秒数**：每段上限调小时，能排出的总长也跟着变短。
 */
function maxTargetSeconds(singleMax, segmentSeconds) {
  return Math.min(MAX_TOTAL_SECONDS, singleMax + (MAX_SEGMENTS - 1) * segmentSeconds);
}

/**
 * 把目标总时长拆成执行计划：
 * 不超过单段上限 → **只生成一段**（这是硬规则：≤ 单段上限的视频禁止拆分）；超过 → 先直出上限长度，
 * 再按每段秒数延长，最多 MAX_SEGMENTS 段（那是同一条视频的续拍段，不是多镜拼接）。
 */
export function planVideoSegments(totalSeconds, singleMax, segmentSeconds) {
  // ≤ 单段上限：一次直出，绝不拆段（回归测试见 tests/：15 → '15'）
  if (totalSeconds <= singleMax) return [{ kind: 'generate', seconds: totalSeconds }];

  // 尾段不足最小分段秒数（4 秒）时先把首段缩短一点，避免拆出 1-3 秒的非法分段。
  let base = singleMax;
  let remaining = totalSeconds - base;
  if (remaining < MIN_SEGMENT_SECONDS) {
    const trimmed = MIN_SEGMENT_SECONDS - remaining;
    if (base - trimmed >= MIN_SEGMENT_SECONDS) {
      base -= trimmed;
      remaining = totalSeconds - base;
    }
  }

  // 段数取「每段装满上限」所需的最少段数：25 秒 → 15+10，30 秒 → 15+15，
  // 而不是按固定 5 秒切成一堆小段（15+5+5+5）。然后在这几段之间均分，
  // 既保证段数最少，也不会切出 1-3 秒的碎段。
  const slots = MAX_SEGMENTS - 1;
  const count = Math.min(slots, Math.max(1, Math.ceil(remaining / segmentSeconds)));
  const sizes = [];
  let left = remaining;
  for (let index = count; index > 0 && left > 0; index -= 1) {
    let size = Math.min(segmentSeconds, Math.ceil(left / index));
    if (size < MIN_SEGMENT_SECONDS) size = Math.min(segmentSeconds, MIN_SEGMENT_SECONDS);
    sizes.push(size);
    left -= size;
  }

  const plan = [{ kind: 'generate', seconds: base }];
  for (const seconds of sizes) {
    if (plan.length >= MAX_SEGMENTS) break;
    plan.push({ kind: 'extend', seconds });
  }
  return plan;
}

/** 直出用的提示词：和延长不同，这里不引用任何参考视频。 */
/** 在提交前验证逐段提示词，防止将全片剧本重复交给模型。 */
export function resolveSegmentPrompts(prompts, planLength) {
  if (prompts === undefined && planLength === 1) return null;
  if (!Array.isArray(prompts) || prompts.length !== planLength
    || prompts.some((value) => typeof value !== 'string' || !value.trim())) {
    throw new Error(`请按完整生成计划提供 segmentPrompts：${planLength} 条非空的逐段提示词，每条仅含本段动作与对白。先补齐提示词再提交，不要重新生成已完成分段。`);
  }
  return prompts.map((value) => value.trim());
}

/**
 * 本次调用的时长规划（估算与真正生成共用，保证确认框里的段数与实际执行一致）：
 * 目标秒数先夹到「单条成片上限」内，再按单段上限 / 每段上限拆段。
 * 上限之外的请求不会被静默砍掉——调用方把 `asked - total` 写进备注里告诉用户。
 */
export function resolveTargetPlan(config, args) {
  const singleMax = resolveSingleMax(config);
  const segmentSeconds = resolveSegmentSeconds(config, args?.segmentSeconds);
  const cap = maxTargetSeconds(singleMax, segmentSeconds);
  const asked = clampInteger(
    args?.duration ?? singleMax,
    MIN_SECONDS,
    Number.MAX_SAFE_INTEGER,
    singleMax,
  );
  const total = Math.min(asked, cap);
  return {
    plan: planVideoSegments(total, singleMax, segmentSeconds),
    singleMax,
    segmentSeconds,
    cap,
    asked,
    total,
  };
}

export function sumStepSeconds(steps) {
  return (steps || []).reduce((sum, step) => sum + (Number(step?.seconds) || 0), 0);
}

/** 延长工具的duration是每段秒数，超上限必须明确拆段，不能静默压缩已审核时长。 */
export function validateExtensionDuration(config, args) {
  const value = args?.duration;
  if (value !== undefined && (!Number.isInteger(value) || value < MIN_SECONDS || value > modelMaxSeconds(config))) {
    throw new Error(`续拍duration是每段新增秒数，须为${MIN_SECONDS}–${modelMaxSeconds(config)}秒整数；更长时请用segments安排多段并重新审核，不会自动缩短。`);
  }
  if (args?.segments !== undefined && (!Number.isInteger(args.segments) || args.segments < 1 || args.segments > MAX_SEGMENTS)) {
    throw new Error(`续拍segments须为1–${MAX_SEGMENTS}整数，请先确认完整分段计划。`);
  }
}
