/** 动态创作身份仅用于当前选中的视频预设，不从历史消息或工具使用推断模式。 */
export function isVideoDirector(context: any, ctx: any) {
  const agent = context?.agent;
  const session = agent?.session;
  if (!session) return false;
  for (const owner of [agent?.ctx, ctx]) {
    try {
      const registry = owner?.get?.('agentPresets');
      // 当前会话 projection 优先；标准模式的 null 也是权威答案，不能回退旧 header。
      if (typeof registry?.presetForSession === 'function') return registry.presetForSession(session) === 'video-director';
    } catch { return false; }
  }
  // 旧宿主没有预设 registry 时仅识别明确的创建预设；不猜测未知会话。
  return session.header?.agentPreset === 'video-director';
}
