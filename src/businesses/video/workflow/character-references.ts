/** 最初角色参考图快照：普通参考图优先，首帧兜底；不使用续拍结果反复截帧。 */
import { resolveImageInput, validateImageRoles, canvasSize } from '../media/references.js';
import { resolveModel, isVolcengine } from '../providers/connection.js';
import { ref } from '../config.js';

export async function initialCharacterReferences(config, args, saved, signal) {
  const current = saved?.operationState?.[Number(saved?.done) || 0];
  const rebuildingFailed = !saved?.pendingTask && current?.originalResult?.status === 'failed'
    && current.originalResult.errorCode !== 'real_person_rejected' && !current.retryUsed && !current.phase;
  if (Array.isArray(saved?.characterReferences) && !rebuildingFailed) {
    validateImageRoles({ referenceImages: saved.characterReferences.map(item => item?.image_url?.url) }, resolveModel(config));
    return saved.characterReferences.map(item => ({ ...item, image_url: { ...item.image_url } }));
  }
  const referenceImages = Array.isArray(args.referenceImages) ? args.referenceImages : args.referenceImages ? [args.referenceImages] : [];
  const source = args.characterReferenceImages ?? (referenceImages.length ? referenceImages : args.firstFrameUrl ? [args.firstFrameUrl] : []);
  const { refs } = validateImageRoles({ referenceImages: source }, resolveModel(config));
  const canvas = canvasSize(args.ratio || ref(config, 'ratio', 'adaptive'));
  const fit = canvas ? { size: canvas, config, signal } : null;
  const images = [];
  for (const value of refs) {
    const resolved = isVolcengine(config) && /^asset:\/\//.test(value)
      ? { url: value } : await resolveImageInput(value, '最初角色参考图', fit);
    images.push({ type: 'image_url', image_url: { url: resolved.url }, role: 'reference_image' });
  }
  return images;
}

/** 只有视频重试经审核成功后，才将角色图切换为已批准的转换图。 */
export function approvedCharacterReferences(images, state) {
  if (!state?.retryUsed || state.retryResult?.status !== 'succeeded' || !state.convertedBody) return images;
  const original = state.originalBody?.content || [];
  const converted = state.convertedBody.content || [];
  return images.map(image => {
    const index = original.findIndex(item => item.type === 'image_url' && item.image_url?.url === image.image_url?.url);
    const replacement = converted[index];
    return index >= 0 && replacement?.type === 'image_url'
      ? { ...image, image_url: { url: replacement.image_url.url } } : image;
  });
}
