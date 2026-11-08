/** 真人转换按图片持久化，完成后返回预览，下一次获确认才重试视频。 */
import { createHash } from 'node:crypto';
import { prepareImageTool } from '../tools/video-prepare-image.js';
import { resolveImageInput } from '../media/references.js';
import { approvalPolicy } from './approval.js';

export async function recoverRealPersonImages(config, body, ctx, exec, final, state: any = {}, saveState: () => Promise<void> = async () => {}) {
  const images: any[] = (body.content || []).filter((item) => item.type === 'image_url' && item.image_url?.url);
  if (!images.length) {
    final.error = `${final.error || ''}。本次没有可转换的图片参考；若限制来自参考视频，请提供非真人视频素材。`;
    return;
  }
  if (!state.conversionApproved) {
    const approval = ctx?.get?.('approval');
    if (!approval?.request || !exec?.agent || approvalPolicy(ctx, exec) === 'never') {
      final.error = `${final.error || ''}。当前无法取得转换授权，已停止，未转换或重试。`;
      return;
    }
    let outcome;
    try {
      outcome = await approval.request({
        agent: exec.agent, toolName: 'video_prepare_image',
        ...(exec.callId ? { callId: exec.callId } : {}),
        ...(exec.signal ? { signal: exec.signal } : {}),
        reason: `视频接口返回真人限制。是否将本次 ${images.length} 张参考图转换为非真人二维动画风格？图片处理单独计费。转换后先展示核对，不立即重试视频。`,
        displayReason: {
          zh: `视频接口提示参考素材含真人。是否用 Seedream 将本次 ${images.length} 张参考图转为非真人二维动画风格？图片处理单独计费。完成后先展示图片，确认效果后才重试视频，视频费用另计。拒绝或取消将停止。`,
          en: `Convert ${images.length} reference image(s) to non-photorealistic 2D animation with Seedream? Images are billed separately. Review the results before a separately confirmed video retry. Reject or cancel to stop.`,
        },
      });
    } catch { outcome = 'unavailable'; }
    if (String(outcome) !== 'allowed-once') {
      final.error = `${final.error || ''}。未取得用户转换同意，已停止，未转换图片或重试视频。`;
      return;
    }
    state.conversionApproved = true;
    state.phase = 'converting';
    state.images ||= {};
    await saveState();
  }
  const replacements = new Map<string, string>();
  try {
    for (const item of images) {
      const source = String(item.image_url.url);
      const key = createHash('sha256').update(source).digest('hex');
      const entry = state.images[key] ||= {};
      if (entry.failed) throw new Error(`图片任务 ${entry.taskId || ''} 已明确失败：${entry.failed}。不自动再次出图。`);
      if (!entry.imageUrl) {
        const progress = {
          onCreated: async (taskId) => { entry.taskId = taskId; await saveState(); },
          onCompleted: async (result) => { entry.imageUrl = result.imageUrl; await saveState(); },
        };
        try {
          await prepareImageTool(config, progress).execute(entry.taskId
            ? { taskId: entry.taskId }
            : { image: source, style: '明显的非真人二维动画角色，保持原构图、服装和动作' }, exec);
        } catch (error) {
          if (error?.terminal) entry.failed = error.message;
          if (error?.submissionId) entry.submissionId = error.submissionId;
          await saveState(); throw error;
        }
      }
      const resolved = await resolveImageInput(entry.imageUrl, '转换后的参考图');
      replacements.set(source, String(resolved.url));
    }
  } catch (error) {
    final.error = `${final.error || ''}。Seedream 转换未完成：${error?.message || error}。已保存逐张进度；继续时查询已有任务并复用已完成图片，不重新出图。`;
    final.errorCode = error?.code || 'image_conversion_incomplete';
    return;
  }
  state.convertedBody = {
    ...body,
    content: body.content.map((item) => item.type === 'image_url' && replacements.has(item.image_url?.url)
      ? { ...item, image_url: { ...item.image_url, url: replacements.get(item.image_url.url) } } : item),
  };
  state.phase = 'review';
  await saveState();
  setReferenceReview(final, state);
}

export function setReferenceReview(final, state) {
  final.status = 'review_required';
  final.errorCode = 'reference_review_required';
  final.error = '图片已转换。请先展示每张结果，核对为非真人且风格符合要求；用户确认后用原 resume 并传 referenceImagesReviewed:true，才会重试视频一次。若仍像真人或不满意，停止，不自动再转换。';
  final.convertedReferences = state.convertedBody.content.filter((item) => item.type === 'image_url').map((item) => ({ role: item.role, imageUrl: item.image_url.url }));
}
