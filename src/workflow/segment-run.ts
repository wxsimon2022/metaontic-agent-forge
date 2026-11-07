import path from 'node:path';
import { stat } from 'node:fs/promises';
/** workflow/segment-run：video_generate 与 video_extend 的分段循环共用逻辑。 */
import { CONTENT_REJECTION_HINT } from '../config.js';
import { downloadSegmentsAndMerge } from '../media/merge.js';
import { appendRequestLog } from '../utils/logging.js';
import { resumeHint } from './resume.js';

/** 每段完成后的暂停提示：先交付这一段，等用户预览确认再 resume 下一段。 */
export const SEGMENT_PAUSE_NOTE = '本段已完成：请先展示本次视频成果，让用户预览；用户确认继续后再用 resume 接着生成下一段。';

/**
 * 把一次 runTask 的最终结果写进分段列表：任务 ID、上游链接、失败原因，以及
 * 「已提交但没查到」（unknown/timeout）时要带出去的任务 ID。
 * 返回 ok=false 表示这一段没成功，调用方应该停下来交付已有的段。
 */
export function recordSegmentResult({ final, segments, segment, submissionId, convertedReferences }) {
  const detail = final.errorCode === 'content_rejected'
    ? `${CONTENT_REJECTION_HINT}上游详情：${final.error || ''}`
    : final.error;
  segments.push({
    index: segment.index,
    kind: segment.kind,
    seconds: segment.seconds,
    taskId: final.taskId,
    status: final.status,
    videoUrl: final.videoUrl,
    error: detail,
  });
  return {
    ok: final.status === 'succeeded' && Boolean(final.videoUrl),
    submissionId: final.submissionId || submissionId,
    convertedReferences: final.convertedReferences || convertedReferences,
    pendingTask: ['unknown', 'timeout'].includes(final.status)
      ? { taskId: final.taskId, index: segment.index, kind: segment.kind, seconds: segment.seconds }
      : null,
    status: final.status,
    errorCode: final.errorCode,
    error: detail,
  };
}

/**
 * 用户点了停止 / 宿主等超时时：只有「确实已经生成出至少一段」才按暂停收尾（已有的段照常交付），
 * 否则保持原样把错误抛出去（没有任何成品时不该假装暂停）。
 */
export function absorbSegmentInterruption(failure, { segments, notes, message }) {
  const doneYet = segments.some((segment) => segment.status === 'succeeded' && segment.videoUrl);
  if (failure?.code !== 'ABORTED' || !doneYet) throw failure;
  notes.push(message);
}

/**
 * 收尾说明：某一段落败时区分「确实失败」和「只是没查到」——后者任务已经提交、大概率还在生成，
 * 必须把任务 ID 交出去让 video_status 事后补拉，而不是当成没生成。
 * 返回 true 表示没有任何可交付分段，调用方直接返回 result。
 */
export function describeIncompleteRun({ result, status, segments, notes, completed, deliveredSeconds }) {
  if (status === 'succeeded') return false;
  const last = segments.at(-1) || {};
  if (status === 'unknown' || status === 'timeout') {
    result.pendingTaskId = last.taskId;
    notes.push(
      `第 ${last.index ?? segments.length} 段的查询没拿到结果（${status}），但任务已提交：`
      + `${last.taskId || '（无任务 ID）'}。它可能仍在生成——用 video_status 按这个 ID 复查，`
      + '拿到链接就能补上这一段，不用重新提交、不会重复扣费。',
    );
  } else {
    notes.push(`第 ${last.index ?? segments.length} 段没有成功（${status}）。`);
  }
  if (!completed.length) return true;
  notes.push(
    `已把成功的 ${completed.length} 段（${deliveredSeconds} 秒）下载并合并交付，可作为残片使用。`,
  );
  result.partial = true;
  return false;
}

