/** 仅投影已生成成果的媒体字段，供结果卡片使用；不把请求或完整配置送到客户端。 */
const PREVIEW_TOOLS = new Set(['video_generate', 'video_extend', 'video_status', 'video_prepare_image']);
export function mediaPreviewMeta(value, toolName) {
  const media: Array<Record<string, string>> = [];
  const seen = new Set();
  function add(kind, label, localPath, url) {
    const file = typeof localPath === 'string' && /^(?:\/(?!\/)|[a-z]:[/\\])/i.test(localPath) && !/[\u0000-\u001f]/.test(localPath) ? localPath : '';
    let remote = '';
    try { const parsed = new URL(String(url || '')); if (['https:', 'http:'].includes(parsed.protocol) && !parsed.username && !parsed.password) remote = parsed.href; } catch { /* no remote */ }
    const key = file || remote;
    if (!key || seen.has(key) || media.length >= 40) return;
    seen.add(key);
    media.push({ kind, label, ...(file ? { localPath: file } : {}), ...(remote ? { url: remote } : {}) });
  }
  if (toolName === 'video_prepare_image') add('image', '角色参考图', value?.localPath, value?.imageUrl);
  else {
    if (value?.videoPath && value?.merged) add('video', value.paused || value.partial ? '已完成部分合并视频' : '完整视频', value.videoPath, '');
    const segments = (value?.segments || []).filter(s => s.status === 'succeeded');
    for (const segment of segments) add('video', `第${segment.index}段`, segment.localPath, segment.videoUrl);
    if (!segments.length && value?.status === 'succeeded') add('video', value.paused ? '本段视频' : '视频', value.previewPath || value.videoPath, value.videoUrl);
    for (const [i, item] of (value?.convertedReferences || []).entries()) add('image', `转换参考图${i + 1}`, item.localPath, item.imageUrl);
  }
  return { version: 1, media };
}
export function withMediaPreview(tool) {
  if (!PREVIEW_TOOLS.has(tool.name)) return tool;
  return { ...tool, output: { ...tool.output,
    presentationMeta(args, value) {
      return { ...(tool.output.presentationMeta?.(args, value) || {}), metaonticMedia: mediaPreviewMeta(value, tool.name) };
    },
  } };
}
