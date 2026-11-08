/** 时长在需求阶段确认；不以接口兜底时长代替用户选择。 */
import { MIN_SECONDS, MAX_TOTAL_SECONDS } from '../config.js';

export const DURATION_OPTIONS = [15, 30, 45, 60];
const CUSTOM = '自定义时长';
export function parseVideoDuration(value): number | null {
  if (typeof value === 'number') return Number.isInteger(value) && value >= MIN_SECONDS && value <= MAX_TOTAL_SECONDS ? value : null;
  if (typeof value !== 'string') return null;
  const match = /^\s*(\d+)\s*(?:秒|s|seconds?)?\s*$/i.exec(value);
  return match ? parseVideoDuration(Number(match[1])) : null;
}
type DurationChoiceResult = { status: 'confirmed'; duration: number } | { status: 'pending'; reason: string };
export async function ensureProjectDuration(ctx, exec, project, requested, save): Promise<DurationChoiceResult> {
  const pending = (reason: string): DurationChoiceResult => ({ status: 'pending', reason });
  if (exec.signal?.aborted) return pending('已取消时长确认，未继续制作。');
  const approvedSpec = project.approved?.specification;
  const approvedDuration = approvedSpec ? parseVideoDuration(Number(approvedSpec.duration) * (project.approved.name === 'video_extend' ? Number(approvedSpec.segments || 1) : 1)) : null;
  const persist = async (duration: number): Promise<DurationChoiceResult> => {
    const next = { ...project, duration, approved: (project.duration ?? approvedDuration) !== duration ? null : project.approved };
    delete next.durationCustom;
    await save(next);
    Object.assign(project, next);
    delete project.durationCustom;
    return { status: 'confirmed', duration };
  };
  if (requested !== undefined) {
    const duration = parseVideoDuration(requested);
    if (duration === null) throw new Error(`视频时长需为${MIN_SECONDS}–${MAX_TOTAL_SECONDS}秒的整数，请先向用户确认。`);
    return await persist(duration);
  }
  if (parseVideoDuration(project.duration) !== null) return { status: 'confirmed', duration: project.duration };
  if (approvedDuration !== null) return await persist(approvedDuration);
  const service = exec.agent?.ctx?.get?.('userQuestions') || ctx.get?.('userQuestions');
  if (typeof service?.ask !== 'function') return pending('时长尚未确认，请恢复提问能力后让用户选择，不得默认15秒。');
  const ask = async (id, question, options = undefined) => {
    const result = await service.ask({ agent: exec.agent, signal: exec.signal, ...(exec.callId ? { wait: { callId: exec.callId } } : {}),
      questions: [{ id, header: '视频长度', question, multiSelect: false, ...(options ? { options } : {}) }] });
    if (exec.signal?.aborted) return null;
    return result?.answers?.find(answer => answer.id === id);
  };
  try {
    if (!project.durationCustom) {
      const answer = await ask('video_duration', '你希望视频总长度是多少？请选择建议长度，或选择自定义时长后输入秒数。超过模型单段上限会分段续拍，新增分段单独计费。', [
        ...DURATION_OPTIONS.map(seconds => ({ label: `${seconds} 秒`, description: seconds === 15 ? '适合简短展示或一个小情节。' : seconds === 30 ? '适合一段简短故事或产品介绍。' : seconds === 45 ? '适合有起承转合的内容。' : '适合较完整的故事或展示。' })),
        { label: CUSTOM, description: `自己输入${MIN_SECONDS}–${MAX_TOTAL_SECONDS}秒的整数。` },
      ]);
      if (!answer) return pending('时长尚未确认，未继续制作。');
      const text = answer.custom?.trim() || (answer.selected?.length === 1 ? answer.selected[0] : '');
      const duration = parseVideoDuration(text);
      if (duration !== null) return await persist(duration);
      if (text !== CUSTOM) return pending(`请选择视频长度或输入${MIN_SECONDS}–${MAX_TOTAL_SECONDS}秒的整数，未继续制作。`);
      project.durationCustom = true;
      await save(project);
    }
    const answer = await ask('video_duration_custom', `请输入希望的视频总长度（${MIN_SECONDS}–${MAX_TOTAL_SECONDS}秒，整数，例如20秒）。`);
    const duration = parseVideoDuration(answer?.custom);
    if (duration === null) return pending(`自定义时长尚未确认，请输入${MIN_SECONDS}–${MAX_TOTAL_SECONDS}秒的整数，未继续制作。`);
    return await persist(duration);
  } catch {
    return pending('时长确认或记录保存未完成，未继续制作；请恢复提问和记录能力后重试。');
  }
}