/** merge:false：只返回上游链接，不下载、不合并（暂停时仍要留 resume 提示）。 */
export function skipMergeDelivery({ result, paused, remainingSeconds, notes, segmentsDir, toolName }) {
  if (paused) {
    result.paused = true;
    result.nextAction = 'show_video_then_wait_for_user';
    result.remainingSeconds = remainingSeconds;
    notes.push(resumeHint(segmentsDir, remainingSeconds, toolName));
  }
  result.note = [...notes, '按参数要求只返回上游链接，没有下载合并。'].join('\n');
  return result;
}

/**
 * 下载已生成的分段并合并成交付文件，把结果写进 result（两个工具的收尾完全共用）。
 * remainingSeconds / pauseNote 由调用方按自己的计划口径算好传进来。
 */
export async function runSegmentDelivery({
  config, exec, interrupted, completed, segments, segmentsDir, outDir, stamp, notes, result,
  paused, remainingSeconds, pauseNote, toolName, cumulativePreview = false,
}) {
  const previewOnly = paused && !cumulativePreview;
  if (previewOnly) {
    for (const segment of completed.slice(0, -1)) {
      const file = path.join(segmentsDir, `${String(segment.index).padStart(2, '0')}-${segment.kind}.mp4`);
      try { if ((await stat(file)).isFile()) segment.localPath = file; } catch { /* 不补造不存在的文件 */ }
    }
  }
  const delivery = await downloadSegmentsAndMerge(config, {
    segments: previewOnly ? completed.slice(-1) : completed,
    segmentsDir,
    outDir,
    stamp,
    notes,
    // 暂停时只有一段的话，这一段的文件要留在分段目录里给之后续做用。
    keepSingleFile: paused,
    // 被中断时请求信号已经 abort：收尾（下载 + 合并）不能被它打断，否则等于白生成。
    signal: interrupted || exec?.signal?.aborted ? undefined : exec?.signal,
  });
  if (delivery.error) {
    result.deliveryError = delivery.error;
    if (delivery.ffmpegMissing) { result.ffmpegMissing = true; result.installHint = delivery.installHint; }
    result.nextAction = 'resume_delivery_without_regeneration';
    result.segmentsDir = delivery.segmentsDir;
    result.note = notes.join('\n');
    return result;
  }
  if (delivery.ffmpegMissing) {
    result.segmentsDir = delivery.segmentsDir;
    result.merged = false;
    result.ffmpegMissing = true;
    result.installHint = delivery.installHint;
    result.note = notes.join('\n');
    return result;
  }
  if (!delivery.files.length) {
    if (notes.length) result.note = notes.join('\n');
    return result;
  }
  if (delivery.merged && !previewOnly) {
    result.merged = true;
    result.videoPath = delivery.videoPath;
    result.mergeMode = delivery.mergeMode;
    if (delivery.actualSeconds) result.actualSeconds = delivery.actualSeconds;
    if (delivery.seamCuts?.length) result.seamCuts = delivery.seamCuts;
  }

  if (paused) {
    // 暂停：分段要留着（接着做时当前几段用），并写下「生成到哪一步」的暂停记录。
    result.segmentsDir = segmentsDir;
    result.resumeDir = segmentsDir;
    result.paused = true;
    result.nextAction = 'show_video_then_wait_for_user';
    result.previewPath = completed.at(-1)?.localPath || result.videoPath;
    if (previewOnly) { result.merged = false; result.previewOnly = true; }
    await appendRequestLog({ event: 'preview_required', previewPath: result.previewPath, resumeDir: result.resumeDir });
    result.remainingSeconds = remainingSeconds;
    notes.push(previewOnly ? '本次只下载并交付新段；最终完成后再合并完整成片。需要累计预览时可用原resume并传cumulativePreview:true，不新增生成费用。' : pauseNote);
    notes.push(resumeHint(segmentsDir, remainingSeconds, toolName));
    result.note = notes.join('\n');
    return result;
  }

  // 所有生成分段永久保留；合并、裁剪仅使用副本。
  result.segmentsDir = segmentsDir;
  if (notes.length) result.note = notes.join('\n');
  return result;
}
