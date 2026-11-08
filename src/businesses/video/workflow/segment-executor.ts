/** 生成与续拍共用的执行边界：持久化、原任务查询、结果记录、逐段暂停与中断收尾。 */
import { runTask, normalizeReferenceUrl } from '../providers/seedance.js';
import { approvedCharacterReferences } from './character-references.js';
import { abortError } from '../utils/errors.js';
import { recordSegmentResult, absorbSegmentInterruption, SEGMENT_PAUSE_NOTE } from './segment-run.js';
export interface SegmentExecutionState {
    cursor: number | null;
    referenceUrl: string;
    pendingTask: any;
    characterReferences: any[];
    status: string;
    error?: string;
    errorCode?: string;
    submissionId?: string;
    convertedReferences?: any[];
    paused: boolean;
    interrupted: boolean;
}
export async function executeSegmentPlan({ config, ctx, exec, args, plan, doneBefore, segments, segmentsDir, operationState, notes, initial, save, buildStep, advanceCursor = (cursor, seconds) => cursor == null ? null : cursor + seconds, persistBeforeRun = false, interruptionMessage, }): Promise<SegmentExecutionState> {
    const state: SegmentExecutionState = {
        ...initial, status: 'succeeded', paused: Boolean(initial.paused), interrupted: false,
    };
    const checkpoint = () => save(state);
    if (persistBeforeRun)
        await checkpoint();
    try {
        for (const [offset, step] of plan.entries()) {
            if (exec?.signal?.aborted)
                throw abortError();
            const position = doneBefore + offset;
            let saved = operationState[position] ||= {};
            // 明确失败、未进入真人转换的分段可按新审核参数重新构造；已提交/未知任务保留原请求。
            if (!state.pendingTask && saved.originalResult?.status === 'failed'
                && saved.originalResult.errorCode !== 'real_person_rejected' && !saved.retryUsed && !saved.phase) {
                saved = operationState[position] = {};
                await checkpoint();
            }
            const { body, seconds } = saved.originalBody
                ? { body: saved.originalBody, seconds: step.seconds }
                : await buildStep({ step, position, state });
            const final = await runTask(config, body, exec?.signal, {
                ctx, exec, state: saved, saveState: checkpoint,
                scope: `${segmentsDir}:${position}`,
                referenceImagesReviewed: args?.referenceImagesReviewed === true,
                taskId: state.pendingTask?.taskId,
                onCreated: async (taskId) => {
                    state.pendingTask = { taskId, index: position + 1, kind: step.kind, seconds };
                    await checkpoint();
                },
            });
            if (final.status === 'succeeded') {
                state.characterReferences = approvedCharacterReferences(state.characterReferences, saved);
                await checkpoint();
            }
            const outcome = recordSegmentResult({
                final, segments, segment: { index: position + 1, kind: step.kind, seconds },
                submissionId: state.submissionId, convertedReferences: state.convertedReferences,
            });
            state.submissionId = outcome.submissionId;
            state.convertedReferences = outcome.convertedReferences;
            state.pendingTask = outcome.pendingTask;
            if (!outcome.ok) {
                await checkpoint();
                state.status = outcome.status;
                state.errorCode = outcome.errorCode;
                state.error = outcome.error;
                break;
            }
            state.referenceUrl = normalizeReferenceUrl(final.videoUrl);
            state.cursor = advanceCursor(state.cursor, seconds);
            await checkpoint();
            if (plan[offset + 1]) {
                state.paused = true;
                notes.push(SEGMENT_PAUSE_NOTE);
                break;
            }
        }
    }
    catch (failure) {
        absorbSegmentInterruption(failure, { segments, notes, message: interruptionMessage });
        state.interrupted = true;
        state.paused = true;
    }
    return state;
}
