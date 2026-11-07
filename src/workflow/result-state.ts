/** 一个入口解释旧版结果字段；对外结果和断点格式保持兼容。 */
export interface VideoResultSnapshot {
    status?: string;
    paused?: boolean;
    partial?: boolean;
    merged?: boolean;
    pendingTaskId?: string;
    deliveryError?: string;
    ffmpegMissing?: boolean;
    videoPath?: string;
    videoUrl?: string;
    remainingSeconds?: number;
    segments?: Array<{
        status?: string;
        localPath?: string;
        videoUrl?: string;
    }>;
}
export type VideoPhase = 'reference_review' | 'task_pending' | 'delivery_pending' | 'segment_review' | 'partial' | 'failed' | 'complete' | 'generated' | 'unknown';
export type VideoDelivery = 'none' | 'remote' | 'segments' | 'single' | 'merged';
export type VideoResultState = {
    delivery: VideoDelivery;
    completedCount: number;
} & ({
    phase: 'complete';
    isFinal: true;
    canPresent: true;
} | {
    phase: 'generated';
    isFinal: true;
    canPresent: false;
} | {
    phase: Exclude<VideoPhase, 'complete' | 'generated'>;
    isFinal: false;
    canPresent: false;
});
export function videoResultState(value: VideoResultSnapshot = {}): VideoResultState {
    value ??= {};
    const segments = Array.isArray(value.segments) ? value.segments : [];
    const completed = segments.filter(s => s?.status === 'succeeded' && (s.localPath || s.videoUrl));
    const multi = segments.length > 1 || Boolean(value.paused && value.remainingSeconds > 0);
    const local = Boolean(value.videoPath || completed.some(s => s.localPath));
    const delivery: VideoDelivery = value.merged && value.videoPath ? (multi ? 'merged' : 'single')
        : value.videoPath && !multi ? 'single' : local ? (multi ? 'segments' : 'single')
            : value.videoUrl || completed.length ? 'remote' : 'none';
    let phase: VideoPhase;
    if (value.status === 'review_required')
        phase = 'reference_review';
    else if (value.pendingTaskId || ['unknown', 'timeout'].includes(value.status)
        || segments.some(s => ['unknown', 'timeout', 'running', 'queued'].includes(s?.status)))
        phase = 'task_pending';
    else if (value.deliveryError || value.ffmpegMissing)
        phase = 'delivery_pending';
    else if (value.paused)
        phase = 'segment_review';
    else if (value.partial)
        phase = 'partial';
    else if (['failed', 'cancelled', 'canceled'].includes(value.status)
        || segments.some(s => ['failed', 'cancelled', 'canceled'].includes(s?.status)))
        phase = completed.length ? 'partial' : 'failed';
    else if (value.status !== 'succeeded' || delivery === 'none')
        phase = 'unknown';
    else
        phase = ['merged', 'single'].includes(delivery) ? 'complete' : 'generated';
    const details = { delivery, completedCount: completed.length };
    if (phase === 'complete')
        return { ...details, phase, isFinal: true, canPresent: true };
    if (phase === 'generated')
        return { ...details, phase, isFinal: true, canPresent: false };
    return { ...details, phase, isFinal: false, canPresent: false };
}
/** 只验证影响恢复安全的字段，兼容没有version的新旧v1断点；不改写原文件。 */
export function validatePauseRecord(data, file = 'paused-plan.json') {
    const invalid = () => { throw new Error(`暂停记录内容不对：${file}。请保留原文件并核对原任务，不要重新提交。`); };
    if (!data || data.plugin !== 'metaontic-video' || (data.version != null && data.version !== 1)
        || !Array.isArray(data.plan) || !data.plan.length)
        invalid();
    if (data.plan.some(step => !step || !['generate', 'extend'].includes(step.kind)
        || !Number.isFinite(step.seconds) || step.seconds <= 0))
        invalid();
    const done = data.done ?? 0;
    if (!Number.isInteger(done) || done < 0 || done > data.plan.length)
        invalid();
    if (data.cursor != null && !Number.isFinite(data.cursor))
        invalid();
    if (data.steps != null && (!Array.isArray(data.steps) || data.steps.length !== done))
        invalid();
    if (done > 0 && !Array.isArray(data.steps))
        invalid();
    if (data.steps?.some((step, index) => !step || step.index !== index + 1
        || !['generate', 'extend'].includes(step.kind) || (step.seconds != null && (!Number.isFinite(step.seconds) || step.seconds <= 0))
        || !step.taskId || !step.videoUrl))
        invalid();
    if (data.pendingTask && (!data.pendingTask.taskId || (data.pendingTask.index != null && data.pendingTask.index !== done + 1)
        || done >= data.plan.length))
        invalid();
    return data;
}
