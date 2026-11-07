export function estimatedVideoWait(duration) {
    const seconds = Number(duration);
    // 5 秒视频约 120 秒，15 秒视频约 150 秒；其他时长按同一斜率估算。
    return Number.isFinite(seconds) && seconds > 0 ? 105 + seconds * 3 : 180;
}
export function estimatedVideoProgress(elapsed, duration) {
    const seconds = Math.max(0, Number(elapsed) || 0);
    // 实际结果返回前始终停在 99%。
    return Math.min(99, Math.max(1, Math.floor(seconds / estimatedVideoWait(duration) * 100)));
}
/** Read active video calls from the current session, including nested dispatch calls. */
export function activeVideoCalls(chat) {
    const calls = [];
    const seen = new Set();
    function visit(block) {
        if (!block)
            return;
        const done = 'kind' in block;
        const name = done ? block.call?.name : block.name;
        if (!done && ['video_generate', 'video_extend'].includes(name)
            && !seen.has(block.callId)) {
            seen.add(block.callId);
            calls.push({ block, toolName: name, callId: block.callId });
        }
        for (const child of block.subCalls || [])
            visit(child);
    }
    // Presentation order excludes hidden/grouped nodes while their requests can still run.
    const nodes = chat?.nodes?.values?.()
        ?? (chat?.order || []).map((key) => chat.nodes?.get(key));
    for (const node of nodes) {
        if (node?.kind === 'tool-call')
            visit(node.data?.root);
    }
    return calls;
}
export function videoExecutionSource(eventSource) {
    let previous;
    let snapshot = new Map();
    return {
        subscribe: (listener) => eventSource.subscribe(listener),
        getSnapshot() {
            const window = eventSource.getSnapshot();
            if (window === previous)
                return snapshot;
            const next = new Map();
            for (const { event } of window.entries) {
                if (event.type === 'plugin:metaontic-video/execution') {
                    const { callId, phase } = event.data || {};
                    if (typeof callId !== 'string')
                        continue;
                    if (phase === 'start')
                        next.set(callId, event.time);
                    else if (phase === 'end')
                        next.delete(callId);
                }
                else if (event.type === 'turn/end')
                    next.clear();
            }
            previous = window;
            if (next.size !== snapshot.size || [...next].some(([id, time]) => snapshot.get(id) !== time))
                snapshot = next;
            return snapshot;
        },
    };
}
/** 浏览器端 progress：由入口注入宿主 React 与共享依赖。 */
export function createVideoProgress({ React, h, TOKENS }: any) {
    /** 宿主工具卡片：仅消费实际运行状态，等待动画不代表百分比进度。 */
    function VideoTaskProgress({ block = {}, toolName = 'video_generate', callId, useVideoExecutions, startedAt }: {
        block?: any;
        toolName?: string;
        callId?: string;
        useVideoExecutions?: any;
        startedAt?: number;
    }) {
        const done = 'kind' in block;
        const executions = useVideoExecutions?.((snapshot) => snapshot);
        const beganAt = startedAt ?? executions?.get(callId);
        const [elapsed, setElapsed] = React.useState(0);
        React.useEffect(() => {
            if (done || beganAt === undefined)
                return;
            const tick = () => setElapsed(Math.max(0, Math.floor((Date.now() - beganAt) / 1000)));
            tick();
            const timer = window.setInterval(tick, 1000);
            return () => window.clearInterval(timer);
        }, [done, callId, beganAt]);
        if (done)
            return null;
        if (!['video_generate', 'video_extend'].includes(toolName) || block.phase !== 'start' || beganAt === undefined)
            return null;
        const status = '正在生成 · 等待结果';
        const duration = block.args?.duration;
        const estimatedWait = estimatedVideoWait(duration);
        const progress = estimatedVideoProgress(elapsed, duration);
        const waitingDots = '.'.repeat((elapsed % 3) + 1);
        const title = toolName === 'video_extend' ? '视频续拍' : '视频生成';
        return h('div', { className: 'mov-task mov-task-running', 'data-field': 'video-task-progress' }, [
            h('style', { key: 'style' }, `
          @keyframes mov-task-spin { to { transform: rotate(360deg); } }
          @keyframes mov-task-flow { from { background-position:0 0; } to { background-position:32px 0; } }
          @keyframes mov-task-shimmer { from { transform:translateX(-120%); } to { transform:translateX(420%); } }
          @keyframes mov-task-pulse { 0%,100% { opacity:.45; } 50% { opacity:1; } }
          @keyframes mov-task-breath { 0%,100% { border-color:${TOKENS.border}; box-shadow:0 0 0 0 transparent; } 50% { border-color:${TOKENS.primaryFill}; box-shadow:0 0 12px 0 ${TOKENS.primaryFill}; } }
          .mov-task { box-sizing:border-box; min-width:0; width:100%; border:1px solid ${TOKENS.border}; border-radius:10px; padding:10px 12px; color:${TOKENS.text}; margin:6px 0; overflow-wrap:anywhere; }
          .mov-task-running { animation:mov-task-breath 2.4s ease-in-out infinite; }
          .mov-task-head { display:flex; align-items:center; gap:10px; flex-wrap:wrap; font-size:13px; }
          .mov-task-spinner { width:14px; height:14px; border:2px solid ${TOKENS.border}; border-top-color:${TOKENS.primaryFill}; border-radius:50%; animation:mov-task-spin .9s linear infinite; }
          .mov-task-note { font-size:12px; color:${TOKENS.muted}; margin-top:8px; }
          .mov-task-rail { position:relative; margin-top:20px; }
          .mov-task-track { height:5px; border-radius:999px; overflow:hidden; background:${TOKENS.border}; }
          .mov-task-turtle { position:absolute; top:-14px; transform:translateX(-50%) scaleX(-1); font-size:12px; line-height:1; transition:left 1s ease; }
          .mov-task-fill { height:100%; border-radius:999px; background:${TOKENS.primaryFill}; transition:width 1s ease; position:relative; overflow:hidden; }
          .mov-task-active .mov-task-fill { background-image:repeating-linear-gradient(110deg,transparent 0px,transparent 12px,rgba(255,255,255,.22) 12px,rgba(255,255,255,.22) 22px,transparent 22px,transparent 32px); background-size:32px 100%; animation:mov-task-flow 1s linear infinite; }
          .mov-task-active .mov-task-fill::after { content:''; position:absolute; inset:0; width:30%; background:linear-gradient(90deg,transparent,rgba(255,255,255,.6),transparent); animation:mov-task-shimmer 2s linear infinite; }
          .mov-task-live { display:inline-block; width:6px; height:6px; border-radius:50%; background:${TOKENS.primaryFill}; margin-right:6px; animation:mov-task-pulse 1.4s ease-in-out infinite; }
          .mov-task-dots { display:inline-block; width:18px; text-align:left; }
          @media(prefers-reduced-motion:reduce) { .mov-task-spinner, .mov-task-live, .mov-task-active .mov-task-fill, .mov-task-active .mov-task-fill::after { animation:none; } .mov-task-turtle { transition:none; } .mov-task-running { animation:none; } }
        `),
            h('div', { key: 'head', className: 'mov-task-head' }, [
                h('span', { key: 'spinner', className: 'mov-task-spinner', 'aria-hidden': true }),
                h('strong', { key: 'title' }, title),
                h('span', { key: 'status', role: 'status' }, [status, h('span', { key: 'dots', className: 'mov-task-dots', 'aria-hidden': true }, waitingDots)]),
                h('span', { key: 'elapsed', style: { marginLeft: 'auto', fontVariantNumeric: 'tabular-nums' } }, `已等待 ${Math.floor(elapsed / 60)}分${String(elapsed % 60).padStart(2, '0')}秒`),
            ]),
            h('div', { key: 'progress', className: 'mov-task-rail' }, [
                h('div', { className: 'mov-task-track mov-task-active', role: 'progressbar', 'aria-label': '估算进度', 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': progress }, h('div', { className: 'mov-task-fill', style: { width: `${progress}%` } })),
                // 装饰用的小乌龟：跟着进度条填充的右端一起从左往右爬，只表示「还在忙」，不代表真实进度；屏幕阅读器不读它。
                h('span', { key: 'turtle', className: 'mov-task-turtle', style: { left: `${progress}%` }, 'aria-hidden': true }, '🐢'),
            ]),
            h('div', { key: 'percent', className: 'mov-task-note' }, `${progress}% · 估算进度`),
            h('div', { key: 'note', className: 'mov-task-note' }, [
                h('span', { key: 'live', className: 'mov-task-live', 'aria-hidden': true }),
                `${duration ? `目标 ${duration} 秒 · 预计等待约 ${Math.round(estimatedWait)} 秒 · ` : ''}${progress >= 99 ? '任务仍在等待结果，进度停在99%不表示失败。' : '任务处理中，完成后自动显示结果。'}请勿重复提交。`,
            ]),
        ]);
    }
    function VideoProgressDock({ useChat, useVideoExecutions }) {
        const chat = useChat((snapshot) => snapshot);
        const executions = useVideoExecutions?.((snapshot) => snapshot);
        const calls = activeVideoCalls(chat).filter((call) => call.block.phase === 'start' && executions?.has(call.callId));
        if (!calls.length)
            return null;
        return h('div', { 'data-field': 'video-progress-dock', 'aria-live': 'polite',
            style: { boxSizing: 'border-box',
                width: 'calc(100% - var(--dsh-composer-side-clearance, 0px) - var(--dsh-composer-side-clearance, 0px))',
                maxWidth: 'var(--dsh-composer-card-max-width, 100%)', minWidth: 0, margin: '0 auto', flex: 'none' } }, calls.map((call) => h(VideoTaskProgress, { ...call, startedAt: executions.get(call.callId), key: call.callId })));
    }
    return { videoExecutionSource, VideoTaskProgress, VideoProgressDock };
}
