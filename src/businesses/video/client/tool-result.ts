/** 工具结果和运行进度分开：完成后只显示成果预览，不显示生成进度。 */
export function createToolResultView({ h, MediaPreview, VideoTaskProgress }) {
  function ToolResultView(props) {
    if (props.block && 'kind' in props.block) return h(MediaPreview, props);
    if (!['metaontic_agent_forge_video_generate', 'metaontic_agent_forge_video_extend'].includes(props.toolName)) return null;
    return h(VideoTaskProgress, props);
  }
  return { ToolResultView };
}
