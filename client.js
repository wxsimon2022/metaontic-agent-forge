(() => {
  // src/client/theme.ts
  function createTheme() {
    const TOKENS = {
      text: "var(--dsw-alias-label-primary, inherit)",
      muted: "var(--dsw-alias-label-caption, #8886)",
      border: "var(--dsw-alias-border-l2, #8884)",
      cardFill: "var(--dsw-alias-settings-card-fill, transparent)",
      controlFill: "var(--dsw-specific-input-major, transparent)",
      primaryFill: "var(--dsw-alias-button-primary-fill, #247bbf)",
      error: "var(--dsw-alias-state-error-primary, #d9534f)",
      success: "var(--dsw-alias-state-success-primary, #2e9e5b)"
    };
    const inputStyle = { width: "100%", boxSizing: "border-box" };
    const PAGE_CSS = `
      /* \u6574\u9875\u7EB5\u5411\u6392\u5E03\uFF1A\u5757\u4E0E\u5757\u4E4B\u95F4\u7EDF\u4E00 16px\uFF0C\u6BD4\u4E00\u6574\u7247\u8868\u5355\u597D\u626B */
      .mov-page { display: flex; flex-direction: column; gap: 16px; padding: 4px 0; color: ${TOKENS.text}; }
      /* \u5206\u7EC4\u5361\u7247\uFF1A16 \u4E2A\u5B57\u6BB5\u644A\u5728\u4E00\u683C\u91CC\u592A\u7CCA\uFF0C\u6309\u7528\u9014\u5404\u88C5\u4E00\u5F20\u5361 */
      .mov-section { display: flex; flex-direction: column; gap: 14px; padding: 14px 16px 16px; border-radius: 12px; border: 1px solid ${TOKENS.border}; background: ${TOKENS.cardFill}; }
      .mov-advanced { display: block; }
      .mov-advanced-toggle { cursor: pointer; font-size: 13px; font-weight: 600; color: ${TOKENS.text}; }
      .mov-advanced-toggle .mov-hint { display: block; margin: 5px 0 0 16px; font-weight: 400; }
      .mov-advanced-toggle:focus-visible { outline: 2px solid ${TOKENS.primaryFill}; outline-offset: 5px; border-radius: 4px; }
      .mov-advanced-body { display: flex; flex-direction: column; gap: 18px; border-top: 1px solid ${TOKENS.border}; margin-top: 14px; padding-top: 16px; }
      .mov-advanced-body .mov-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px 18px; align-items: start; }
      .mov-advanced-body .mov-field-wide { grid-column: auto; }
      .mov-advanced-group { display: flex; flex-direction: column; gap: 12px; min-width: 0; }
      .mov-advanced-group + .mov-advanced-group { border-top: 1px solid ${TOKENS.border}; padding-top: 16px; }
      .mov-advanced-group .mov-label { min-height: 30px; display: flex; align-items: flex-end; }
      .mov-advanced-tools .mov-grid { grid-template-columns: minmax(0, 1fr); }
      .mov-advanced-tools .mov-label { min-height: 0; }
      .mov-advanced-group[data-group="advancedPicture"] .mov-grid { grid-template-columns: minmax(0, 1fr); }
      .mov-advanced-group[data-group="advancedPicture"] .mov-switch { justify-content: space-between; flex-direction: row-reverse; }

      @container (max-width: 480px) { .mov-advanced-body .mov-grid { grid-template-columns: minmax(0, 1fr); } .mov-advanced-group .mov-label { min-height: 0; } }
      .mov-advanced { container-type: inline-size; }
      .mov-section-title { display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 600; color: ${TOKENS.text}; }
      /* \u6807\u9898\u5DE6\u8FB9\u4E00\u9053\u4E3B\u8272\u7AD6\u6761\uFF0C\u4EE3\u66FF\u7EAF\u6587\u5B57\u5206\u7EC4\u6807\u9898 */
      .mov-section-title::before { content: ""; flex: 0 0 auto; width: 3px; height: 13px; border-radius: 2px; background: ${TOKENS.primaryFill}; }
      .mov-section-title::after { content: ""; flex: 1 1 auto; height: 1px; background: ${TOKENS.border}; }
      /* \u4E24\u5217\u81EA\u9002\u5E94\uFF1A\u5355\u5217\u81F3\u5C11 240px\uFF0C\u7A84\u9762\u677F\u81EA\u52A8\u843D\u6210\u4E00\u5217 */
      .mov-parameter-group { container-type: inline-size; display: flex; flex-direction: column; gap: 12px; min-width: 0; }
      .mov-parameter-group + .mov-parameter-group { border-top: 1px solid ${TOKENS.border}; padding-top: 16px; }
      .mov-parameter-heading { font-size: 12px; font-weight: 600; color: ${TOKENS.muted}; }
      .mov-parameter-group .mov-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); align-items: start; }
      @container (max-width: 480px) { .mov-parameter-group .mov-grid { grid-template-columns: minmax(0, 1fr); } }
      .mov-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 240px), 1fr)); gap: 14px 18px; }
      .mov-field { display: flex; flex-direction: column; min-width: 0; }
      .mov-model-settings { display: flex; flex-direction: column; gap: 14px; min-width: 0; }
      .mov-model-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
      .mov-model-grid-single { grid-template-columns: minmax(0, 1fr); }
      .mov-model-card { display: flex; flex-direction: column; gap: 14px; padding: 12px; border: 1px solid ${TOKENS.border}; border-radius: 10px; min-width: 0; }
      .mov-parameter-group > .mov-card { border: 0; padding: 0; background: transparent; }
      @container (max-width: 600px) { .mov-model-grid { grid-template-columns: minmax(0, 1fr); } }

      .mov-av-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
      .mov-av-card { display: flex; flex-direction: column; min-width: 0; padding: 12px; gap: 8px; border: 1px solid ${TOKENS.border}; border-radius: 10px; background: ${TOKENS.cardFill}; }
      .mov-av-card > .mov-label { margin-bottom: -2px; }
      .mov-av-card .mov-hint { margin-top: auto; }
      .mov-av-audio .mov-switch { justify-content: space-between; gap: 12px; padding: 0; border: 0; background: transparent; }
      .mov-av-audio .mov-switch span { order: 0; }
      .mov-av-audio .mov-switch input { appearance: none; order: 1; flex: 0 0 34px; width: 34px; height: 20px; margin: 0; border: 1px solid ${TOKENS.border}; border-radius: 999px; background: ${TOKENS.border}; position: relative; transition: background .15s; }
      .mov-av-audio .mov-switch input::after { content: ''; position: absolute; width: 14px; height: 14px; left: 2px; top: 2px; border-radius: 50%; background: white; transition: transform .15s; }
      .mov-av-audio .mov-switch input:checked { background: ${TOKENS.primaryFill}; border-color: ${TOKENS.primaryFill}; }
      .mov-av-audio .mov-switch input:checked::after { transform: translateX(14px); }
      .mov-av-audio .mov-switch input:focus-visible { outline: 2px solid ${TOKENS.primaryFill}; outline-offset: 3px; }
      @container (max-width: 480px) { .mov-av-grid { grid-template-columns: minmax(0, 1fr); } }
      @media (prefers-reduced-motion: reduce) { .mov-av-audio .mov-switch input, .mov-av-audio .mov-switch input::after { transition: none; } }

      /* \u5F00\u5173\u6CA1\u6709\u6807\u7B7E\u884C\uFF0C\u9760\u5E95\u5BF9\u9F50\u624D\u80FD\u8DDF\u65C1\u8FB9\u8F93\u5165\u6846\u7684\u63A7\u5236\u7EBF\u9F50\u5E73 */
      .mov-field-switch { justify-content: flex-end; }
      .mov-field-wide { grid-column: 1 / -1; }
      .mov-label { display: block; font-size: 12px; color: ${TOKENS.muted}; margin-bottom: 6px; }
      .mov-input { padding: 8px 10px; border-radius: 8px; border: 1px solid ${TOKENS.border}; background: ${TOKENS.controlFill}; color: ${TOKENS.text}; font: inherit; font-size: 13px; height: 36px; }
      .mov-key-control { position: relative; min-width: 0; }
      .mov-key-control .mov-input { padding-right: 40px; }
      .mov-key-eye { position: absolute; right: 4px; top: 50%; transform: translateY(-50%); width: 30px; height: 28px; display: flex; align-items: center; justify-content: center; padding: 0; border: 0; border-radius: 5px; background: transparent; color: ${TOKENS.muted}; cursor: pointer; }
      .mov-key-eye:hover { color: ${TOKENS.text}; background: ${TOKENS.border}; }
      .mov-key-eye:focus-visible { outline: 2px solid ${TOKENS.primaryFill}; outline-offset: 1px; }
      .mov-input:focus, .mov-input:focus-visible { outline: none; border-color: ${TOKENS.primaryFill}; box-shadow: 0 0 0 3px rgba(36, 123, 191, .18); }
      /* \u6A21\u578B ID \u4E0E\u53EF\u6267\u884C\u6587\u4EF6\u8DEF\u5F84\u5F88\u957F\uFF1A\u7B49\u5BBD\u5B57\u4F53 + \u7701\u7565\uFF0C\u4E0D\u628A\u6574\u884C\u6491\u53D8\u5F62 */
      .mov-mono { font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace; font-size: 12.5px; }
      /* \u5F00\u5173\u505A\u6210\u8DDF\u8F93\u5165\u6846\u540C\u9AD8\u7684\u5C0F\u65B9\u5757\uFF0C\u548C\u5468\u56F4\u63A7\u4EF6\u4E00\u6761\u7EBF */
      .mov-switch { display: flex; align-items: center; gap: 8px; padding: 0 10px; height: 36px; box-sizing: border-box; border: 1px solid ${TOKENS.border}; border-radius: 8px; background: ${TOKENS.controlFill}; font-size: 13px; color: ${TOKENS.text}; cursor: pointer; }
      .mov-switch:hover { border-color: ${TOKENS.primaryFill}; }
      .mov-switch input { width: 15px; height: 15px; accent-color: ${TOKENS.primaryFill}; cursor: pointer; }
      .mov-card { display: flex; flex-direction: column; gap: 10px; padding: 14px 16px; border-radius: 12px; border: 1px solid ${TOKENS.border}; background: ${TOKENS.cardFill}; }
      .mov-current-version { display: inline-flex; align-items: center; gap: 6px; flex: 1 1 120px; }
      .mov-update-bell { display: inline-flex; flex: 0 0 auto; color: ${TOKENS.primaryFill}; transform-origin: 50% 10%; animation: mov-bell-swing 1.6s ease-in-out infinite; }
      @keyframes mov-bell-swing { 0%, 60%, 100% { transform: rotate(0deg); } 10%, 30% { transform: rotate(-18deg); } 20%, 40% { transform: rotate(18deg); } 50% { transform: rotate(-8deg); } }
      @media (prefers-reduced-motion: reduce) { .mov-update-bell { animation: none; } }
      .mov-card-head { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
      .mov-card-title { font-size: 13px; font-weight: 600; color: ${TOKENS.text}; }
      .mov-hint { font-size: 12px; color: ${TOKENS.muted}; line-height: 1.5; }
      .mov-btn { display: inline-flex; align-items: center; justify-content: center; gap: 6px; box-sizing: border-box; flex: 0 0 120px; width: 120px; min-width: 120px; height: 36px; min-height: 36px; padding: 4px 10px; border-radius: 8px; border: 1px solid ${TOKENS.border}; background: transparent; color: ${TOKENS.text}; font: inherit; font-size: 12px; line-height: 1.2; text-align: center; cursor: pointer; white-space: normal; overflow-wrap: anywhere; transition: background .15s, border-color .15s, color .15s, opacity .15s; }
      .mov-btn:hover:not(:disabled) { border-color: ${TOKENS.primaryFill}; color: ${TOKENS.primaryFill}; }
      .mov-btn:disabled { opacity: .5; cursor: default; }
      .mov-btn-primary { border-color: ${TOKENS.primaryFill}; background: ${TOKENS.primaryFill}; color: #fff; font-weight: 600; }
      .mov-btn-primary:hover:not(:disabled) { color: #fff; opacity: .88; }
      .mov-quota-actions { display: flex; gap: 8px; flex: 0 0 auto; }
      .mov-support-dialog { width: min(420px, calc(100vw - 32px)); max-height: calc(100vh - 32px); padding: 0; border: 1px solid ${TOKENS.border}; border-radius: 12px; color: ${TOKENS.text}; background: ${TOKENS.cardFill}; overflow: auto; }
      .mov-support-dialog::backdrop { background: rgba(0, 0, 0, .45); }
      .mov-support-content { padding: 16px; display: flex; flex-direction: column; gap: 12px; }
      .mov-support-content p { margin: 0; }
      .mov-support-frame { width: 100%; height: min(480px, 62vh); border: 0; border-radius: 8px; background: white; }
      .mov-trailing { margin-left: auto; }
      /* \u989D\u5EA6\uFF1A\u4E09\u4E2A\u6570\u5B57\u5757\uFF0C\u4E00\u773C\u5206\u6E05\u5269\u4F59 / \u5DF2\u7528 / \u603B\u989D\u5EA6 */
      .mov-quota-compact { padding: 8px 12px; gap: 14px; flex-direction: row; align-items: center; flex-wrap: nowrap; overflow-x: auto; }
      .mov-quota-compact .mov-card-head { min-height: 24px; flex: 0 0 auto; gap: 8px; }
      .mov-quota-compact .mov-stats { display: flex; flex: 1 0 auto; gap: 16px; }
      .mov-quota-compact .mov-stat { flex-direction: row; align-items: baseline; justify-content: space-between; gap: 6px; padding: 0; border: 0; border-radius: 0; white-space: nowrap; }
      .mov-quota-compact .mov-stat-label { font-size: 11px; white-space: nowrap; }
      .mov-quota-compact .mov-stat-value { font-size: 14px; }
      .mov-quota-compact .mov-foot-note { font-size: 10px; white-space: nowrap; flex: 0 0 auto; }
      .mov-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 10px; }
      .mov-stat { display: flex; flex-direction: column; gap: 4px; padding: 10px 12px; border-radius: 10px; border: 1px solid ${TOKENS.border}; }
      .mov-stat-label { font-size: 11.5px; color: ${TOKENS.muted}; }
      .mov-stat-value { font-size: 16px; font-weight: 600; font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
      .mov-foot-note { font-size: 11.5px; color: ${TOKENS.muted}; }
      /* ffmpeg \u5B89\u88C5\u547D\u4EE4\uFF1A\u4E00\u884C\u7B49\u5BBD\u3001\u53EF\u590D\u5236\uFF0C\u4E0D\u7528\u6491\u6EE1\u6574\u884C */
      .mov-cmd-row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
      .mov-tag { flex: 0 0 auto; min-width: 132px; font-size: 12px; color: ${TOKENS.muted}; }
      .mov-code { flex: 0 0 auto; max-width: 100%; padding: 6px 10px; border-radius: 8px; border: 1px solid ${TOKENS.border}; background: ${TOKENS.controlFill}; font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace; font-size: 12px; white-space: pre-wrap; word-break: break-all; }
      /* \u4F7F\u7528\u8BB0\u5F55\uFF1A\u6591\u9A6C\u7EB9 + \u7EC6\u8868\u5934\uFF0C\u6A21\u578B\u5217\u5403\u6389\u5269\u4F59\u5BBD\u5EA6 */
      /* \u9762\u677F\u5F88\u7A84\u65F6\u8868\u683C\u6A2A\u5411\u6EDA\u52A8\uFF0C\u4E5F\u4E0D\u628A\u300C\u65F6\u95F4\u300D\u6324\u6210\u4E24\u884C */
      .mov-table { display: flex; flex-direction: column; margin: 0 -6px; overflow-x: auto; }
      .mov-table-head, .mov-table-row { display: grid; grid-template-columns: 106px 78px minmax(72px, 1fr) 84px 60px; align-items: center; gap: 10px; padding: 8px 10px; }
      .mov-table-head > :nth-child(1), .mov-table-row > :nth-child(1) { white-space: nowrap; }
      .mov-table-head { font-size: 11px; letter-spacing: .03em; color: ${TOKENS.muted}; border-bottom: 1px solid ${TOKENS.border}; }
      .mov-table-row { font-size: 12.5px; border-radius: 8px; }
      .mov-table-row:nth-child(even) { background: rgba(127, 127, 127, .05); }
      .mov-table-row:hover { background: rgba(127, 127, 127, .1); }
      /* \u8D39\u7528\u4E0E\u7ED3\u679C\u4E24\u5217\u53F3\u5BF9\u9F50\uFF0C\u6570\u5B57\u7AD6\u7740\u5BF9\u5F97\u9F50 */
      .mov-table-head > :nth-child(4), .mov-table-row > :nth-child(4),
      .mov-table-head > :nth-child(5), .mov-table-row > :nth-child(5) { text-align: right; }
      .mov-model { min-width: 0; overflow: hidden; color: ${TOKENS.muted}; white-space: nowrap; text-overflow: ellipsis; font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace; }
      .mov-num { font-variant-numeric: tabular-nums; }
      /* \u7ED3\u679C\u7528\u80F6\u56CA\u6807\u7B7E\uFF0C\u6BD4\u88F8\u6587\u5B57\u66F4\u5BB9\u6613\u4E00\u773C\u626B\u5230 */
      .mov-chip { display: inline-flex; align-items: center; justify-content: center; padding: 1px 8px; border-radius: 999px; font-size: 11.5px; line-height: 1.7; }
      .mov-chip-ok { color: ${TOKENS.success}; background: rgba(46, 158, 91, .12); }
      .mov-chip-bad { color: ${TOKENS.error}; background: rgba(217, 83, 79, .12); }
      /* \u6CE8\u518C\u8868\u5355\uFF1A\u8F93\u5165\u6846\u5403\u6389\u591A\u4F59\u5BBD\u5EA6\uFF0C\u4E24\u4E2A\u6309\u94AE\u4E0D\u6362\u884C */
      .mov-register-form { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
      /* \u5E95\u90E8\u64CD\u4F5C\u6761\uFF1A\u4E0A\u8FB9\u7EBF\u628A\u300C\u4FDD\u5B58\u300D\u548C\u914D\u7F6E\u5185\u5BB9\u5206\u5F00 */
      .mov-footer { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; padding: 12px 2px 2px; border-top: 1px solid ${TOKENS.border}; }
      .mov-notice { margin: 0; font-size: 12px; color: ${TOKENS.muted}; line-height: 1.5; }
    `;
    return { TOKENS, inputStyle, PAGE_CSS };
  }

  // src/client/progress.ts
  function createVideoProgress({ React, h, TOKENS }) {
    function estimatedVideoWait(duration) {
      const seconds = Number(duration);
      return Number.isFinite(seconds) && seconds > 0 ? 105 + seconds * 3 : 180;
    }
    function estimatedVideoProgress(elapsed, succeeded, duration) {
      if (succeeded) return 100;
      const seconds = Math.max(0, Number(elapsed) || 0);
      return Math.min(99, Math.max(1, Math.floor(seconds / estimatedVideoWait(duration) * 100)));
    }
    function VideoTaskProgress({ block = {}, toolName = "video_generate", callId, useVideoExecutions, startedAt }) {
      const done = "kind" in block;
      const executions = useVideoExecutions?.((snapshot) => snapshot);
      const beganAt = startedAt ?? executions?.get(callId);
      const [elapsed, setElapsed] = React.useState(0);
      React.useEffect(() => {
        if (done || beganAt === void 0) return;
        const tick = () => setElapsed(Math.max(0, Math.floor((Date.now() - beganAt) / 1e3)));
        tick();
        const timer = window.setInterval(tick, 1e3);
        return () => window.clearInterval(timer);
      }, [done, callId, beganAt]);
      if (!done && (block.phase !== "start" || beganAt === void 0)) return null;
      const failed = Boolean(block.isError || block.error);
      const status = done ? failed ? "\u6267\u884C\u5931\u8D25\u6216\u5DF2\u505C\u6B62" : "\u672C\u6B21\u4EFB\u52A1\u5DF2\u8FD4\u56DE" : block.phase === "preparing" ? "\u51C6\u5907\u53C2\u6570 / \u7B49\u5F85\u6388\u6743" : "\u6B63\u5728\u6267\u884C \xB7 \u7B49\u5F85\u751F\u6210\u7ED3\u679C";
      const output = Array.isArray(block.content) ? block.content.filter((part) => part.type === "text").map((part) => part.text).join("\n") : "";
      const succeeded = done && !failed && /视频生成成功|视频延长成功|已生成并交付|已延长并交付|succeeded/.test(output);
      const duration = block.args?.duration;
      const estimatedWait = estimatedVideoWait(duration);
      const progress = estimatedVideoProgress(elapsed, succeeded, duration);
      const waitingDots = ".".repeat(elapsed % 3 + 1);
      const title = toolName === "video_extend" ? "\u89C6\u9891\u7EED\u62CD" : toolName === "video_status" ? "\u67E5\u8BE2\u89C6\u9891\u72B6\u6001" : "\u89C6\u9891\u751F\u6210";
      return h("div", { className: "mov-task", "data-field": "video-task-progress" }, [
        h("style", { key: "style" }, `
          @keyframes mov-task-spin { to { transform: rotate(360deg); } }
          @keyframes mov-task-flow { from { background-position:0 0; } to { background-position:32px 0; } }
          @keyframes mov-task-shimmer { from { transform:translateX(-120%); } to { transform:translateX(420%); } }
          @keyframes mov-task-pulse { 0%,100% { opacity:.45; } 50% { opacity:1; } }
          .mov-task { box-sizing:border-box; min-width:0; width:100%; border:1px solid ${TOKENS.border}; border-radius:10px; padding:10px 12px; color:${TOKENS.text}; margin:6px 0; overflow-wrap:anywhere; }
          .mov-task-head { display:flex; align-items:center; gap:10px; flex-wrap:wrap; font-size:13px; }
          .mov-task-spinner { width:14px; height:14px; border:2px solid ${TOKENS.border}; border-top-color:${TOKENS.primaryFill}; border-radius:50%; animation:mov-task-spin .9s linear infinite; }
          .mov-task-note { font-size:12px; color:${TOKENS.muted}; margin-top:8px; }
          .mov-task-track { height:5px; border-radius:999px; overflow:hidden; background:${TOKENS.border}; margin-top:10px; }
          .mov-task-fill { height:100%; border-radius:999px; background:${TOKENS.primaryFill}; transition:width 1s ease; position:relative; overflow:hidden; }
          .mov-task-active .mov-task-fill { background-image:repeating-linear-gradient(110deg,transparent 0px,transparent 12px,rgba(255,255,255,.22) 12px,rgba(255,255,255,.22) 22px,transparent 22px,transparent 32px); background-size:32px 100%; animation:mov-task-flow 1s linear infinite; }
          .mov-task-active .mov-task-fill::after { content:''; position:absolute; inset:0; width:30%; background:linear-gradient(90deg,transparent,rgba(255,255,255,.6),transparent); animation:mov-task-shimmer 2s linear infinite; }
          .mov-task-live { display:inline-block; width:6px; height:6px; border-radius:50%; background:${TOKENS.primaryFill}; margin-right:6px; animation:mov-task-pulse 1.4s ease-in-out infinite; }
          .mov-task-dots { display:inline-block; width:18px; text-align:left; }
          .mov-task-output { white-space:pre-wrap; overflow-wrap:anywhere; font-size:12px; max-height:320px; overflow:auto; }
          @media(prefers-reduced-motion:reduce) { .mov-task-spinner, .mov-task-live, .mov-task-active .mov-task-fill, .mov-task-active .mov-task-fill::after { animation:none; } }
        `),
        h("div", { key: "head", className: "mov-task-head" }, [
          !done ? h("span", { key: "spinner", className: "mov-task-spinner", "aria-hidden": true }) : null,
          h("strong", { key: "title" }, title),
          h("span", { key: "status", role: "status" }, [status, !done ? h("span", { key: "dots", className: "mov-task-dots", "aria-hidden": true }, waitingDots) : null]),
          !done ? h(
            "span",
            { key: "elapsed", style: { marginLeft: "auto", fontVariantNumeric: "tabular-nums" } },
            `\u5DF2\u7B49\u5F85 ${Math.floor(elapsed / 60)}\u5206${String(elapsed % 60).padStart(2, "0")}\u79D2`
          ) : null
        ]),
        h(
          "div",
          { key: "progress", className: `mov-task-track${!done ? " mov-task-active" : ""}`, role: "progressbar", "aria-label": "\u4F30\u7B97\u8FDB\u5EA6", "aria-valuemin": 0, "aria-valuemax": 100, "aria-valuenow": progress },
          h("div", { className: "mov-task-fill", style: { width: `${progress}%`, background: failed ? TOKENS.error : void 0 } })
        ),
        h("div", { key: "percent", className: "mov-task-note" }, `${progress}%${succeeded ? " \xB7 \u672C\u6B21\u751F\u6210\u5B8C\u6210" : " \xB7 \u4F30\u7B97\u8FDB\u5EA6"}${failed ? " \xB7 \u6267\u884C\u5931\u8D25\u6216\u5DF2\u505C\u6B62" : ""}`),
        !done ? h(
          "div",
          { key: "note", className: "mov-task-note" },
          [
            h("span", { key: "live", className: "mov-task-live", "aria-hidden": true }),
            `${duration ? `\u76EE\u6807 ${duration} \u79D2 \xB7 \u9884\u8BA1\u7B49\u5F85\u7EA6 ${Math.round(estimatedWait)} \u79D2 \xB7 ` : ""}${progress >= 99 ? "\u4EFB\u52A1\u4ECD\u5728\u7B49\u5F85\u7ED3\u679C\uFF0C\u8FDB\u5EA6\u505C\u572899%\u4E0D\u8868\u793A\u5931\u8D25\u3002" : "\u4EFB\u52A1\u5904\u7406\u4E2D\uFF0C\u5B8C\u6210\u540E\u81EA\u52A8\u663E\u793A\u7ED3\u679C\u3002"}\u8BF7\u52FF\u91CD\u590D\u63D0\u4EA4\u3002`
          ]
        ) : null,
        done && output ? h("details", { key: "output", open: failed }, [
          h("summary", { key: "toggle", className: "mov-task-note" }, failed ? "\u67E5\u770B\u9519\u8BEF\u8BE6\u60C5" : "\u67E5\u770B\u89C6\u9891\u7ED3\u679C\u4E0E\u6587\u4EF6\u8DEF\u5F84"),
          h("pre", { key: "text", className: "mov-task-output" }, output)
        ]) : null
      ]);
    }
    function activeVideoCalls(chat) {
      const calls = [];
      const seen = /* @__PURE__ */ new Set();
      function visit(block) {
        if (!block) return;
        const done = "kind" in block;
        const name = done ? block.call?.name : block.name;
        if (!done && ["video_generate", "video_extend", "video_status"].includes(name) && !seen.has(block.callId)) {
          seen.add(block.callId);
          calls.push({ block, toolName: name, callId: block.callId });
        }
        for (const child of block.subCalls || []) visit(child);
      }
      const nodes = chat?.nodes?.values?.() ?? (chat?.order || []).map((key) => chat.nodes?.get(key));
      for (const node of nodes) {
        if (node?.kind === "tool-call") visit(node.data?.root);
      }
      return calls;
    }
    function videoExecutionSource(eventSource) {
      let previous;
      let snapshot = /* @__PURE__ */ new Map();
      return {
        subscribe: (listener) => eventSource.subscribe(listener),
        getSnapshot() {
          const window2 = eventSource.getSnapshot();
          if (window2 === previous) return snapshot;
          const next = /* @__PURE__ */ new Map();
          for (const { event } of window2.entries) {
            if (event.type === "plugin:metaontic-video/execution") {
              const { callId, phase } = event.data || {};
              if (typeof callId !== "string") continue;
              if (phase === "start") next.set(callId, event.time);
              else if (phase === "end") next.delete(callId);
            } else if (event.type === "turn/end") next.clear();
          }
          previous = window2;
          if (next.size !== snapshot.size || [...next].some(([id, time]) => snapshot.get(id) !== time)) snapshot = next;
          return snapshot;
        }
      };
    }
    function VideoProgressDock({ useChat, useVideoExecutions }) {
      const chat = useChat((snapshot) => snapshot);
      const executions = useVideoExecutions?.((snapshot) => snapshot);
      const calls = activeVideoCalls(chat).filter((call) => call.block.phase === "start" && executions?.has(call.callId));
      if (!calls.length) return null;
      return h(
        "div",
        {
          "data-field": "video-progress-dock",
          "aria-live": "polite",
          style: {
            boxSizing: "border-box",
            width: "calc(100% - var(--dsh-composer-side-clearance, 0px) - var(--dsh-composer-side-clearance, 0px))",
            maxWidth: "var(--dsh-composer-card-max-width, 100%)",
            minWidth: 0,
            margin: "0 auto",
            flex: "none"
          }
        },
        calls.map((call) => h(VideoTaskProgress, { ...call, startedAt: executions.get(call.callId), key: call.callId }))
      );
    }
    return { videoExecutionSource, VideoTaskProgress, VideoProgressDock };
  }

  // src/client/config.ts
  function createClientConfig() {
    const NAMESPACE = "metaontic-video";
    const NS = "settings.metaonticVideo";
    const MODEL_OPTIONS = [
      "doubao-seedance-2-0-mini-260615",
      "doubao-seedance-2-0-fast-260128"
    ];
    const SELECTS = {
      connectionMode: ["service", "metaontic", "volcengine"],
      model: MODEL_OPTIONS,
      imageModel: ["doubao-seedream-5-0-260128", "doubao-seedream-5-0-pro-260628"],
      ratio: ["16:9", "9:16", "4:3", "3:4", "1:1", "adaptive"],
      mergeMode: ["copy", "reencode"]
    };
    const SECTIONS = [
      { key: "sectionConnection", fields: ["connectionMode"] },
      { key: "sectionModels", fields: ["imageUseVideoKey", "model", "metaonticApiKey", "volcengineApiKey", "imageModel", "imageApiKey"] },
      { key: "sectionVideo", fields: ["ratio", "generateAudio"] }
    ];
    const FIELDS = [
      { key: "connectionMode", kind: "select", wide: true },
      { key: "apiKey", kind: "text", secret: true, wide: true },
      { key: "metaonticApiKey", kind: "text", secret: true, wide: true },
      { key: "volcengineApiKey", kind: "text", secret: true, wide: true },
      // 模型用下拉选（候选见 MODEL_OPTIONS），占一整行显示完整型号
      { key: "model", kind: "select", wide: true },
      { key: "imageModel", kind: "select", wide: true },
      { key: "imageUseVideoKey", kind: "switch", wide: true },
      { key: "imageApiKey", kind: "text", secret: true, wide: true },
      { key: "ratio", kind: "select" },
      { key: "generateAudio", kind: "switch" },
      { key: "watermark", kind: "switch" },
      { key: "seamTrimSeconds", kind: "text" },
      { key: "mergeMode", kind: "select", wide: true },
      { key: "pollIntervalMs", kind: "number" },
      { key: "maxWaitMs", kind: "number" },
      { key: "ffmpegBinary", kind: "text", mono: true },
      { key: "ffprobeBinary", kind: "text", mono: true }
    ];
    const FIELD_BY_KEY = Object.fromEntries(FIELDS.map((field) => [field.key, field]));
    const DEFAULT_REGISTER_API = "https://video.mybfs.cn";
    const LOGGED_OUT_KEY = "metaontic-video.logged-out";
    const PLUGIN_OWNED_KEYS = [
      "connectionMode",
      "metaonticApiKey",
      "volcengineApiKey",
      "apiKey",
      "keyOrigin",
      "baseUrl",
      "registerEmail",
      "deviceId",
      "deviceSecret",
      "model",
      "imageModel",
      "imageUseVideoKey",
      "imageApiKey"
    ];
    const DEFAULT_REGISTER_TOKEN = "metaontic-video-register-v1";
    function currentOs() {
      const nav = window.navigator || {};
      const raw = String(
        nav.userAgentData?.platform || nav.platform || nav.userAgent || ""
      ).toLowerCase();
      if (/mac|darwin|iphone|ipad/.test(raw)) return "macos";
      if (/win/.test(raw)) return "windows";
      return "linux";
    }
    const FFMPEG_INSTALLS = {
      macos: { label: "macOS\uFF08Homebrew\uFF09", command: "brew install ffmpeg" },
      windows: { label: "Windows\uFF08winget\uFF09", command: "winget install --id Gyan.FFmpeg -e" },
      linux: { label: "Linux\uFF08Debian / Ubuntu\uFF09", command: "sudo apt update && sudo apt install -y ffmpeg" }
    };
    const FFMPEG_ALL = [
      { os: "macos", label: "macOS\uFF08Homebrew\uFF09", command: "brew install ffmpeg" },
      {
        os: "macos",
        label: "macOS\uFF08\u8FD8\u6CA1\u88C5 Homebrew\uFF09",
        command: '/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"'
      },
      { os: "windows", label: "Windows\uFF08winget\uFF09", command: "winget install --id Gyan.FFmpeg -e" },
      { os: "windows", label: "Windows\uFF08Chocolatey\uFF09", command: "choco install ffmpeg" },
      { os: "linux", label: "Linux\uFF08Debian / Ubuntu\uFF09", command: "sudo apt update && sudo apt install -y ffmpeg" },
      { os: "linux", label: "Linux\uFF08Fedora / RHEL / CentOS\uFF09", command: "sudo dnf install -y ffmpeg" }
    ];
    function formatMoney(value) {
      const number = Number(value);
      if (!Number.isFinite(number)) return "0";
      const text = number.toFixed(Math.abs(number) >= 1 ? 2 : 4);
      return text.includes(".") ? text.replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "") : text;
    }
    function optionLabel(t, key, option) {
      if (key === "connectionMode") return t(option);
      if (key === "mergeMode") {
        if (option === "reencode") return t("mergeModeReencode");
        return option === "copy" ? t("mergeModeCopy") : t("mergeModeSeamless");
      }
      return option;
    }
    return { PLUGIN_OWNED_KEYS, DEFAULT_REGISTER_API, LOGGED_OUT_KEY, DEFAULT_REGISTER_TOKEN, SELECTS, optionLabel, FIELD_BY_KEY, SECTIONS, formatMoney, NS, NAMESPACE };
  }

  // src/client/locale.ts
  function createDictionaries() {
    const zh = {
      summaryEmpty: "\u8BF7\u9009\u62E9\u63A5\u5165\u65B9\u5F0F\uFF0C\u767B\u5F55\u6216\u586B\u5199 API Key \u540E\u4FDD\u5B58\u3002",
      summary: "{provider} \xB7 {model}",
      apiKeyConfigured: "\u5DF2\u914D\u7F6E\uFF0C\u7559\u7A7A\u4FDD\u7559\u73B0\u6709\u5BC6\u94A5",
      connectionMode: "\u63A5\u5165\u65B9\u5F0F",
      connectionModeHint: "\u90AE\u7BB1\u767B\u5F55\u9886\u53D6\u5BC6\u94A5\uFF0C\u6216\u4F7F\u7528\u81EA\u5DF1\u7684 MetaOntic AI\u3001\u706B\u5C71\u5F15\u64CE\u5BC6\u94A5\u3002\u5207\u6362\u540E\u4FDD\u5B58\u751F\u6548\u3002",
      connectionMetaonticHint: "\u4F7F\u7528 MetaOntic AI \u7684 API Key\uFF0C\u586B\u5199\u540E\u4FDD\u5B58\u751F\u6548\u3002",
      connectionMetaonticRegister: "\u6CE8\u518C\u83B7\u53D6 Key",
      volcengineKeyHint: "\u586B\u5199\u706B\u5C71\u65B9\u821F\u63A7\u5236\u53F0\u7684 API Key \u540E\u4FDD\u5B58\uFF0C\u8D39\u7528\u7531\u706B\u5C71\u5F15\u64CE\u8D26\u6237\u627F\u62C5\u3002\u9700\u8981\u81EA\u884C\u6838\u5BF9\u597D Key \u7684\u6A21\u578B\u80FD\u529B\u3002",
      metaontic: "B \xB7 MetaOntic AI",
      metaonticApiKey: "MetaOntic AI API Key",
      showKey: "\u663E\u793A\u5BC6\u94A5",
      hideKey: "\u9690\u85CF\u5BC6\u94A5",
      metaonticKeyHint: "\u586B\u5199 API Key \u540E\u4FDD\u5B58\uFF0C\u65E0\u9700\u90AE\u7BB1\u767B\u5F55\u3002\u6309\u5B9E\u9645\u8C03\u7528\u8BA1\u8D39\uFF0C\u8D39\u7528\u4E0E\u7528\u91CF\u8BF7\u5728\u6E20\u9053\u5E73\u53F0\u67E5\u770B\u3002",
      volcengineApiKey: "\u706B\u5C71\u5F15\u64CE API Key",
      service: "A \xB7 MetaOnticVideo",
      volcengine: "C \xB7 \u706B\u5C71\u5F15\u64CE\u76F4\u8FDE",
      seamTrimSeconds: "\u63A5\u7F1D\u88C1\u526A\u79D2\u6570\uFF08\u5982 0.5,0\uFF09",
      modelHiddenCurrent: "\u5F53\u524D\u6A21\u578B\uFF08\u6682\u4E0D\u63D0\u4F9B\u9009\u62E9\uFF09",
      releaseNotesTitle: "\u66F4\u65B0\u5185\u5BB9",
      releaseUpdatedAt: "{time}",
      resetConfirm: "\u786E\u5B9A\u91CD\u7F6E\u63D2\u4EF6\u5417\uFF1F\u8FD9\u4F1A\u6E05\u9664\u672C\u63D2\u4EF6\u4FDD\u5B58\u7684\u914D\u7F6E\u3001API Key \u548C\u767B\u5F55\u72B6\u6001\uFF0C\u9700\u8981\u91CD\u65B0\u914D\u7F6E\u3002\u5DF2\u751F\u6210\u7684\u89C6\u9891\u4E0D\u4F1A\u5220\u9664\u3002",
      model: "\u89C6\u9891\u6A21\u578B",
      imageModel: "\u56FE\u7247\u6A21\u578B",
      imageUseVideoKey: "\u56FE\u7247\u6A21\u578B\u4E0E\u89C6\u9891\u6A21\u578B\u5171\u7528 Key",
      sharedModelKey: "\u5171\u7528 Key",
      serviceKeyConfigured: "\u5DF2\u914D\u7F6E\uFF08\u767B\u5F55\u4E0B\u53D1\uFF09",
      serviceKeyMissing: "\u8BF7\u5148\u767B\u5F55\u83B7\u53D6 Key",
      videoModelKey: "\u89C6\u9891\u6A21\u578B Key",
      imageApiKey: "\u56FE\u7247\u6A21\u578B Key",
      resolution: "\u89C6\u9891\u6E05\u6670\u5EA6",
      imageModelHint: "\u771F\u4EBA\u53C2\u8003\u56FE\u5148\u7528 Seedream \u8F6C\u4E3A\u975E\u771F\u4EBA\u98CE\u683C\uFF0C\u56FE\u7247\u8C03\u7528\u53E6\u884C\u8BA1\u8D39\u3002",
      modelHint: "mini \u4FA7\u91CD\u6210\u672C\uFF0Cfast \u4FA7\u91CD\u751F\u6210\u901F\u5EA6\u3002\u5B9E\u9645\u4EF7\u683C\u4EE5\u6240\u9009\u6E20\u9053\u4E3A\u51C6\u3002",
      mergeMode: "\u5408\u5E76\u65B9\u5F0F",
      mergeModeSeamless: "\u76F4\u63A5\u62FC\u63A5\uFF08\u65E7\u914D\u7F6E\u517C\u5BB9\uFF09",
      mergeModeCopy: "\u65E0\u635F\u62FC\u63A5",
      mergeModeReencode: "\u91CD\u7F16\u7801\u62FC\u63A5",
      ffmpegBinary: "ffmpeg \u8DEF\u5F84",
      ffprobeBinary: "ffprobe \u8DEF\u5F84",
      ffmpegTitle: "\u957F\u89C6\u9891\u5408\u5E76\u9700\u8981 ffmpeg",
      ffmpegBody: "\u89C6\u9891\u8D85\u8FC7\u6A21\u578B\u5355\u6B21\u4E0A\u9650\uFF082.0 \u4E3A 15 \u79D2\u30012.5 \u4E3A 30 \u79D2\uFF09\u65F6\u4F1A\u62C6\u6210\u51E0\u6BB5\u5206\u522B\u751F\u6210\u3001\u518D\u5728\u672C\u673A\u5408\u5E76\u6210\u4E00\u6761\u2014\u2014\u5408\u5E76\u8FD9\u4E00\u6B65\u7528\u7684\u662F ffmpeg\u3002\u6CA1\u88C5\u4E5F\u80FD\u751F\u6210\uFF0C\u53EA\u662F\u53EA\u7ED9\u5206\u6BB5\u5217\u8868\u3001\u4E0D\u5408\u6210\u6574\u6761\u3002",
      ffmpegInstallFor: "\u6309\u4F60\u7684\u7CFB\u7EDF\u88C5\u4E00\u4E0B\uFF08\u70B9\u53F3\u8FB9\u6309\u94AE\u590D\u5236\u547D\u4EE4\uFF09\uFF1A",
      ffmpegCopy: "\u590D\u5236",
      ffmpegCopied: "\u5DF2\u590D\u5236",
      ffmpegMore: "\u5176\u4ED6\u7CFB\u7EDF",
      ffmpegLess: "\u6536\u8D77\u5176\u4ED6\u7CFB\u7EDF",
      ffmpegAfter: "\u4E0D\u60F3\u81EA\u5DF1\u6572\u547D\u4EE4\u7684\u8BDD\uFF0C\u76F4\u63A5\u5728\u5BF9\u8BDD\u91CC\u8BF4\u300C\u5E2E\u6211\u88C5 ffmpeg\u300D\u2014\u2014\u63D2\u4EF6\u4F1A\u6267\u884C\u5B89\u88C5\uFF08\u547D\u4EE4\u4F1A\u5148\u8BA9\u4F60\u786E\u8BA4\uFF09\uFF1B\u88C5\u597D\u540E\u91CD\u8DD1\u4E00\u6B21\u5C31\u4F1A\u81EA\u52A8\u5408\u5E76\uFF08\u4E0D\u7528\u91CD\u65B0\u751F\u6210\uFF09\u3002ffmpeg \u88C5\u5728\u975E\u9ED8\u8BA4\u4F4D\u7F6E\u7684\u8BDD\uFF0C\u628A\u7EDD\u5BF9\u8DEF\u5F84\u586B\u5230\u4E0A\u9762\u7684\u300Cffmpeg \u8DEF\u5F84\u300D\u4E5F\u4E00\u6837\u7BA1\u7528\u3002\u5B89\u88C5\u5305\u81EA\u5E26 ffprobe\uFF0C\u5206\u6BB5\u65F6\u957F\u63A2\u6D4B\u4F1A\u4E00\u8D77\u89E3\u51B3\u3002",
      ffmpegManual: "\u60F3\u81EA\u5DF1\u88C5\uFF1AmacOS \u7528 Homebrew\uFF0CWindows \u7528 winget\uFF0CLinux \u7528\u7CFB\u7EDF\u5305\u7BA1\u7406\u5668\uFF1B\u88C5\u5B8C\u786E\u8BA4\u547D\u4EE4\u884C\u91CC\u80FD\u8DD1 ffmpeg -version \u5C31\u884C\u3002",
      registerEmail: "\u90AE\u7BB1",
      registerTitle: "\u90AE\u7BB1\u767B\u5F55",
      registerHint: "\u4F7F\u7528\u90AE\u7BB1\u9A8C\u8BC1\u7801\u767B\u5F55\uFF0C\u9996\u6B21\u767B\u5F55\u81EA\u52A8\u6CE8\u518C\u5E76\u9886\u53D6\u5BC6\u94A5\u3002",
      registerEmailPlaceholder: "\u4F60\u7684\u90AE\u7BB1\uFF0C\u4F8B\u5982 name@example.com",
      registerCode: "\u9A8C\u8BC1\u7801",
      registerCodePlaceholder: "\u9A8C\u8BC1\u7801",
      registerCodeSend: "\u83B7\u53D6\u9A8C\u8BC1\u7801",
      registerCodeSending: "\u53D1\u9001\u4E2D\u2026",
      registerCodeCooldown: "{seconds} \u79D2\u540E\u91CD\u53D1",
      registerCodeSent: "\u9A8C\u8BC1\u7801\u5DF2\u53D1\u9001\u81F3 {email}\uFF0C5 \u5206\u949F\u5185\u6709\u6548\u3002",
      registerEmailLocked: "\u5012\u8BA1\u65F6\u7ED3\u675F\u540E\u53EF\u4FEE\u6539\u90AE\u7BB1\u3002",
      registerNeedEmail: "\u8BF7\u5148\u586B\u5199\u90AE\u7BB1\uFF0C\u518D\u83B7\u53D6\u9A8C\u8BC1\u7801\u3002",
      registerNeedCode: "\u8BF7\u8F93\u5165\u90AE\u4EF6\u4E2D\u7684\u9A8C\u8BC1\u7801\u3002",
      registerRestored: "\u5DF2\u6062\u590D\u672C\u673A\u5BC6\u94A5\u5E76\u4FDD\u5B58\u8FDE\u63A5\u914D\u7F6E\u3002",
      quotaTitle: "\u989D\u5EA6",
      quotaRemain: "\u5269\u4F59",
      quotaUsed: "\u5DF2\u7528",
      quotaTotal: "\u603B\u989D\u5EA6",
      quotaUnlimited: "\u4E0D\u9650\u989D\u5EA6",
      quotaLoading: "\u8BFB\u53D6\u989D\u5EA6\u4E2D\u2026",
      quotaRefresh: "\u5237\u65B0\u989D\u5EA6",
      supportRecharge: "\u4EBA\u5DE5\u5145\u503C",
      supportClose: "\u5173\u95ED",
      supportScan: "\u8BF7\u7528\u5FAE\u4FE1\u626B\u63CF\u4E8C\u7EF4\u7801\uFF0C\u8054\u7CFB\u4EBA\u5DE5\u5145\u503C\u3002\u9875\u9762\u672A\u52A0\u8F7D\u65F6\u53EF\u70B9\u51FB\u4E0B\u65B9\u94FE\u63A5\u3002",
      supportOpenPage: "\u6253\u5F00\u5BA2\u670D\u9875\u9762",
      quotaNoKey: "\u767B\u5F55\u540E\u53EF\u67E5\u770B\u5269\u4F59\u989D\u5EA6\u4E0E\u5DF2\u7528\u989D\u5EA6\u3002",
      quotaNotRegistered: "\u672A\u627E\u5230\u672C\u673A\u7684\u767B\u5F55\u8BB0\u5F55\uFF0C\u8BF7\u8054\u7CFB\u7BA1\u7406\u5458\u5904\u7406\u540E\u91CD\u65B0\u767B\u5F55\u3002",
      quotaFailed: "\u8BFB\u53D6\u989D\u5EA6\u5931\u8D25\uFF1A{message}",
      quotaUpdatedAt: "\u66F4\u65B0\u4E8E {time}",
      usageTitle: "\u4F7F\u7528\u8BB0\u5F55\uFF08\u6700\u8FD1 {days} \u5929\uFF09",
      usageSummary: "{count} \u6761 \xB7 \u8D39\u7528\u5408\u8BA1 {amount}",
      usageColTime: "\u65F6\u95F4",
      usageColKind: "\u7C7B\u578B",
      usageColModel: "\u6A21\u578B",
      usageColCost: "\u8D39\u7528",
      usageColStatus: "\u7ED3\u679C",
      usageEmpty: "\u6682\u65E0\u4F7F\u7528\u8BB0\u5F55\uFF0C\u751F\u6210\u6216\u7EED\u62CD\u89C6\u9891\u540E\u53EF\u5728\u6B64\u67E5\u770B\u3002",
      usageLoading: "\u8BFB\u53D6\u4F7F\u7528\u8BB0\u5F55\u4E2D\u2026",
      usageRefresh: "\u5237\u65B0\u8BB0\u5F55",
      usageFailed: "\u8BFB\u53D6\u4F7F\u7528\u8BB0\u5F55\u5931\u8D25\uFF1A{message}",
      usageMore: "\u4EC5\u663E\u793A\u6700\u8FD1 {count} \u6761\u8BB0\u5F55\u3002",
      usageKeyMissing: "\u767B\u5F55\u540E\u53EF\u67E5\u770B\u6B64\u5BC6\u94A5\u7684\u4F7F\u7528\u8BB0\u5F55\u3002",
      usageStatusOk: "\u6210\u529F",
      usageStatusFailed: "\u5931\u8D25",
      versionTitle: "\u63D2\u4EF6\u7248\u672C",
      versionCurrent: "\u5F53\u524D\u7248\u672C v{version}",
      versionCheck: "\u68C0\u67E5\u66F4\u65B0",
      versionChecking: "\u68C0\u67E5\u4E2D\u2026",
      versionLatest: "\u5DF2\u662F\u6700\u65B0\u7248\u672C",
      versionNew: "\u6709\u65B0\u7248\u672C v{version}",
      versionFailed: "\u68C0\u67E5\u66F4\u65B0\u5931\u8D25\uFF1A{message}",
      versionUpdate: "\u7ACB\u5373\u66F4\u65B0",
      versionOptional: "\u8FD9\u662F\u666E\u901A\u66F4\u65B0\uFF0C\u4F60\u53EF\u4EE5\u81EA\u884C\u51B3\u5B9A\u662F\u5426\u5347\u7EA7\u3002\u7A0D\u540E\u5904\u7406\u4E0D\u5F71\u54CD\u7EE7\u7EED\u4F7F\u7528\uFF0C\u63D2\u4EF6\u4E0D\u4F1A\u81EA\u52A8\u5B89\u88C5\u3002",
      versionLater: "\u7A0D\u540E\u518D\u8BF4",
      versionUpdateConfirm: "\u786E\u8BA4\u66F4\u65B0\u5230 v{version}",
      versionUpdateConfirmHint: "\u66F4\u65B0\u671F\u95F4\u8BBE\u7F6E\u9875\u53EF\u80FD\u77ED\u6682\u5173\u95ED\uFF0C\u73B0\u6709\u914D\u7F6E\u4E0E\u5BC6\u94A5\u4F1A\u4FDD\u7559\u3002",
      versionUpdating: "\u66F4\u65B0\u4E2D\u2026",
      versionUpdateDone: "\u5DF2\u66F4\u65B0\u5230 v{version}\uFF0C\u5DF2\u901A\u8FC7\u70ED\u52A0\u8F7D\u751F\u6548\uFF0C\u65E0\u9700\u91CD\u542F\u3002\u73B0\u6709\u5BF9\u8BDD\u4E0B\u4E00\u8F6E\u4F7F\u7528\u6700\u65B0\u63D2\u4EF6\u89C4\u5219\u3002",
      versionUpdatePending: "v{version} \u5DF2\u5B89\u88C5\uFF0C\u5F53\u524D\u914D\u7F6E\u5C1A\u672A\u542F\u7528\u65B0\u7248\uFF0C\u8BF7\u5728\u63D2\u4EF6\u9875\u68C0\u67E5\u542F\u7528\u72B6\u6001\u3002",
      versionUpdateRestart: "\u65B0\u7248\u672C v{version} \u5DF2\u88C5\u597D\uFF1A\u91CD\u542F Harness \u540E\u751F\u6548\u3002",
      versionUpdateCancelled: "\u66F4\u65B0\u5DF2\u53D6\u6D88\u3002",
      versionUpdateRetry: "\u66F4\u65B0\u672A\u5B8C\u6210\uFF0C\u6B63\u5728\u91CD\u8BD5\uFF08{attempt}/{total}\uFF09\u2026",
      versionUpdateFailed: "\u5728\u7EBF\u66F4\u65B0\u5931\u8D25\uFF1A{message}",
      versionUpdateRemoved: "\u63D2\u4EF6\u5DF2\u5378\u8F7D\uFF0C\u4F46\u91CD\u65B0\u5B89\u88C5\u5931\u8D25\u3002\u8BF7\u5230\u300C\u63D2\u4EF6\u300D\u9875\u91CD\u65B0\u6DFB\u52A0\u3002",
      versionUpdateRateLimited: "Gitee \u8BF7\u6C42\u8FC7\u4E8E\u9891\u7E41\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5\u3002\u73B0\u6709\u914D\u7F6E\u4E0E\u5BC6\u94A5\u4F1A\u4FDD\u7559\u3002",
      versionUpdateLockfile: "\u5B89\u88C5\u76EE\u5F55\u7684 pnpm-lock.yaml \u91CC\u6709\u4E00\u6761\u672C\u63D2\u4EF6\u7F3A\u5C11 integrity \u7684\u65E7\u8BB0\u5F55\uFF0Cpnpm \u56E0\u6B64\u62D2\u7EDD\u5B89\u88C5\uFF08ERR_PNPM_MISSING_TARBALL_INTEGRITY\uFF09\u3002\u63D2\u4EF6\u4F1A\u5728\u540E\u53F0\u81EA\u52A8\u6E05\u6389\u8FD9\u6761\u8BB0\u5F55\u5E76\u4FDD\u7559\u5907\u4EFD\uFF0C\u7A0D\u7B49\u5341\u51E0\u79D2\u518D\u70B9\u4E00\u6B21\u66F4\u65B0\uFF1B\u82E5\u4ECD\u7136\u5931\u8D25\uFF0C\u5B8C\u5168\u9000\u51FA Harness \u540E\u624B\u52A8\u5220\u9664\u63D2\u4EF6\u5B89\u88C5\u76EE\u5F55\u4E0B\u7684 pnpm-lock.yaml \u518D\u8BD5\u3002",
      versionUpdateUnavailable: "\u5F53\u524D Harness \u4E0D\u652F\u6301\u5728\u7EBF\u66F4\u65B0\uFF0C\u8BF7\u5230\u300C\u63D2\u4EF6\u300D\u9875\u5378\u8F7D\u540E\u91CD\u65B0\u6DFB\u52A0\u3002",
      versionHint: "\u53EF\u5728\u6B64\u68C0\u67E5\u5E76\u5B89\u88C5\u65B0\u7248\u672C\uFF0C\u73B0\u6709\u914D\u7F6E\u4E0E\u5BC6\u94A5\u4F1A\u4FDD\u7559\u3002",
      versionCheckedAt: "\u68C0\u67E5\u4E8E {time}",
      sectionGeneration: "\u751F\u6210\u53C2\u6570",
      sectionConnection: "\u63A5\u5165\u4E0E\u5BC6\u94A5",
      sectionVideo: "\u753B\u9762\u4E0E\u58F0\u97F3",
      sectionModels: "\u6A21\u578B\u914D\u7F6E",
      sectionCombined: "\u66F4\u591A\u8BBE\u7F6E",
      advancedPicture: "\u753B\u9762",
      advancedMerge: "\u89C6\u9891\u5408\u5E76",
      advancedWait: "\u67E5\u8BE2\u4E0E\u7B49\u5F85",
      advancedTools: "\u672C\u5730\u5DE5\u5177",
      sectionCombinedHint: "\u753B\u9762 \xB7 \u5408\u5E76 \xB7 \u7B49\u5F85 \xB7 \u672C\u5730\u5DE5\u5177",
      toolsHint: "\u901A\u5E38\u65E0\u9700\u586B\u5199\uFF1B\u5DF2\u5B89\u88C5\u4F46\u65E0\u6CD5\u81EA\u52A8\u8BC6\u522B\u65F6\uFF0C\u53EF\u6307\u5B9A\u53EF\u6267\u884C\u6587\u4EF6\u8DEF\u5F84\u3002",
      segmentsRetained: "\u6240\u6709\u539F\u59CB\u5206\u6BB5\u81EA\u52A8\u4FDD\u7559\uFF0C\u4FBF\u4E8E\u9884\u89C8\u3001\u7EED\u505A\u548C\u91CD\u65B0\u526A\u8F91\u3002",
      register: "\u767B\u5F55",
      registerWorking: "\u767B\u5F55\u4E2D\u2026",
      registerOk: "\u767B\u5F55\u6210\u529F\uFF0C\u5BC6\u94A5\u4E0E\u8FDE\u63A5\u914D\u7F6E\u5DF2\u4FDD\u5B58\u3002",
      registerPartial: "\u5DF2\u83B7\u53D6\u5BC6\u94A5\uFF0C\u4F46\u90E8\u5206\u8BBE\u7F6E\u4FDD\u5B58\u5931\u8D25\uFF0C\u8BF7\u68C0\u67E5\u540E\u91CD\u8BD5\u3002",
      registerFailed: "\u767B\u5F55\u5931\u8D25\uFF1A{message}",
      registerDisabled: "\u767B\u5F55\u670D\u52A1\u6682\u4E0D\u53EF\u7528\uFF1A{message}",
      registerNoKey: "\u767B\u5F55\u670D\u52A1\u672A\u8FD4\u56DE\u5BC6\u94A5\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5\u6216\u8054\u7CFB\u7BA1\u7406\u5458\u3002",
      ratio: "\u753B\u9762\u6BD4\u4F8B",
      audioSettings: "\u58F0\u97F3\u8BBE\u7F6E",
      ratioLayoutHint: "\u9009\u62E9\u6A2A\u5C4F\u3001\u7AD6\u5C4F\u6216\u81EA\u52A8\u9002\u914D\u753B\u9762\u3002",
      audioLayoutHint: "\u5BF9\u767D\u3001\u97F3\u4E50\u4E0E\u73AF\u5883\u58F0\u6309\u811A\u672C\u5B89\u6392\u3002",
      generateAudio: "\u751F\u6210\u97F3\u9891",
      watermark: "\u6DFB\u52A0\u6C34\u5370",
      pollIntervalMs: "\u72B6\u6001\u67E5\u8BE2\u95F4\u9694\uFF08\u79D2\uFF09",
      maxWaitMs: "\u5355\u4E2A\u4EFB\u52A1\u6700\u957F\u7B49\u5F85\u65F6\u95F4\uFF08\u79D2\uFF09",
      save: "\u4FDD\u5B58",
      reset: "\u91CD\u7F6E\u63D2\u4EF6",
      resetHint: "\u6E05\u9664\u672C\u673A\u4FDD\u5B58\u7684\u5BC6\u94A5\u4E0E\u81EA\u5B9A\u4E49\u8BBE\u7F6E\uFF0C\u6062\u590D\u9ED8\u8BA4\u914D\u7F6E\u3002",
      saving: "\u4FDD\u5B58\u4E2D\u2026",
      saved: "\u8BBE\u7F6E\u5DF2\u4FDD\u5B58\uFF0C\u914D\u7F6E\u91CD\u65B0\u52A0\u8F7D\u540E\u751F\u6548\u3002",
      saveFailed: "\u4FDD\u5B58\u5931\u8D25\uFF0C\u8BF7\u68C0\u67E5\u8BBE\u7F6E\u540E\u91CD\u8BD5\u3002",
      dirty: "\u6709\u672A\u4FDD\u5B58\u7684\u6539\u52A8",
      loading: "\u8BFB\u53D6\u914D\u7F6E\u4E2D\u2026",
      unavailable: "\u6682\u65F6\u65E0\u6CD5\u52A0\u8F7D\u63D2\u4EF6\u8BBE\u7F6E\uFF0C\u8BF7\u91CD\u542F Harness \u540E\u91CD\u8BD5\uFF1B\u82E5\u4ECD\u65E0\u6CD5\u52A0\u8F7D\uFF0C\u8BF7\u68C0\u67E5 Harness \u4E0E\u63D2\u4EF6\u7684\u7248\u672C\u662F\u5426\u517C\u5BB9\u3002",
      readOnly: "\u5F53\u524D\u914D\u7F6E\u4E3A\u53EA\u8BFB\uFF0C\u65E0\u6CD5\u4FDD\u5B58\u4FEE\u6539\u3002",
      seamTrimSecondsHint: "\u5206\u522B\u88C1\u526A\u7B2C 2\u30013\u2026\u6BB5\u5F00\u5934\uFF0C\u4F8B\u5982 0.5,0\u3002\u7559\u7A7A\u4F7F\u7528\u6A21\u578B\u9ED8\u8BA4\u503C\uFF0C\u586B 0 \u5173\u95ED\uFF1B\u6BCF\u9879\u4E3A 0\u20133 \u79D2\u3002",
      waitSecondsHint: "\u81F3\u5C11 1 \u79D2\uFF0C\u652F\u6301\u5C0F\u6570\u3002\u6700\u957F\u7B49\u5F85\u65F6\u95F4\u4E0D\u5F97\u5C0F\u4E8E\u67E5\u8BE2\u95F4\u9694\u3002",
      versionHistory: "\u5386\u53F2\u66F4\u65B0",
      versionCheckFirst: "\u8BF7\u5148\u68C0\u67E5\u5E76\u9009\u62E9\u53EF\u7528\u7684\u6B63\u5F0F\u7248\u672C\uFF0C\u518D\u786E\u8BA4\u5B89\u88C5\u3002",
      unknownConnection: "\u672A\u77E5\u63A5\u5165\u65B9\u5F0F\uFF0C\u8BF7\u91CD\u65B0\u9009\u62E9\u3002",
      atomicUnsupported: "\u5F53\u524D Harness \u4E0D\u652F\u6301\u6279\u91CF\u4FDD\u5B58\uFF0C\u8BF7\u66F4\u65B0 Harness \u540E\u91CD\u8BD5\u3002",
      atomicRejected: "\u8F6F\u4EF6\u672A\u63A5\u53D7\u672C\u6B21\u4FDD\u5B58\uFF0C\u8F93\u5165\u5DF2\u4FDD\u7559\u3002\u8BF7\u91CD\u65B0\u6253\u5F00\u8BBE\u7F6E\u9875\u6838\u5BF9\u540E\u91CD\u8BD5\u3002",
      settingsUnavailable: "\u8BBE\u7F6E\u9875\u6B63\u5728\u52A0\u8F7D\u6216\u5DF2\u66F4\u65B0\uFF0C\u8F93\u5165\u5DF2\u4FDD\u7559\u3002\u8BF7\u91CD\u65B0\u6253\u5F00\u8BBE\u7F6E\u9875\u540E\u91CD\u8BD5\u3002",
      settingsConflict: "\u914D\u7F6E\u540C\u65F6\u88AB\u5176\u4ED6\u64CD\u4F5C\u4FEE\u6539\uFF0C\u8F93\u5165\u5DF2\u4FDD\u7559\u3002\u8BF7\u6838\u5BF9\u6700\u65B0\u8BBE\u7F6E\u540E\u91CD\u8BD5\u3002",
      settingsTransport: "\u4FDD\u5B58\u8FDE\u63A5\u4E2D\u65AD\uFF0C\u7ED3\u679C\u5C1A\u672A\u786E\u8BA4\u3002\u8F93\u5165\u5DF2\u4FDD\u7559\uFF0C\u8BF7\u91CD\u65B0\u6253\u5F00\u8BBE\u7F6E\u9875\u6838\u5BF9\u540E\u518D\u4FDD\u5B58\u3002",
      invalidWait: "\u7B49\u5F85\u65F6\u95F4\u987B\u4E3A\u81F3\u5C11 1 \u79D2\u7684\u6709\u6548\u6570\u503C\uFF0C\u4E14\u6700\u957F\u7B49\u5F85\u65F6\u95F4\u4E0D\u5F97\u5C0F\u4E8E\u67E5\u8BE2\u95F4\u9694\u3002",
      invalidSeam: "\u63A5\u7F1D\u88C1\u526A\u987B\u4E3A\u9017\u53F7\u5206\u9694\u7684 0\u20133 \u79D2\u6570\u503C\uFF0C\u4F8B\u5982 0.5,0\u3002",
      resetDone: "\u5DF2\u6E05\u9664\u672C\u673A\u914D\u7F6E\uFF0C\u6062\u590D\u9ED8\u8BA4\u8BBE\u7F6E\u3002",
      resetFailed: "\u91CD\u7F6E\u5931\u8D25\uFF1A{message}"
    };
    const en = {
      summaryEmpty: "Choose a connection method, then log in or enter an API key and save.",
      summary: "{provider} \xB7 {model}",
      apiKeyConfigured: "Configured; leave blank to keep the current key",
      connectionMode: "Connection",
      connectionModeHint: "Log in by email to receive a key, or use your own MetaOntic AI or Volcano Engine key. Save to apply a change.",
      connectionMetaonticHint: "Use your MetaOntic AI API key, then save to apply.",
      connectionMetaonticRegister: "Register to get a key",
      volcengineKeyHint: "Enter an API key from the Volcano Ark console and save. No email login required. Billed to your Volcano Engine account. Check which models your key can access.",
      metaontic: "B \xB7 MetaOntic AI",
      metaonticApiKey: "MetaOntic AI API Key",
      showKey: "Show key",
      hideKey: "Hide key",
      metaonticKeyHint: "Enter an API key and save. No email login required. Check actual charges and usage on your provider platform.",
      volcengineApiKey: "Volcano Engine API Key",
      service: "A \xB7 MetaOnticVideo",
      volcengine: "C \xB7 Volcano Engine",
      seamTrimSeconds: "Seam head trims (e.g. 0.5,0)",
      modelHiddenCurrent: "Current model (selection unavailable)",
      releaseNotesTitle: "Release notes",
      releaseUpdatedAt: "{time}",
      resetConfirm: "Reset this plugin? Saved settings, API keys and login state will be cleared. Generated videos will be kept.",
      model: "Video model",
      imageModel: "Image model",
      imageUseVideoKey: "Use video API key for images",
      sharedModelKey: "Shared key",
      serviceKeyConfigured: "Configured (provided at sign-in)",
      serviceKeyMissing: "Sign in to obtain a key",
      videoModelKey: "Video model key",
      imageApiKey: "Image model key",
      resolution: "Video resolution",
      imageModelHint: "Seedream stylizes real-person references before video generation; image calls are billed separately.",
      modelHint: "mini focuses on cost; fast focuses on generation speed. Actual prices depend on your provider.",
      mergeMode: "Merge mode",
      mergeModeSeamless: "Direct concat (legacy setting)",
      mergeModeCopy: "Stream copy",
      mergeModeReencode: "Re-encode",
      ffmpegBinary: "ffmpeg path",
      ffprobeBinary: "ffprobe path",
      ffmpegTitle: "Merging long videos needs ffmpeg",
      ffmpegBody: "Videos exceeding the model limit (15s for 2.0, 30s for 2.5) are generated as several shots and merged into one file on this machine \u2014 that merge needs ffmpeg. Without it you still get the video, just as separate segments instead of one file.",
      ffmpegInstallFor: "Install it for your OS (click the button to copy the command):",
      ffmpegCopy: "Copy",
      ffmpegCopied: "Copied",
      ffmpegMore: "Other systems",
      ffmpegLess: "Hide other systems",
      ffmpegAfter: 'Rather not touch a terminal? Just say "\u5E2E\u6211\u88C5 ffmpeg" in the chat and the plugin runs the install for you (it asks you to confirm the command first). Re-run the generation afterwards and the merge happens automatically \u2014 no need to regenerate. Installed somewhere unusual? Put the absolute path in the "ffmpeg path" field above. The package ships ffprobe too, so segment probing is fixed at the same time.',
      ffmpegManual: "Installing by hand: Homebrew on macOS, winget on Windows, your distro package manager on Linux \u2014 you are set once `ffmpeg -version` works in a terminal.",
      registerEmail: "Email",
      registerTitle: "Email login",
      registerHint: "Log in with an email verification code. Your first login creates an account and issues a key.",
      registerEmailPlaceholder: "you@example.com",
      registerCode: "Verification code",
      registerCodePlaceholder: "verification code",
      registerCodeSend: "Send code",
      registerCodeSending: "Sending\u2026",
      registerCodeCooldown: "Resend in {seconds}s",
      registerCodeSent: "Code sent to {email} \u2014 valid for 5 minutes.",
      registerEmailLocked: "You can change the email after the countdown.",
      registerNeedEmail: "Type your email before requesting a code.",
      registerNeedCode: "Type the code from the email first.",
      registerRestored: "Device key restored and connection settings saved.",
      quotaTitle: "Quota",
      quotaRemain: "Remaining",
      quotaUsed: "Used",
      quotaTotal: "Total",
      quotaUnlimited: "Unlimited",
      quotaLoading: "Reading quota\u2026",
      quotaRefresh: "Refresh quota",
      supportRecharge: "Manual recharge",
      supportClose: "Close",
      supportScan: "Scan the QR code with WeChat to contact recharge support. If it does not load, use the link below.",
      supportOpenPage: "Open support page",
      quotaNoKey: "Log in to view remaining and used quota.",
      quotaNotRegistered: "No login record found for this device. Contact an administrator before logging in again.",
      quotaFailed: "Failed to read quota: {message}",
      quotaUpdatedAt: "updated {time}",
      versionTitle: "Plugin version",
      versionCurrent: "Installed v{version}",
      versionCheck: "Check for updates",
      versionChecking: "Checking\u2026",
      versionLatest: "Up to date",
      versionNew: "v{version} is available",
      versionFailed: "Update check failed: {message}",
      versionUpdate: "Update now",
      versionOptional: "This update is optional. You can keep using the plugin and update later. It will not install automatically.",
      versionLater: "Later",
      versionUpdateConfirm: "Confirm update to v{version}",
      versionUpdateConfirmHint: "The settings page may briefly close during the update. Your settings and keys will be kept.",
      versionUpdating: "Updating\u2026",
      versionUpdateDone: "v{version} applied through hot reload; no restart needed. Existing conversations use updated plugin rules on the next turn.",
      versionUpdatePending: "v{version} installed, but not activated by the current configuration. Check its enabled state in Plugins.",
      versionUpdateRestart: "v{version} installed; restart Harness to apply it.",
      versionUpdateCancelled: "Update cancelled.",
      versionUpdateRetry: "Update incomplete. Retrying ({attempt}/{total})\u2026",
      versionUpdateFailed: "Online update failed: {message}",
      versionUpdateRemoved: "The plugin was uninstalled but could not be reinstalled. Add it again from the Plugins page.",
      versionUpdateRateLimited: "Gitee is limiting requests. Try again later. Your settings and keys will be kept.",
      versionUpdateLockfile: "The profile pnpm-lock.yaml still has a metaontic-video entry without integrity, so pnpm refuses to install (ERR_PNPM_MISSING_TARBALL_INTEGRITY). The plugin clears that entry in the background and keeps a backup: wait a few seconds and start the update again. If it still fails, quit Harness and delete pnpm-lock.yaml in the plugin install directory.",
      versionUpdateUnavailable: "This version of Harness does not support online updates. Uninstall and re-add the plugin from the Plugins page.",
      versionHint: "Check for and install updates here. Your settings and keys will be kept.",
      versionCheckedAt: "checked {time}",
      register: "Log in",
      registerWorking: "Logging in\u2026",
      registerOk: "Logged in. Your key and connection settings have been saved.",
      registerPartial: "Key received, but some settings could not be saved. Review them and try again.",
      registerFailed: "Log in failed: {message}",
      registerDisabled: "Login service unavailable: {message}",
      registerNoKey: "The login service returned no key. Try again later or contact an administrator.",
      sectionGeneration: "Generation",
      sectionConnection: "Connection & credentials",
      sectionVideo: "Picture & audio",
      sectionModels: "Models",
      sectionCombined: "More settings",
      advancedPicture: "Picture",
      advancedMerge: "Video merging",
      advancedWait: "Polling & waiting",
      advancedTools: "Local tools",
      sectionCombinedHint: "Appearance, merging, runtime and local tools",
      toolsHint: "Usually leave blank. Set executable paths only if installed tools are not detected.",
      segmentsRetained: "Original segments are always retained for preview, resume and editing.",
      ratio: "Aspect ratio",
      audioSettings: "Audio settings",
      ratioLayoutHint: "Choose landscape, portrait or adaptive framing.",
      audioLayoutHint: "Dialogue, music and ambience follow the script.",
      generateAudio: "Generate audio",
      watermark: "Add watermark",
      pollIntervalMs: "Status check interval (seconds)",
      maxWaitMs: "Maximum wait per task (seconds)",
      save: "Save",
      reset: "Reset plugin",
      resetHint: "Clear locally saved keys and custom settings to restore defaults.",
      saving: "Saving\u2026",
      saved: "Settings saved. Changes apply after configuration reloads.",
      saveFailed: "Could not save. Check your settings and try again.",
      dirty: "Unsaved changes",
      loading: "Reading configuration\u2026",
      unavailable: "Plugin settings could not be loaded. Restart Harness and try again. If this continues, check that your Harness and plugin versions are compatible.",
      readOnly: "These settings are read-only and cannot be changed.",
      seamTrimSecondsHint: "Trim the start of segments 2, 3, etc., e.g. 0.5,0. Leave blank for model defaults; use 0 to disable. Each value: 0\u20133 seconds.",
      waitSecondsHint: "At least 1 second; decimals allowed. Maximum wait must be at least the check interval.",
      versionHistory: "Update history",
      versionCheckFirst: "Check and select an available stable version before confirming installation.",
      unknownConnection: "Unknown connection method. Select one again.",
      atomicUnsupported: "This version of Harness does not support batch saving. Update Harness and try again.",
      atomicRejected: "The application refused the save. Input is retained. Reopen settings, review and retry.",
      settingsUnavailable: "Settings are loading or were replaced. Input is retained. Reopen settings and retry.",
      settingsConflict: "Another operation changed these settings. Input is retained. Review the latest settings and retry.",
      settingsTransport: "The save connection was interrupted; the result is unconfirmed. Input is retained. Reopen settings and check before saving again.",
      invalidWait: "Enter valid times of at least 1 second. Maximum wait must be at least the check interval.",
      invalidSeam: "Enter comma-separated trim values from 0 to 3 seconds, e.g. 0.5,0.",
      resetDone: "Local settings cleared and defaults restored.",
      resetFailed: "Reset failed: {message}"
    };
    return { zh, en };
  }

  // src/connection-defaults.ts
  var METAONTIC_BASE_URL = "https://ai.bileego.com";
  function connectionDefaults(values) {
    const text = (key, fallback) => String(values[key] ?? "").trim() || fallback;
    const volc = values.connectionMode === "volcengine";
    return {
      ...volc ? { baseUrl: "https://ark.cn-beijing.volces.com" } : { baseUrl: text("baseUrl", METAONTIC_BASE_URL).replace(/\/+$/, "") },
      submitPath: volc ? "/api/v3/contents/generations/tasks" : text("submitPath", "/doubao/api/v3/contents/generations/tasks"),
      queryPath: volc ? "/api/v3/contents/generations/tasks/{task_id}" : text("queryPath", "/doubao/api/v3/contents/generations/tasks/{task_id}"),
      model: text("model", "doubao-seedance-2-0-mini-260615"),
      imageModel: text("imageModel", "doubao-seedream-5-0-260128"),
      imageUseVideoKey: values.imageUseVideoKey !== false
    };
  }

  // src/client/state.ts
  function createSettingsState({ React }) {
    function useSnapshot(form) {
      const subscribe = React.useCallback((listener) => form.subscribe(listener), [form]);
      const getSnapshot = React.useCallback(() => form.getSnapshot(), [form]);
      return React.useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
    }
    function same(a, b) {
      return a === b || a === void 0 && b === "" || a === "" && b === void 0;
    }
    async function persistBatch(form, ops) {
      if (typeof form.mutate !== "function") throw new Error("atomicUnsupported");
      function checkpoint() {
        try {
          const snapshot = form.getSnapshot?.();
          if (!snapshot || snapshot.status !== "ready" || snapshot.writable === false || snapshot.revision == null) return null;
          const fields = ops.map(({ path }) => ["value", "user", "base", "secrets"].map((source) => {
            let current = snapshot[source];
            for (const key of path) current = current?.[key];
            return current;
          }));
          return { revision: snapshot.revision, fields: JSON.stringify(fields) };
        } catch {
          return null;
        }
      }
      function fail(code, before2, after2) {
        globalThis.console?.warn?.("[MetaOnticVideo] settings-save", {
          code,
          beforeRevision: before2?.revision ?? null,
          afterRevision: after2?.revision ?? null
        });
        throw new Error(code);
      }
      function readiness() {
        let snapshot;
        try {
          snapshot = form.getSnapshot?.();
        } catch {
          return "settingsUnavailable";
        }
        if (!snapshot) return null;
        if (snapshot.writable === false) return "readOnly";
        if (snapshot.status && snapshot.status !== "ready") return "settingsUnavailable";
        return null;
      }
      const initialProblem = readiness();
      if (initialProblem) fail(initialProblem, null, null);
      const before = checkpoint();
      let accepted;
      try {
        accepted = await form.mutate(ops, before?.revision);
      } catch {
        fail("settingsTransport", before, null);
      }
      if (accepted) return;
      const after = checkpoint();
      const problem = readiness();
      if (problem) fail(problem, before, after);
      if (before && after && before.revision !== after.revision) {
        if (before.fields !== after.fields) fail("settingsConflict", before, after);
        try {
          accepted = await form.mutate(ops, after.revision);
        } catch {
          fail("settingsTransport", after, null);
        }
        if (accepted) return;
        const latest = checkpoint();
        fail(readiness() || (latest && latest.revision !== after.revision ? "settingsConflict" : "atomicRejected"), after, latest);
      }
      fail("atomicRejected", before, after);
    }
    function validateSettings(values) {
      const interval = Number(values.pollIntervalMs ?? 5e3);
      const wait = Number(values.maxWaitMs ?? 6e5);
      if (![interval, wait].every((n) => Number.isSafeInteger(n) && n >= 1e3) || wait < interval) {
        throw new Error("invalidWait");
      }
      const trim = String(values.seamTrimSeconds ?? "").trim();
      if (trim && !trim.split(",").every((part) => part.trim() !== "" && Number.isFinite(Number(part)) && Number(part) >= 0 && Number(part) <= 3)) {
        throw new Error("invalidSeam");
      }
    }
    async function persistConnection(form, pending, nextMode) {
      if (!["service", "metaontic", "volcengine"].includes(nextMode)) throw new Error("unknownConnection");
      const inactiveKeys = nextMode === "volcengine" ? [
        "metaonticApiKey",
        "apiKey",
        "keyOrigin",
        "baseUrl",
        "submitPath",
        "queryPath",
        "registerEmail",
        "deviceId",
        "deviceSecret",
        "registerApi",
        "registerToken"
      ] : nextMode === "metaontic" ? ["volcengineApiKey", "apiKey", "keyOrigin", "registerEmail", "deviceId", "deviceSecret", "registerApi", "registerToken"] : ["volcengineApiKey", "metaonticApiKey"];
      const ops = pending.filter(([key]) => key !== "connectionMode" && !inactiveKeys.includes(key)).map(([key, next]) => ({ op: "set", path: [key], value: next }));
      for (const key of inactiveKeys) ops.push({ op: "set", path: [key], value: "" });
      const saved = form.getSnapshot?.()?.value || {};
      const values = { ...saved, ...Object.fromEntries(pending), connectionMode: nextMode };
      if (saved.connectionMode === "volcengine" && nextMode !== "volcengine") {
        for (const key of ["baseUrl", "submitPath", "queryPath"]) {
          if (!pending.some(([field]) => field === key)) values[key] = "";
        }
      }
      for (const key of inactiveKeys) values[key] = "";
      for (const [key, next] of Object.entries(connectionDefaults(values))) {
        const existing = ops.findIndex((op) => op.path[0] === key);
        if (existing >= 0) ops.splice(existing, 1);
        ops.push({ op: "set", path: [key], value: next });
      }
      ops.push({ op: "set", path: ["connectionMode"], value: nextMode });
      await persistBatch(form, ops);
    }
    return { useSnapshot, same, validateSettings, persistConnection, persistBatch };
  }

  // src/client/updates.ts
  function createUpdates({ h }) {
    const PLUGIN_PACKAGE = "metaontic-video";
    const UPDATE_SPEC = "git+https://gitee.com/hackloop/metaontic-video.git";
    const UPDATE_ATTEMPTS = 3;
    const UPDATE_CACHE_KEY = "metaontic-video.update-check-v3";
    const UPDATE_MAX_AGE_MS = 6 * 60 * 60 * 1e3;
    const PLUGIN_VERSION = true ? "3.13.11".trim().replace(/^v/i, "") : "";
    function isNewerVersion(remote, local) {
      const parse = (text) => {
        const m = /^v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/.exec(String(text || ""));
        return m ? { core: m.slice(1, 4).map(Number), pre: m[4]?.split(".") || [] } : null;
      };
      const next = parse(remote), current = parse(local);
      if (!next || !current) return false;
      for (let i = 0; i < 3; i++) if (next.core[i] !== current.core[i]) return next.core[i] > current.core[i];
      if (!next.pre.length || !current.pre.length) return !next.pre.length && Boolean(current.pre.length);
      for (let i = 0; i < Math.max(next.pre.length, current.pre.length); i++) {
        const a = next.pre[i], b = current.pre[i];
        if (a === b) continue;
        if (a === void 0 || b === void 0) return b === void 0;
        const an = /^\d+$/.test(a), bn = /^\d+$/.test(b);
        if (an && bn) return Number(a) > Number(b);
        if (an !== bn) return !an;
        return a > b;
      }
      return false;
    }
    function updateBell(t, latest, current) {
      if (!isNewerVersion(latest, current)) return null;
      const label = t("versionNew", { version: latest });
      return h(
        "span",
        { className: "mov-update-bell", "data-field": "update-bell", role: "img", "aria-label": label, title: label },
        h("svg", { width: 16, height: 16, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true }, [
          h("path", { key: "body", d: "M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" }),
          h("path", { key: "clapper", d: "M10 21h4M12 2V1" })
        ])
      );
    }
    async function fetchUpdateSource(url, ms = 12e3) {
      const controller = typeof AbortController === "function" ? new AbortController() : null;
      const timer = controller ? window.setTimeout(() => controller.abort(), ms) : null;
      try {
        const response = await fetch(url, {
          headers: { accept: "application/json" },
          signal: controller ? controller.signal : void 0
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        return { json: async () => data };
      } finally {
        if (timer) window.clearTimeout(timer);
      }
    }
    async function fetchRecentVersions() {
      const urls = [
        "https://gitee.com/api/v5/repos/hackloop/metaontic-video/releases?per_page=100",
        "https://api.github.com/repos/wxsimon2022/metaontic-video/releases?per_page=100"
      ];
      const results = await Promise.allSettled(urls.map(async (url) => {
        const body = await (await fetchUpdateSource(url, 6e3)).json();
        if (!Array.isArray(body)) throw new Error("invalid releases");
        return body.filter((r) => !r.draft && !r.prerelease).map((r) => String(r.tag_name || "").replace(/^v/, "")).filter((version) => /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version));
      }));
      const versions = [...new Set(results.flatMap((r) => r.status === "fulfilled" ? r.value : []))].sort((a, b) => isNewerVersion(a, b) ? -1 : isNewerVersion(b, a) ? 1 : 0).slice(0, 3);
      if (!versions.length) throw new Error("no published stable releases available");
      return versions;
    }
    async function fetchLatestVersion() {
      return (await fetchRecentVersions())[0];
    }
    return { PLUGIN_VERSION, UPDATE_CACHE_KEY, UPDATE_MAX_AGE_MS, fetchLatestVersion, fetchRecentVersions, PLUGIN_PACKAGE, UPDATE_SPEC, UPDATE_ATTEMPTS, isNewerVersion, updateBell };
  }
  function createUpdateActions(context) {
    function readUpdateCache() {
      try {
        const raw = window.localStorage.getItem(context.UPDATE_CACHE_KEY);
        const saved = raw ? JSON.parse(raw) : null;
        if (!saved || typeof saved !== "object") {
          return { latest: "", versions: [], at: 0, fresh: false };
        }
        const at = Number(saved.at) || 0;
        return {
          latest: String(saved.latest || ""),
          versions: Array.isArray(saved.versions) ? saved.versions.filter((v) => /^\d+\.\d+\.\d+$/.test(v)).slice(0, 3) : [],
          at,
          fresh: Boolean(at) && Date.now() - at < context.UPDATE_MAX_AGE_MS
        };
      } catch {
        return { latest: "", versions: [], at: 0, fresh: false };
      }
    }
    function rememberUpdateCheck(latest, versions = []) {
      try {
        window.localStorage.setItem(context.UPDATE_CACHE_KEY, JSON.stringify({ at: Date.now(), latest, versions }));
      } catch {
      }
    }
    function forgetUpdateCheck() {
      try {
        window.localStorage.removeItem(context.UPDATE_CACHE_KEY);
      } catch {
      }
    }
    async function checkForUpdate(silent = false) {
      if (!silent) {
        context.setUpdateDeferred?.("");
        try {
          window.localStorage.removeItem(`${context.UPDATE_CACHE_KEY}.deferred`);
        } catch {
        }
        context.setUpdateStatus("working");
        context.setUpdateMessage("");
      }
      const request = context.updateRequest ? ++context.updateRequest.current : 0;
      try {
        const versions = context.fetchRecentVersions ? await context.fetchRecentVersions() : [await context.fetchLatestVersion()];
        const latest = versions[0];
        if (context.updateRequest && request !== context.updateRequest.current) return "";
        context.setUpdateConfirm?.(false);
        context.setUpdateLatest(latest);
        context.setUpdateAt((/* @__PURE__ */ new Date()).toLocaleTimeString());
        context.setUpdateStatus("ok");
        rememberUpdateCheck(latest, versions);
        return latest;
      } catch (error) {
        if (context.updateRequest && request !== context.updateRequest.current) return "";
        if (silent)
          return "";
        context.setUpdateStatus("failed");
        context.setUpdateMessage(context.t("versionFailed", { message: error?.message || String(error) }));
        return "";
      }
    }
    async function runOnlineUpdate() {
      if (context.updateConfirm !== true) return;
      context.setUpdateConfirm(false);
      if (context.PLUGIN_VERSION && context.isNewerVersion?.(context.updateLatest, context.PLUGIN_VERSION) !== true) {
        context.setUpdateStatus("ok");
        context.setUpdateMessage(context.t("versionLatest"));
        return;
      }
      context.setUpdateStatus("installing");
      context.setUpdateMessage("");
      const probe = context.manager ? context.manager() : { manager: null, tried: ["\u672A\u6CE8\u5165"] };
      const pluginManager = probe.manager;
      if (!pluginManager || typeof pluginManager.installBundle !== "function") {
        context.setUpdateStatus("failed");
        context.setUpdateMessage(context.t("versionUpdateUnavailable", { detail: probe.tried.join("\uFF0C") }));
        return;
      }
      try {
        if (typeof pluginManager.listBundles !== "function") throw new Error("source-unavailable");
        const listed = await pluginManager.listBundles();
        const bundles = Array.isArray(listed) ? listed : listed?.ok === true && Array.isArray(listed.value) ? listed.value : null;
        const bundle = bundles?.find((item) => item?.name === context.PLUGIN_PACKAGE && item.installed === true);
        let source = typeof bundle?.source === "string" ? bundle.source.trim() : "";
        if (source.startsWith(`${context.PLUGIN_PACKAGE}@`)) source = source.slice(context.PLUGIN_PACKAGE.length + 1);
        if (!source) throw new Error("source-unavailable");
        const linked = /^link:/i.test(source);
        const local = /^(?:file:|[a-z]:[\\/]|[\\/]|~[\\/])/i.test(source);
        if (linked || local && !/\.(?:tgz|tar\.gz)(?:[?#].*)?$/i.test(source)) {
          context.setUpdateStatus("failed");
          context.setUpdateMessage("\u5F53\u524D\u4E3A\u672C\u5730\u76EE\u5F55\u94FE\u63A5\u5B89\u88C5\uFF0C\u5DF2\u505C\u6B62\u5728\u7EBF\u66F4\u65B0\uFF0C\u672A\u6267\u884C\u66FF\u6362\u3002\u76EE\u5F55\u94FE\u63A5\u5207\u6362\u4E3A\u6210\u54C1\u5305\u5B58\u5728\u6587\u4EF6\u88AB\u6E05\u7A7A\u6216\u4ECD\u52A0\u8F7D\u65E7\u76EE\u5F55\u7684\u98CE\u9669\u3002\u8BF7\u5148\u5907\u4EFD\u5E76\u4FDD\u7559\u539F\u76EE\u5F55\uFF0C\u4F7F\u7528\u6210\u54C1\u5305\u8FC1\u79FB\u6D41\u7A0B\uFF1B\u82E5\u76EE\u5F55\u5DF2\u7A7A\uFF0C\u5148\u6062\u590D\u5B8C\u6574package\u3002\u4E0D\u8981\u91CD\u7F6EKey\u6216\u76F4\u63A5\u5378\u8F7D\u3002");
          return;
        }
        if (bundle.error || bundle.meta?.error) throw new Error("metadata-unavailable");
      } catch {
        context.setUpdateStatus("failed");
        context.setUpdateMessage("\u65E0\u6CD5\u6838\u5B9E\u63D2\u4EF6\u5B89\u88C5\u6765\u6E90\u6216\u5143\u4FE1\u606F\uFF0C\u5DF2\u505C\u6B62\u66F4\u65B0\uFF0C\u672A\u6267\u884C\u66FF\u6362\u3002\u8BF7\u4FDD\u7559\u73B0\u6709\u914D\u7F6E\u548C\u5B89\u88C5\u76EE\u5F55\uFF0C\u6838\u5BF9\u5B89\u88C5\u72B6\u6001\u540E\u518D\u5904\u7406\uFF1B\u4E0D\u8981\u91CD\u7F6EKey\u6216\u5148\u5378\u8F7D\u3002");
        return;
      }
      const requestId = `${context.PLUGIN_PACKAGE}-update-${Date.now()}`;
      const install = async (spec) => {
        try {
          return await pluginManager.installBundle(spec, { enabled: true, requestId });
        } catch (error) {
          return { ok: false, error: { message: error?.message || String(error) } };
        }
      };
      const failureText = (result) => String(result?.error?.message ?? result?.value?.error?.diagnostic ?? result?.value?.error?.code ?? "unknown");
      const worthRetrying = (text) => /429|queue overflowed|timed out|timeout|ETIMEDOUT|ECONNRESET|ECONNREFUSED|EAI_AGAIN|socket hang up|unable to access|network|fetch/i.test(text);
      const lockfileUnverifiable = (text) => /MISSING_TARBALL_INTEGRITY/i.test(text);
      if (!/^\d+\.\d+\.\d+$/.test(context.updateLatest || "") || context.availableVersions && !context.availableVersions.includes(context.updateLatest)) {
        context.setUpdateStatus("failed");
        context.setUpdateMessage(context.t("versionCheckFirst"));
        return;
      }
      const candidates = [
        `https://gitee.com/hackloop/metaontic-video/releases/download/v${context.updateLatest}/metaontic-video-${context.updateLatest}.tgz`,
        `https://github.com/wxsimon2022/metaontic-video/releases/download/v${context.updateLatest}/metaontic-video-${context.updateLatest}.tgz`
      ];
      const specUnresolvable = (text) => /Could not resolve|No matching version|ERR_PNPM_NO_MATCHING_VERSION|ERR_PNPM_FETCH_40[34]|HTTP[ :]+40[34]|404 Not Found|403 Forbidden/i.test(text);
      const trySpec = async (spec) => {
        for (let round = 1; round <= context.UPDATE_ATTEMPTS; round += 1) {
          let result = await install(spec);
          if (result?.ok === true && result.value?.error?.code === "already-installed") {
            return { failure: failureText(result), next: false };
          }
          if (result?.ok === true && result.value?.application !== "failed") {
            return { outcome: result.value || {} };
          }
          const text = failureText(result);
          if (lockfileUnverifiable(text)) return { failure: text, next: false, lockfile: true };
          const transient = worthRetrying(text);
          if (transient && round < context.UPDATE_ATTEMPTS) {
            context.setUpdateMessage(context.t("versionUpdateRetry", { attempt: round + 1, total: context.UPDATE_ATTEMPTS }));
            await new Promise((resolve) => window.setTimeout(resolve, round * 1200));
            continue;
          }
          return { failure: text, next: !transient && specUnresolvable(text) };
        }
        return { failure: "unknown" };
      };
      let outcome = null;
      let failure = "";
      for (const spec of candidates) {
        const attempt = await trySpec(spec);
        if (attempt.outcome) {
          outcome = attempt.outcome;
          break;
        }
        failure = attempt.failure || failure;
        if (!attempt.next)
          break;
      }
      if (!outcome) {
        context.setUpdateStatus("failed");
        context.setUpdateMessage([
          lockfileUnverifiable(failure) ? context.t("versionUpdateLockfile") : "",
          context.t("versionUpdateFailed", { message: failure }),
          worthRetrying(failure) || /429|queue overflowed/i.test(failure) ? context.t("versionUpdateRateLimited") : ""
        ].filter(Boolean).join(" "));
        return;
      }
      if (outcome.application === "cancelled") {
        context.setUpdateStatus("ok");
        context.setUpdateMessage(context.t("versionUpdateCancelled"));
        return;
      }
      forgetUpdateCheck();
      const version = outcome.version || context.updateLatest;
      context.setUpdateLatest("");
      context.setUpdateStatus(outcome.application === "restart-required" ? "restart" : "applied");
      context.setUpdateMessage(outcome.application === "restart-required" ? context.t("versionUpdateRestart", { version }) : context.t(outcome.application === "applied" ? "versionUpdateDone" : "versionUpdatePending", { version }));
    }
    function deferUpdate() {
      context.setUpdateConfirm(false);
      context.setUpdateDeferred(context.updateLatest);
      try {
        window.localStorage.setItem(`${context.UPDATE_CACHE_KEY}.deferred`, context.updateLatest);
      } catch {
      }
    }
    return { deferUpdate, readUpdateCache, rememberUpdateCheck, forgetUpdateCheck, checkForUpdate, runOnlineUpdate };
  }
  function renderUpdateNotice({ h, t, available, latest, deferred, status, confirmed, onUpdate, onLater }) {
    if (!available || deferred === latest || status === "installing") return null;
    return h("div", { key: "update-notice", className: "mov-notice", role: "status", "data-field": "update-notice" }, [
      h("strong", { key: "title" }, t("versionNew", { version: latest })),
      h("p", { key: "optional" }, t("versionOptional")),
      confirmed ? h("p", { key: "confirm" }, t("versionUpdateConfirmHint")) : null,
      h("div", { key: "actions", className: "mov-cmd-row" }, [
        h(
          "button",
          {
            key: "update",
            type: "button",
            className: "mov-btn mov-btn-sm mov-btn-primary",
            "data-action": confirmed ? "update-notice-confirm" : "update-notice-open",
            onClick: onUpdate
          },
          confirmed ? t("versionUpdateConfirm", { version: latest }) : t("versionUpdate")
        ),
        h("button", { key: "later", type: "button", className: "mov-btn mov-btn-sm", "data-action": "update-later", onClick: onLater }, t("versionLater"))
      ])
    ]);
  }
  function formatReleaseTime(value) {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) return "";
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return "";
    return new Date(date.getTime() + 8 * 60 * 60 * 1e3).toISOString().slice(0, 16).replace("T", " ");
  }

  // src/client/account.ts
  function createAccountActions(context) {
    function registerApiRoot() {
      const configured = String(context.value.registerApi || "").trim();
      return (configured || context.DEFAULT_REGISTER_API).replace(/\/+$/, "");
    }
    function loggedOut() {
      try {
        return window.localStorage.getItem(context.LOGGED_OUT_KEY) === "1";
      } catch {
        return false;
      }
    }
    function setLoggedOut() {
      try {
        window.localStorage.setItem(context.LOGGED_OUT_KEY, "1");
      } catch {
      }
    }
    function clearLoggedOut() {
      try {
        window.localStorage.removeItem(context.LOGGED_OUT_KEY);
      } catch {
      }
    }
    function forgetDevice() {
      try {
        window.localStorage.removeItem("metaontic-video.device-id");
        window.localStorage.removeItem("metaontic-video.device-secret");
      } catch {
      }
      setLoggedOut();
    }
    function deviceIdentity() {
      const ID_KEY = "metaontic-video.device-id";
      const SECRET_KEY = "metaontic-video.device-secret";
      const rand = () => Math.random().toString(36).slice(2, 10);
      let id = `dsh-${rand()}${Date.now().toString(36)}`;
      let secret = `dsk-${rand()}${rand()}${rand()}`;
      try {
        const savedId = window.localStorage.getItem(ID_KEY);
        const savedSecret = window.localStorage.getItem(SECRET_KEY);
        if (savedId)
          id = savedId;
        else
          window.localStorage.setItem(ID_KEY, id);
        if (savedSecret)
          secret = savedSecret;
        else
          window.localStorage.setItem(SECRET_KEY, secret);
      } catch {
      }
      return { id, secret };
    }
    function deviceFingerprint() {
      const pick = (read) => {
        try {
          const value = read();
          return value ? String(value).slice(0, 120) : void 0;
        } catch {
          return void 0;
        }
      };
      const nav = () => window.navigator;
      const info = {
        app: "Harness",
        plugin: "metaontic-video",
        platform: pick(() => nav().userAgentData?.platform || nav().platform),
        os: pick(() => nav().userAgentData?.platform || nav().platform),
        language: pick(() => nav().language),
        timezone: pick(() => window.Intl?.DateTimeFormat().resolvedOptions().timeZone),
        screen: pick(() => `${window.screen?.width}x${window.screen?.height}`),
        agent: pick(() => nav().userAgent)
      };
      return Object.fromEntries(Object.entries(info).filter(([, v]) => v !== void 0));
    }
    function deviceLabel(info) {
      const platform = info?.platform || info?.os;
      return platform ? `Harness-${platform}` : "Harness";
    }
    function deviceWrites(device = void 0) {
      const identity = device || deviceIdentity();
      const current = context.form.getSnapshot().value || {};
      const writes = [];
      if (!context.same(current.deviceId, identity.id))
        writes.push(["deviceId", identity.id]);
      if (!context.same(current.deviceSecret, identity.secret)) {
        writes.push(["deviceSecret", identity.secret]);
      }
      return writes;
    }
    async function syncDeviceIdentity() {
      if (!context.serviceActive())
        return;
      const writes = deviceWrites();
      if (!writes.length)
        return;
      context.connectionBusy.current = true;
      try {
        const pending = context.persistBatch(context.form, writes.map(([key, next]) => ({ op: "set", path: [key], value: next })));
        context.connectionBusy.pending = pending;
        await pending;
        for (const [key] of writes)
          context.clear(key);
      } catch {
      } finally {
        context.connectionBusy.current = false;
        context.connectionBusy.pending = null;
      }
    }
    async function callRegister(url, init = {}) {
      const controller = typeof AbortController === "function" ? new AbortController() : null;
      const timer = controller ? window.setTimeout(() => controller.abort(), 9e4) : null;
      const token = String(context.value.registerToken || context.DEFAULT_REGISTER_TOKEN);
      const options = { ...init || {} };
      options.headers = {
        accept: "application/json",
        "x-register-token": token,
        // 本插件版本：服务端会记进请求日志，便于回溯「这版有没有问题」
        ...context.PLUGIN_VERSION ? { "x-plugin-version": context.PLUGIN_VERSION } : {},
        ...init && init.headers || {}
      };
      let response;
      try {
        response = await fetch(url, {
          signal: controller ? controller.signal : void 0,
          ...options
        });
      } finally {
        if (timer)
          window.clearTimeout(timer);
      }
      const text = await response.text();
      let body = null;
      try {
        body = text ? JSON.parse(text) : null;
      } catch {
        body = null;
      }
      const payload = body && typeof body === "object" && "data" in body ? body.data : body;
      if (!response.ok || body && typeof body === "object" && body.code) {
        const failure = new Error(body && (body.message || body.detail) || text.slice(0, 200) || `HTTP ${response.status}`);
        failure.status = response.status;
        throw failure;
      }
      return payload || {};
    }
    async function applyRegistration(result, fallbackBase, device) {
      if (!context.serviceActive())
        return;
      const writes = [
        ["apiKey", result.api_key],
        ["keyOrigin", "register"],
        ["baseUrl", result.base_url || fallbackBase || registerApiRoot()],
        ...await deviceWrites(device)
      ];
      const account = result.email || result.display_name || "";
      if (account)
        writes.push(["registerEmail", account]);
      if (result.model)
        writes.push(["model", result.model]);
      if (!context.serviceActive())
        return false;
      context.connectionBusy.current = true;
      try {
        const pending = context.persistConnection(context.form, writes, "service");
        context.connectionBusy.pending = pending;
        await pending;
        clearLoggedOut();
        for (const [key] of writes)
          context.clear(key);
        context.setRegisterStatus("ok");
      } catch (error) {
        throw new Error(context.settingsError(error));
      } finally {
        context.connectionBusy.current = false;
        context.connectionBusy.pending = null;
      }
      loadQuota().catch(() => {
      });
      loadUsage().catch(() => {
      });
      return true;
    }
    async function lookupOwnKey() {
      const device = deviceIdentity();
      const result = await callRegister(`${registerApiRoot()}/api/v1/register/lookup`, {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({ device_id: device.id, device_secret: device.secret })
      });
      if (!result.api_key)
        throw new Error(context.t("registerNoKey"));
      if (!await applyRegistration(result, null, device))
        return;
      context.setRegisterStatus("restored");
      return result;
    }
    function startCooldown(seconds) {
      const total = Math.max(Math.round(Number(seconds) || 0), 0);
      if (!total)
        return;
      context.setCodeCooldown(total);
      const tick = (left) => {
        if (left <= 0) {
          context.setCodeCooldown(0);
          return;
        }
        context.setCodeCooldown(left);
        window.setTimeout(() => tick(left - 1), 1e3);
      };
      window.setTimeout(() => tick(total - 1), 1e3);
    }
    async function sendEmailCode() {
      const account = context.registerEmail.trim();
      if (!account) {
        context.setCodeStatus("failed");
        context.setCodeMessage(context.t("registerNeedEmail"));
        return;
      }
      context.setCodeStatus("working");
      context.setCodeMessage("");
      try {
        const status = await callRegister(`${registerApiRoot()}/api/v1/register/status`);
        if (!status.enabled) {
          context.setCodeStatus("failed");
          context.setCodeMessage(context.t("registerDisabled", { message: status.hint || "-" }));
          return;
        }
        const result = await callRegister(`${registerApiRoot()}/api/v1/register/email/code`, {
          method: "POST",
          headers: { "content-type": "application/json", accept: "application/json" },
          body: JSON.stringify({ email: account })
        });
        context.setCodeStatus("sent");
        context.setCodeMessage(context.t("registerCodeSent", { email: result.email || account }));
        startCooldown(result.retry_after ?? 60);
        context.setRegisterStatus("idle");
        context.setRegisterMessage("");
      } catch (error) {
        context.setCodeStatus("failed");
        context.setCodeMessage(error?.message || String(error));
      }
    }
    async function register() {
      const root = registerApiRoot();
      const account = context.registerEmail.trim();
      const code = context.registerCode.trim();
      if (!account) {
        context.setRegisterStatus("failed");
        context.setRegisterMessage(context.t("registerNeedEmail"));
        return;
      }
      if (!code) {
        context.setRegisterStatus("failed");
        context.setRegisterMessage(context.t("registerNeedCode"));
        return;
      }
      context.setRegisterStatus("working");
      context.setRegisterMessage("");
      const device = deviceIdentity();
      const fingerprint = deviceFingerprint();
      try {
        const status = await callRegister(`${root}/api/v1/register/status`);
        if (!status.enabled) {
          context.setRegisterStatus("disabled");
          context.setRegisterMessage(context.t("registerDisabled", { message: status.hint || "-" }));
          return;
        }
        const result = await callRegister(`${root}/api/v1/register`, {
          method: "POST",
          headers: { "content-type": "application/json", accept: "application/json" },
          body: JSON.stringify({
            email: account,
            code,
            device_id: device.id,
            device_secret: device.secret,
            device_info: fingerprint,
            note: `Harness \u63D2\u4EF6\u8BBE\u7F6E\u9875\u6CE8\u518C\uFF08${deviceLabel(fingerprint)}\uFF09`
          })
        });
        if (!result.api_key) {
          context.setRegisterStatus("failed");
          context.setRegisterMessage(context.t("registerNoKey"));
          return;
        }
        await applyRegistration(result, status.base_url || root, device);
      } catch (error) {
        if (error?.status === 409 || error?.status === 404) {
          try {
            await lookupOwnKey();
            return;
          } catch {
          }
        }
        context.setRegisterStatus("failed");
        context.setRegisterMessage(context.t("registerFailed", { message: error?.message || String(error) }));
      }
    }
    async function loadQuota() {
      if (!context.serviceMode || !context.serviceActive())
        return;
      const device = deviceIdentity();
      context.setQuotaStatus("working");
      context.setQuotaMessage("");
      try {
        const result = await callRegister(`${registerApiRoot()}/api/v1/register/quota`, {
          method: "POST",
          headers: { "content-type": "application/json", accept: "application/json" },
          body: JSON.stringify({ device_id: device.id, device_secret: device.secret })
        });
        if (!context.serviceActive())
          return;
        context.setQuota(result);
        context.setQuotaAt((/* @__PURE__ */ new Date()).toLocaleTimeString());
        context.setQuotaStatus("ok");
        return result;
      } catch (error) {
        context.setQuota(null);
        context.setQuotaStatus("failed");
        context.setQuotaMessage(error?.status === 404 ? context.t("quotaNotRegistered") : context.t("quotaFailed", { message: error?.message || String(error) }));
        throw error;
      }
    }
    async function loadUsage() {
      if (!context.serviceMode || !context.serviceActive() || context.usageInFlight.current)
        return;
      context.usageInFlight.current = true;
      const device = deviceIdentity();
      context.setUsageStatus("working");
      context.setUsageMessage("");
      try {
        const result = await callRegister(`${registerApiRoot()}/api/v1/usage/list`, {
          method: "POST",
          headers: { "content-type": "application/json", accept: "application/json" },
          body: JSON.stringify({
            device_id: device.id,
            device_secret: device.secret,
            limit: 10
          })
        });
        if (!context.serviceActive())
          return;
        context.setUsage(result);
        context.setUsageAt((/* @__PURE__ */ new Date()).toLocaleTimeString());
        context.setUsageStatus("ok");
        return result;
      } catch (error) {
        context.setUsageStatus("failed");
        context.setUsageMessage(error?.status === 404 ? context.t("quotaNotRegistered") : context.t("usageFailed", { message: error?.message || String(error) }));
        throw error;
      } finally {
        context.usageInFlight.current = false;
      }
    }
    return { registerApiRoot, loggedOut, setLoggedOut, clearLoggedOut, forgetDevice, deviceIdentity, deviceFingerprint, deviceLabel, deviceWrites, syncDeviceIdentity, callRegister, applyRegistration, lookupOwnKey, startCooldown, sendEmailCode, register, loadQuota, loadUsage };
  }

  // package.json
  var package_default = {
    name: "metaontic-video",
    version: "3.13.11",
    description: "AI video creation plugin for DeepSeek Harness: Seedance 2.0 long videos with multi-segment continuation, text-to-video, image-to-video, script and storyboard review, segment previews, resumable generation and local FFmpeg merging.",
    license: "MIT",
    type: "module",
    keywords: [
      "metaontic-video",
      "deepseek-harness",
      "deepseek-harness-plugin",
      "dsh-plugin",
      "ai-video",
      "ai-video-generation",
      "seedance",
      "seedance-2",
      "long-video",
      "video-generation",
      "text-to-video",
      "image-to-video",
      "video-continuation",
      "video-extension",
      "storyboard",
      "ffmpeg",
      "new-api",
      "video-director"
    ],
    repository: {
      type: "git",
      url: "git+https://github.com/wxsimon2022/metaontic-video.git"
    },
    homepage: "https://github.com/wxsimon2022/metaontic-video#readme",
    bugs: {
      url: "https://github.com/wxsimon2022/metaontic-video/issues"
    },
    exports: {
      ".": "./index.js",
      "./client": "./client.js",
      "./locale/*.json": "./locale/*.json",
      "./icon": "./icon.svg",
      "./package.json": "./package.json"
    },
    files: [
      "index.js",
      "client.js",
      "cordis.patch.yml",
      "skills",
      "locale/*.json",
      "icon.svg",
      "logo.svg",
      "README.md",
      "README.en.md",
      "MetaOnticVideo\u4F7F\u7528\u8BF4\u660E\u4E66.md",
      "MetaOnticVideo\u4F7F\u7528\u8BF4\u660E\u4E66.pdf",
      "CHANGELOG.md",
      "LICENSE",
      "docs/guide/*.svg",
      "docs/guide/*.png",
      "THIRD_PARTY_NOTICES.md"
    ],
    engines: {
      node: ">=20"
    },
    dsh: {
      bundle: {
        patch: "./cordis.patch.yml"
      },
      client: {
        platform: "web",
        inject: [
          "@deepseek-ai/dsh-client-locale",
          "@deepseek-ai/dsh-client-ui-settings",
          "@deepseek-ai/dsh-client-ui-tool",
          "@deepseek-ai/dsh-client-ui-session",
          "@deepseek-ai/dsh-client-ui-plugin-manager",
          "@deepseek-ai/dsh-api-remotes"
        ]
      }
    },
    devDependencies: {
      "@types/node": "^20.19.43",
      esbuild: "^0.28.2",
      react: "^19.3.1",
      "react-dom": "^19.3.1",
      typescript: "^5.9.3",
      hyperframes: "0.8.223",
      "@deepseek-ai/schemastery": "~3.18.5"
    },
    scripts: {
      typecheck: "tsc -p tsconfig.json",
      "build:locale": "node scripts/build.mjs locale",
      "build:host": "node scripts/build.mjs host",
      "build:client": "node scripts/build.mjs client",
      build: "npm run typecheck && node scripts/build.mjs",
      preview: "node scripts/preview.mjs",
      release: "node scripts/release.mjs",
      "clean:releases": "node scripts/clean-releases.mjs",
      "pack:test": "node scripts/pack-test.mjs"
    },
    dependencies: {},
    releaseNotes: {
      version: "3.13.11",
      prerelease: false,
      publishedAt: "2026-11-03T04:32:54.491Z",
      items: [
        "\u4FEE\u590D\uFF1A\u5728\u7EBF\u6216\u672C\u5730\u5B89\u88C5\u62A5 ERR_PNPM_MISSING_TARBALL_INTEGRITY\uFF08\u5B89\u88C5\u76EE\u5F55\u7684 pnpm-lock.yaml \u91CC\u7559\u7740\u4E00\u6761\u7F3A integrity \u7684\u8FDC\u7A0B tgz \u8BB0\u5F55\uFF0Cpnpm \u56E0\u6B64\u62D2\u7EDD\u6574\u6B21\u5B89\u88C5\uFF09\u65F6\uFF0C\u63D2\u4EF6\u73B0\u5728\u4F1A\u5728\u540E\u53F0\u81EA\u5DF1\u6E05\u6389\u672C\u63D2\u4EF6\u8FD9\u6761\u574F\u8BB0\u5F55\uFF1A\u52A0\u8F7D\u65F6\u68C0\u67E5\u4E00\u6B21\u3001\u4E4B\u540E\u6BCF 10 \u79D2\u590D\u67E5\uFF0C\u6539\u524D\u628A\u539F\u6587\u4EF6\u53E6\u5B58\u4E3A\u540C\u76EE\u5F55\u4E0B\u7684 pnpm-lock.yaml.metaontic-backup-\u65F6\u95F4\uFF0C\u5176\u4ED6\u4F9D\u8D56\u548C\u5E26\u6821\u9A8C\u503C\u7684\u6B63\u5E38\u8BB0\u5F55\u4E00\u5F8B\u4E0D\u52A8\uFF0C\u6E05\u7406\u540E\u66F4\u65B0\u5373\u53EF\u7EE7\u7EED\uFF0C\u4E0D\u518D\u9700\u8981\u7528\u6237\u624B\u52A8\u5220\u9664\u8BE5\u6587\u4EF6\u3002",
        "\u4F18\u5316\uFF1A\u66F4\u65B0\u5931\u8D25\u547D\u4E2D\u8FD9\u6761\u62A5\u9519\u65F6\uFF0C\u4E0D\u518D\u5BF9\u540C\u4E00\u5730\u5740\u91CD\u8BD5\u4E09\u6B21\u3001\u4E5F\u4E0D\u5207\u6362\u5230\u53E6\u4E00\u4E2A\u955C\u50CF\u6E90\uFF08\u8FD9\u4E24\u79CD\u505A\u6CD5\u5B9E\u6D4B\u90FD\u540C\u6837\u5931\u8D25\uFF0C\u53EA\u4F1A\u8BA9\u7528\u6237\u767D\u7B49\uFF09\uFF0C\u76F4\u63A5\u7ED9\u51FA\u9488\u5BF9\u6027\u63D0\u793A\uFF1A\u7B49\u5F85\u5341\u51E0\u79D2\u540E\u518D\u70B9\u4E00\u6B21\u300C\u66F4\u65B0\u5230\u6700\u65B0\u6B63\u5F0F\u7248\u300D\uFF0C\u4ECD\u5931\u8D25\u65F6\u518D\u6309\u63D0\u793A\u624B\u52A8\u5220\u9664 pnpm-lock.yaml\uFF1B\u53EA\u6709\u63D2\u4EF6\u8FD8\u6CA1\u88C5\u4E0A\u3001\u540E\u53F0\u8FD8\u6CA1\u6709\u8BE5\u6E05\u7406\u52A8\u4F5C\u65F6\u624D\u9700\u8981\u624B\u52A8\u5904\u7406\u3002",
        "\u4F18\u5316\uFF1A\u4F7F\u7528\u8BF4\u660E\u4E66\u4E0E README \u540C\u6B65\u5199\u660E\u81EA\u52A8\u6E05\u7406\u4E0E\u5907\u4EFD\u6587\u4EF6\u7684\u4F4D\u7F6E\uFF0C\u5E76\u8BF4\u660E\u8FD9\u6761\u62A5\u9519\u4E0E\u63D2\u4EF6\u5305\u3001\u64CD\u4F5C\u7CFB\u7EDF\u65E0\u5173\uFF0C\u907F\u514D\u7EE7\u7EED\u628A\u5B83\u5F53\u6210 Windows \u6587\u4EF6\u5360\u7528\u95EE\u9898\u53BB\u6392\u67E5\u3002"
      ]
    }
  };

  // src/client/settings.ts
  function createSettingsPage({ useSnapshot, React, h, TOKENS, same, validateSettings, persistConnection, PLUGIN_OWNED_KEYS, persistBatch, DEFAULT_REGISTER_API, LOGGED_OUT_KEY, DEFAULT_REGISTER_TOKEN, PLUGIN_VERSION, UPDATE_CACHE_KEY, UPDATE_MAX_AGE_MS, fetchLatestVersion, SELECTS, inputStyle, optionLabel, FIELD_BY_KEY, SECTIONS, formatMoney, PLUGIN_PACKAGE, UPDATE_SPEC, UPDATE_ATTEMPTS, isNewerVersion, updateBell, PAGE_CSS }) {
    function makePage({ form, t, manager }) {
      return function ConfigPage(props) {
        const snapshot = useSnapshot(form);
        const value = snapshot.value || {};
        const [draft, setDraft] = React.useState({});
        const selectedMode = draft.connectionMode ?? value.connectionMode ?? "service";
        const directMode = selectedMode === "volcengine";
        const serviceMode = selectedMode === "service";
        const [visibleKey, setVisibleKey] = React.useState("");
        const [supportOpen, setSupportOpen] = React.useState(false);
        const supportDialog = React.useRef(null);
        React.useEffect(() => {
          if (supportOpen && supportDialog.current && !supportDialog.current.open) supportDialog.current.showModal();
        }, [supportOpen]);
        React.useEffect(() => {
          setSupportOpen(false);
        }, [selectedMode]);
        React.useEffect(() => {
          setVisibleKey("");
        }, [selectedMode]);
        const [status, setStatus] = React.useState("idle");
        const [saveError, setSaveError] = React.useState("");
        const statusTimer = React.useRef(null);
        const connectionBusy = React.useRef(false);
        const saveInFlight = React.useRef(false);
        function serviceActive() {
          return !connectionBusy.current && (form.getSnapshot().value?.connectionMode || "service") === "service";
        }
        const [registerStatus, setRegisterStatus] = React.useState("idle");
        const [registerMessage, setRegisterMessage] = React.useState("");
        const [registerEmail, setRegisterEmail] = React.useState(() => {
          const saved = form.getSnapshot().value || {};
          return String(saved.registerEmail || "");
        });
        const [registerCode, setRegisterCode] = React.useState("");
        const [codeStatus, setCodeStatus] = React.useState("idle");
        const [codeMessage, setCodeMessage] = React.useState("");
        const [codeCooldown, setCodeCooldown] = React.useState(0);
        const emailLocked = codeCooldown > 0;
        const [quota, setQuota] = React.useState(null);
        const [quotaStatus, setQuotaStatus] = React.useState("idle");
        const [quotaMessage, setQuotaMessage] = React.useState("");
        const [quotaAt, setQuotaAt] = React.useState("");
        const [usage, setUsage] = React.useState(null);
        const [usageStatus, setUsageStatus] = React.useState("idle");
        const [usageMessage, setUsageMessage] = React.useState("");
        const usageInFlight = React.useRef(false);
        const [usageAt, setUsageAt] = React.useState("");
        const [showAllFfmpeg, setShowAllFfmpeg] = React.useState(false);
        const [copiedFfmpeg, setCopiedFfmpeg] = React.useState("");
        const [updateStatus, setUpdateStatus] = React.useState("idle");
        const [updateMessage, setUpdateMessage] = React.useState("");
        const [updateLatest, setUpdateLatest] = React.useState("");
        const updateRequest = React.useRef(0);
        const releaseNotes = package_default.releaseNotes;
        const [updateAt, setUpdateAt] = React.useState("");
        const [updateConfirm, setUpdateConfirm] = React.useState(false);
        const [updateDeferred, setUpdateDeferred] = React.useState(() => {
          try {
            return window.localStorage.getItem(`${UPDATE_CACHE_KEY}.deferred`) || "";
          } catch {
            return "";
          }
        });
        const { registerApiRoot, loggedOut, setLoggedOut, clearLoggedOut, forgetDevice, deviceIdentity, deviceFingerprint, deviceLabel, deviceWrites, syncDeviceIdentity, callRegister, applyRegistration, lookupOwnKey, startCooldown, sendEmailCode, register, loadQuota, loadUsage } = createAccountActions({
          get value() {
            return value;
          },
          get DEFAULT_REGISTER_API() {
            return DEFAULT_REGISTER_API;
          },
          get LOGGED_OUT_KEY() {
            return LOGGED_OUT_KEY;
          },
          get form() {
            return form;
          },
          get same() {
            return same;
          },
          get serviceActive() {
            return serviceActive;
          },
          get connectionBusy() {
            return connectionBusy;
          },
          get persistBatch() {
            return persistBatch;
          },
          get clear() {
            return clear;
          },
          get DEFAULT_REGISTER_TOKEN() {
            return DEFAULT_REGISTER_TOKEN;
          },
          get PLUGIN_VERSION() {
            return PLUGIN_VERSION;
          },
          get persistConnection() {
            return persistConnection;
          },
          get setRegisterStatus() {
            return setRegisterStatus;
          },
          get settingsError() {
            return settingsError;
          },
          get t() {
            return t;
          },
          get setCodeCooldown() {
            return setCodeCooldown;
          },
          get registerEmail() {
            return registerEmail;
          },
          get setCodeStatus() {
            return setCodeStatus;
          },
          get setCodeMessage() {
            return setCodeMessage;
          },
          get setRegisterMessage() {
            return setRegisterMessage;
          },
          get registerCode() {
            return registerCode;
          },
          get serviceMode() {
            return serviceMode;
          },
          get setQuotaStatus() {
            return setQuotaStatus;
          },
          get setQuotaMessage() {
            return setQuotaMessage;
          },
          get setQuota() {
            return setQuota;
          },
          get setQuotaAt() {
            return setQuotaAt;
          },
          get usageInFlight() {
            return usageInFlight;
          },
          get setUsageStatus() {
            return setUsageStatus;
          },
          get setUsageMessage() {
            return setUsageMessage;
          },
          get setUsage() {
            return setUsage;
          },
          get setUsageAt() {
            return setUsageAt;
          }
        });
        const { readUpdateCache, rememberUpdateCheck, forgetUpdateCheck, checkForUpdate, runOnlineUpdate, deferUpdate } = createUpdateActions({
          get UPDATE_CACHE_KEY() {
            return UPDATE_CACHE_KEY;
          },
          get PLUGIN_VERSION() {
            return PLUGIN_VERSION;
          },
          get isNewerVersion() {
            return isNewerVersion;
          },
          get updateRequest() {
            return updateRequest;
          },
          get UPDATE_MAX_AGE_MS() {
            return UPDATE_MAX_AGE_MS;
          },
          get setUpdateStatus() {
            return setUpdateStatus;
          },
          get setUpdateMessage() {
            return setUpdateMessage;
          },
          get fetchLatestVersion() {
            return fetchLatestVersion;
          },
          get setUpdateLatest() {
            return setUpdateLatest;
          },
          get setUpdateAt() {
            return setUpdateAt;
          },
          get t() {
            return t;
          },
          get setUpdateConfirm() {
            return setUpdateConfirm;
          },
          get manager() {
            return manager;
          },
          get PLUGIN_PACKAGE() {
            return PLUGIN_PACKAGE;
          },
          get updateLatest() {
            return updateLatest;
          },
          get updateConfirm() {
            return updateConfirm;
          },
          get setUpdateDeferred() {
            return setUpdateDeferred;
          },
          get UPDATE_SPEC() {
            return UPDATE_SPEC;
          },
          get UPDATE_ATTEMPTS() {
            return UPDATE_ATTEMPTS;
          }
        });
        const restoreTried = React.useRef(false);
        React.useEffect(() => {
          if (restoreTried.current) return;
          restoreTried.current = true;
          const snap = form.getSnapshot() || {};
          if (((snap.value || {}).connectionMode || "service") !== "service") return;
          if (loggedOut()) {
            setRegisterStatus("idle");
            return;
          }
          syncDeviceIdentity().catch(() => {
          });
          if (snap.secrets?.apiKey || (snap.value || {}).apiKey) {
            loadQuota().catch(() => {
            });
            loadUsage().catch(() => {
            });
            return;
          }
          lookupOwnKey().catch(() => {
          });
        }, []);
        React.useEffect(() => {
          if (!serviceMode || props?.view === "summary" || !(snapshot.secrets?.apiKey || value.apiKey)) return;
          const refresh = () => {
            if (window.document?.visibilityState === "hidden") return;
            loadUsage().catch(() => {
            });
          };
          refresh();
          const timer = window.setInterval(refresh, 6e4);
          window.addEventListener("focus", refresh);
          window.document?.addEventListener("visibilitychange", refresh);
          return () => {
            window.clearInterval(timer);
            window.removeEventListener("focus", refresh);
            window.document?.removeEventListener("visibilitychange", refresh);
          };
        }, [serviceMode, Boolean(snapshot.secrets?.apiKey || value.apiKey), value.deviceId, props?.view]);
        const updateTried = React.useRef(false);
        React.useEffect(() => {
          if (props?.view === "summary") {
            updateTried.current = false;
            return;
          }
          if (updateTried.current) return;
          updateTried.current = true;
          setUpdateLatest("");
          setUpdateConfirm(false);
          setUpdateAt("");
          setUpdateStatus("idle");
          setUpdateMessage("");
          try {
            setUpdateDeferred(window.localStorage.getItem(`${UPDATE_CACHE_KEY}.deferred`) || "");
          } catch {
            setUpdateDeferred("");
          }
          const cached = readUpdateCache();
          if (cached.latest) {
            setUpdateLatest(cached.latest);
            if (cached.at) setUpdateAt(new Date(cached.at).toLocaleTimeString());
            setUpdateStatus("ok");
          }
          checkForUpdate(true).catch(() => {
          });
        }, [props?.view]);
        if (props && props.view === "summary") {
          const configured = Boolean(value.model) || Boolean(snapshot.secrets?.apiKey);
          const text = configured ? t("summary", { provider: t(selectedMode), model: value.model || "-" }) : t("summaryEmpty");
          return h("span", { style: { color: TOKENS.muted } }, text);
        }
        const pending = Object.entries(draft).filter(([key, next]) => !same(value[key], next));
        const edit = (key, next) => {
          clearStatusTimer();
          setStatus((current) => current === "idle" ? current : "idle");
          setDraft((current) => ({ ...current, [key]: next }));
        };
        const clear = (key) => setDraft((current) => {
          const next = { ...current };
          delete next[key];
          return next;
        });
        function clearStatusTimer() {
          if (statusTimer.current) {
            window.clearTimeout(statusTimer.current);
            statusTimer.current = null;
          }
        }
        function flashStatus(next, holdMs = 2500) {
          clearStatusTimer();
          setStatus(next);
          statusTimer.current = window.setTimeout(() => {
            statusTimer.current = null;
            setStatus("idle");
          }, holdMs);
        }
        function settingsError(error) {
          const message = error?.message || String(error);
          return ["unknownConnection", "atomicUnsupported", "atomicRejected", "settingsUnavailable", "settingsConflict", "settingsTransport", "readOnly", "invalidWait", "invalidSeam"].includes(message) ? t(message) : message;
        }
        async function save() {
          if (saveInFlight.current) return;
          if (connectionBusy.current && !connectionBusy.pending) return;
          saveInFlight.current = true;
          setSaveError("");
          setStatus("saving");
          try {
            if (connectionBusy.pending) await connectionBusy.pending.catch(() => {
            });
            connectionBusy.current = true;
            const latest = form.getSnapshot().value || {};
            const nextMode = draft.connectionMode ?? latest.connectionMode ?? "service";
            const changes = Object.entries(draft).filter(([key, next]) => !same(latest[key], next));
            validateSettings({ ...latest, ...draft });
            await persistConnection(form, changes, nextMode);
            if (nextMode !== "service") {
              forgetDevice();
              setRegisterEmail("");
              setRegisterCode("");
              setRegisterStatus("idle");
              setRegisterMessage("");
              setQuota(null);
            }
            setDraft((current) => Object.fromEntries(Object.entries(current).filter(([key, next]) => !Object.prototype.hasOwnProperty.call(draft, key) || !same(draft[key], next))));
            flashStatus("saved");
          } catch (error) {
            setSaveError(settingsError(error));
            setStatus("failed");
          } finally {
            connectionBusy.current = false;
            saveInFlight.current = false;
          }
        }
        async function reset() {
          if (connectionBusy.current) return;
          if (!window.confirm(t("resetConfirm"))) return;
          connectionBusy.current = true;
          setSaveError("");
          setStatus("saving");
          try {
            const targets = /* @__PURE__ */ new Set([...Object.keys(snapshot.user || {}), ...PLUGIN_OWNED_KEYS]);
            await persistBatch(form, [...targets].map((key) => ({ op: "unset", path: [key] })));
            forgetDevice();
            setDraft({});
            setVisibleKey("");
            setRegisterEmail("");
            setRegisterStatus("idle");
            setRegisterMessage("");
            setRegisterCode("");
            setQuota(null);
            flashStatus("reset");
          } catch (error) {
            setSaveError(t("resetFailed", { message: settingsError(error) }));
            setStatus("failed");
          } finally {
            connectionBusy.current = false;
          }
        }
        function control(field) {
          if (field.key === "apiKey") return h("input", { id: "metaontic-video-apiKey", className: "mov-input", style: inputStyle, type: "text", readOnly: true, value: snapshot.secrets?.apiKey || value.apiKey ? t("serviceKeyConfigured") : t("serviceKeyMissing") });
          const current = draft[field.key] !== void 0 ? draft[field.key] : value[field.key] ?? (field.key === "imageUseVideoKey" ? true : field.key === "pollIntervalMs" ? 5e3 : field.key === "maxWaitMs" ? 6e5 : void 0);
          const secondsField = field.key === "pollIntervalMs" || field.key === "maxWaitMs";
          const displayed = secondsField && current !== void 0 && current !== "" ? Number(current) / 1e3 : current;
          const id = `metaontic-video-${field.key}`;
          if (field.kind === "switch") {
            return h(
              "label",
              { htmlFor: id, className: "mov-switch" },
              h("input", {
                id,
                "data-field": field.key,
                type: "checkbox",
                checked: Boolean(current),
                onChange: (event) => edit(field.key, event.target.checked)
              }),
              h("span", null, t(field.key))
            );
          }
          if (field.kind === "select") {
            const options = SELECTS[field.key] || [];
            const hiddenModel = field.key === "model" && /seedance-2(?:-5|\.5)/i.test(String(current || ""));
            const legacyMerge = field.key === "mergeMode" && current === "seamless";
            const list = current && !options.includes(current) && !hiddenModel && !legacyMerge ? [...options, current] : options;
            return h("select", {
              id,
              "data-field": field.key,
              className: `mov-input${field.mono ? " mov-mono" : ""}`,
              style: inputStyle,
              value: legacyMerge ? "copy" : current ?? "",
              onChange: (event) => edit(field.key, event.target.value)
            }, [
              hiddenModel ? h("option", { key: "hidden-current", value: current, hidden: true }, t("modelHiddenCurrent")) : null,
              ...list.map((option) => h("option", { key: option, value: option }, optionLabel(t, field.key, option)))
            ]);
          }
          const canReveal = field.key === "metaonticApiKey" || field.key === "volcengineApiKey" || field.key === "imageApiKey";
          const revealed = canReveal && visibleKey === field.key;
          const input = h("input", {
            id,
            "data-field": field.key,
            className: `mov-input${field.mono ? " mov-mono" : ""}`,
            style: inputStyle,
            type: field.kind === "number" ? "number" : field.secret && !revealed ? "password" : "text",
            value: displayed ?? "",
            min: secondsField ? 1 : void 0,
            step: secondsField ? 1e-3 : void 0,
            placeholder: field.secret && (snapshot.secrets?.[field.key] || value[field.key]) ? t("apiKeyConfigured") : "",
            onChange: (event) => edit(
              field.key,
              field.kind === "number" && event.target.value !== "" ? secondsField ? Math.round(Number(event.target.value) * 1e3) : Number(event.target.value) : event.target.value
            )
          });
          if (!canReveal) return input;
          return h("div", { className: "mov-key-control" }, [
            input,
            h("button", {
              type: "button",
              className: "mov-key-eye",
              "aria-label": t(revealed ? "hideKey" : "showKey"),
              title: t(revealed ? "hideKey" : "showKey"),
              "data-action": `toggle-${field.key}`,
              "aria-controls": id,
              "aria-pressed": revealed,
              onClick: () => setVisibleKey(revealed ? "" : field.key)
            }, h("svg", { width: 18, height: 18, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true }, [
              h("path", { key: "eye", d: "M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" }),
              h("circle", { key: "pupil", cx: 12, cy: 12, r: 3 }),
              revealed ? h("path", { key: "slash", d: "M3 3l18 18" }) : null
            ]))
          ]);
        }
        const hints = {
          connectionMode: selectedMode === "metaontic" ? [t("connectionMetaonticHint"), " ", h("a", { key: "metaontic-register", href: "https://ai.bileego.com/", target: "_blank", rel: "noopener noreferrer", style: { textDecoration: "underline" } }, t("connectionMetaonticRegister"))] : t("connectionModeHint"),
          metaonticApiKey: t("metaonticKeyHint"),
          volcengineApiKey: t("volcengineKeyHint"),
          model: t("modelHint"),
          imageModel: t("imageModelHint"),
          seamTrimSeconds: t("seamTrimSecondsHint"),
          maxWaitMs: t("waitSecondsHint")
        };
        function fieldCell(field) {
          const classes = ["mov-field"];
          if (field.kind === "switch") classes.push("mov-field-switch");
          if (field.wide) classes.push("mov-field-wide");
          return h("div", { key: field.key, className: classes.join(" ") }, [
            field.kind === "switch" ? null : h("label", { key: "label", className: "mov-label", htmlFor: `metaontic-video-${field.key}` }, t(["apiKey", "metaonticApiKey", "volcengineApiKey"].includes(field.key) ? !directMode && (serviceMode || (draft.imageUseVideoKey ?? value.imageUseVideoKey ?? true) !== false) ? "sharedModelKey" : "videoModelKey" : field.key)),
            control(field),
            hints[field.key] ? h("span", { key: "hint", className: "mov-hint", style: { marginTop: 4 } }, hints[field.key]) : null
          ]);
        }
        const renderGrid = (section) => {
          if (section.key === "sectionModels") {
            const shared2 = serviceMode || (draft.imageUseVideoKey ?? value.imageUseVideoKey ?? true) !== false;
            const common = !serviceMode && !directMode ? [fieldCell(FIELD_BY_KEY.imageUseVideoKey), ...shared2 ? [fieldCell(FIELD_BY_KEY.metaonticApiKey)] : []] : [];
            const videoFields = ["model", ...!serviceMode && (directMode || !shared2) ? [directMode ? "volcengineApiKey" : "metaonticApiKey"] : []];
            const imageFields = ["imageModel", ...!shared2 ? ["imageApiKey"] : []];
            return h("div", { key: section.key, className: "mov-model-settings" }, [
              ...common,
              h("div", { key: "models", className: `mov-model-grid${directMode ? " mov-model-grid-single" : ""}` }, [
                h("div", { key: "video", className: "mov-model-card", "data-group": "video-model" }, videoFields.map((key) => fieldCell(FIELD_BY_KEY[key]))),
                !directMode ? h("div", { key: "image", className: "mov-model-card", "data-group": "image-model" }, imageFields.map((key) => fieldCell(FIELD_BY_KEY[key]))) : null
              ])
            ]);
          }
          if (section.key === "sectionVideo") {
            return h("div", { key: section.key, className: "mov-av-grid" }, [
              h("div", { key: "picture", className: "mov-av-card" }, [
                fieldCell(FIELD_BY_KEY.ratio),
                h("span", { key: "hint", className: "mov-hint" }, t("ratioLayoutHint"))
              ]),
              h("div", { key: "audio", className: "mov-av-card mov-av-audio" }, [
                h("span", { key: "label", className: "mov-label" }, t("audioSettings")),
                control(FIELD_BY_KEY.generateAudio),
                h("span", { key: "hint", className: "mov-hint" }, t("audioLayoutHint"))
              ])
            ]);
          }
          const shared = serviceMode || (draft.imageUseVideoKey ?? value.imageUseVideoKey ?? true) !== false;
          const videoKey = directMode ? "volcengineApiKey" : serviceMode ? "apiKey" : "metaonticApiKey";
          const fields = section.key === "sectionModels" ? directMode ? ["model", videoKey] : serviceMode ? ["model", "imageModel"] : shared ? ["imageUseVideoKey", videoKey, "model", "imageModel"] : ["imageUseVideoKey", "model", videoKey, "imageModel", "imageApiKey"] : section.fields;
          return h(
            "div",
            { key: section.key, className: "mov-grid" },
            fields.filter((key) => (key !== "volcengineApiKey" || directMode) && (!["imageModel", "imageUseVideoKey", "imageApiKey"].includes(key) || !directMode) && (key !== "imageApiKey" || (draft.imageUseVideoKey ?? value.imageUseVideoKey ?? true) === false) && (key !== "metaonticApiKey" || selectedMode === "metaontic")).map((key) => fieldCell(FIELD_BY_KEY[key])).filter(Boolean)
          );
        };
        const settingsRows = () => [
          h("div", { key: "generation", className: "mov-section" }, [
            h("div", { key: "title", className: "mov-section-title" }, t("sectionGeneration")),
            ...SECTIONS.map((section) => h("div", { key: section.key, className: "mov-parameter-group" }, [
              h("div", { key: "heading", className: "mov-parameter-heading" }, t(section.key)),
              renderGrid(section),
              section.key === "sectionConnection" ? registerBox : null
            ]))
          ]),
          h("details", { key: "advanced", className: "mov-section mov-advanced" }, [
            h("summary", { key: "toggle", className: "mov-advanced-toggle" }, [
              h("span", { key: "title" }, t("sectionCombined")),
              h("span", { key: "hint", className: "mov-hint" }, t("sectionCombinedHint"))
            ]),
            h("div", { key: "body", className: "mov-advanced-body" }, [
              ...[
                { key: "advancedPicture", fields: ["watermark"] },
                { key: "advancedMerge", fields: ["mergeMode", "seamTrimSeconds"], hint: "segmentsRetained" },
                { key: "advancedWait", fields: ["pollIntervalMs", "maxWaitMs"] },
                { key: "advancedTools", fields: ["ffmpegBinary", "ffprobeBinary"], hint: "toolsHint" }
              ].map((group) => h("div", { key: group.key, className: `mov-advanced-group${group.key === "advancedTools" ? " mov-advanced-tools" : ""}`, "data-group": group.key }, [
                h("div", { key: "title", className: "mov-parameter-heading" }, t(group.key)),
                renderGrid(group),
                group.hint ? h("p", { key: "hint", className: "mov-hint", style: { margin: 0 } }, t(group.hint)) : null
              ]))
            ])
          ])
        ];
        const overrides = Object.keys(snapshot.user || {});
        const footerMessage = status === "saved" ? t("saved") : status === "reset" ? t("resetDone") : status === "failed" ? saveError || t("saveFailed") : pending.length ? t("dirty") : "";
        const footer = pending.length || status !== "idle" ? h("div", { key: "footer", className: "mov-footer" }, [
          footerMessage ? h("span", {
            key: "status",
            style: {
              fontSize: 12,
              color: status === "failed" ? TOKENS.error : status === "saved" || status === "reset" ? TOKENS.success : TOKENS.muted
            }
          }, footerMessage) : null
        ]) : null;
        const resetRow = overrides.length || pending.length ? h("div", { key: "reset-row", className: "mov-footer mov-reset-row" }, [
          h("span", { key: "hint", className: "mov-hint", style: { flex: "1 1 200px" } }, t("resetHint")),
          pending.length ? h("button", {
            key: "save",
            "data-action": "save",
            type: "button",
            className: "mov-btn mov-btn-primary",
            disabled: status === "saving" || snapshot.writable === false,
            onClick: save
          }, status === "saving" ? t("saving") : t("save")) : null,
          h("button", {
            key: "reset",
            "data-action": "reset",
            type: "button",
            className: "mov-btn",
            disabled: status === "saving" || snapshot.writable === false,
            onClick: reset
          }, t("reset"))
        ]) : null;
        const registerMessageColors = {
          ok: TOKENS.success,
          restored: TOKENS.success,
          partial: TOKENS.success,
          disabled: TOKENS.error,
          failed: TOKENS.error
        };
        const serverIssuedKey = value.keyOrigin === "register" || Boolean(value.deviceId && value.deviceSecret && value.registerEmail);
        const keyReady = serviceMode && Boolean(snapshot.secrets?.apiKey || value.apiKey) && serverIssuedKey;
        const registerText = registerStatus === "ok" ? t("registerOk") : registerStatus === "partial" ? t("registerPartial") : registerStatus === "restored" ? t("registerRestored") : registerMessage;
        const quotaSymbol = quota && quota.currency_symbol ? quota.currency_symbol : "\xA5";
        const money = (field) => `${quotaSymbol}${formatMoney(quota ? quota[field] : 0)}`;
        const quotaReady = quotaStatus === "ok" && quota;
        const quotaFallback = keyReady ? t("quotaLoading") : t("quotaNoKey");
        const quotaStats = quotaReady ? [
          {
            key: "remain",
            label: t("quotaRemain"),
            value: quota.unlimited_quota ? t("quotaUnlimited") : money("remain_amount"),
            color: TOKENS.success
          },
          { key: "used", label: t("quotaUsed"), value: money("used_amount"), color: TOKENS.text },
          { key: "total", label: t("quotaTotal"), value: money("total_amount"), color: TOKENS.muted }
        ] : null;
        const quotaBox = serviceMode && keyReady ? h("div", {
          key: "quota",
          "data-field": "quota",
          className: "mov-card mov-quota-compact"
        }, [
          h("div", { key: "head", className: "mov-card-head" }, [
            h("span", { key: "title", className: "mov-card-title" }, t("quotaTitle"))
          ]),
          quotaStats ? h(
            "div",
            { key: "text", "data-field": "quotaValue", className: "mov-stats" },
            quotaStats.map((item) => h("div", { key: item.key, className: "mov-stat" }, [
              h("span", { key: "label", className: "mov-stat-label" }, item.label),
              h("span", {
                key: "value",
                className: "mov-stat-value",
                style: { color: item.color }
              }, item.value)
            ]))
          ) : h("span", {
            key: "text",
            "data-field": "quotaValue",
            className: "mov-hint"
          }, quotaFallback),
          quotaReady ? h("span", { key: "at", className: "mov-foot-note" }, t("quotaUpdatedAt", { time: quotaAt })) : null,
          quotaMessage ? h("span", { key: "message", className: "mov-hint" }, quotaMessage) : null,
          h("div", { key: "actions", className: "mov-quota-actions mov-trailing" }, [
            h("button", {
              key: "refresh",
              "data-action": "quota-refresh",
              type: "button",
              className: "mov-btn mov-btn-sm",
              disabled: quotaStatus === "working",
              onClick: () => {
                loadQuota().catch(() => {
                });
              }
            }, t("quotaRefresh")),
            h("button", {
              key: "support",
              "data-action": "support-recharge",
              type: "button",
              className: "mov-btn mov-btn-sm",
              "aria-haspopup": "dialog",
              onClick: () => setSupportOpen(true)
            }, t("supportRecharge"))
          ])
        ]) : null;
        function copyText(text, mark) {
          try {
            const result = window.navigator?.clipboard?.writeText(text);
            if (result && typeof result.then === "function") {
              result.then(() => {
                mark(text);
                window.setTimeout(() => mark(""), 2e3);
              }, () => {
              });
            }
          } catch {
          }
        }
        function copyCommand(command) {
          copyText(command, setCopiedFfmpeg);
        }
        function usageTime(value2) {
          if (!value2) return "-";
          const at = new Date(value2);
          if (Number.isNaN(at.getTime())) return "-";
          return at.toLocaleString(void 0, {
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit"
          });
        }
        const usageRows = usage && Array.isArray(usage.items) ? usage.items : [];
        const usageSymbol = usage && usage.currency_symbol ? usage.currency_symbol : "\xA5";
        const usageSummaryText = usage ? usageRows.length ? `${t("usageSummary", {
          count: usage.count,
          amount: `${usageSymbol}${formatMoney(usage.amount_sum)}`
        })}${usage.truncated ? ` \xB7 ${t("usageMore", { count: usage.count })}` : ""}` : t("usageEmpty") : usageStatus === "working" ? t("usageLoading") : t("usageKeyMissing");
        const usageBox = serviceMode && keyReady ? h("div", {
          key: "usage",
          "data-field": "usage",
          className: "mov-card"
        }, [
          h("div", { key: "head", className: "mov-card-head" }, [
            h(
              "span",
              { key: "title", className: "mov-card-title" },
              t("usageTitle", { days: usage ? usage.window_days : 7 })
            ),
            h("span", {
              key: "summary",
              "data-field": "usageSummary",
              className: "mov-hint",
              style: { flex: "1 1 160px" }
            }, usageSummaryText),
            h("button", {
              key: "refresh",
              "data-action": "usage-refresh",
              type: "button",
              className: "mov-btn mov-btn-sm",
              disabled: usageStatus === "working",
              onClick: () => {
                loadUsage().catch(() => {
                });
              }
            }, t("usageRefresh"))
          ]),
          usageRows.length ? h("div", {
            key: "table",
            className: "mov-table"
          }, [
            h("div", {
              key: "head-row",
              "data-field": "usage-head",
              className: "mov-table-head"
            }, [
              h("span", { key: "time" }, t("usageColTime")),
              h("span", { key: "kind" }, t("usageColKind")),
              h("span", { key: "model" }, t("usageColModel")),
              h("span", { key: "cost" }, t("usageColCost")),
              h("span", { key: "status" }, t("usageColStatus"))
            ]),
            ...usageRows.map((row, index) => h("div", {
              key: `${row.id}-${index}`,
              "data-field": "usage-row",
              className: "mov-table-row"
            }, [
              h(
                "span",
                { key: "time", className: "mov-num", style: { color: TOKENS.muted } },
                usageTime(row.created_at)
              ),
              h("span", { key: "kind" }, row.kind_label || ""),
              // 模型 ID 是这一行最有用的信息之一（换过模型一眼能看出来是哪次用的哪个）
              h("span", {
                key: "model",
                className: "mov-model",
                title: row.model || ""
              }, row.model || "\u2014"),
              h("span", {
                key: "amount",
                "data-field": "usage-amount",
                className: "mov-num",
                style: { color: row.status === "succeeded" ? TOKENS.success : TOKENS.muted }
              }, `${usageSymbol}${formatMoney(row.amount)}`),
              h(
                "span",
                { key: "status" },
                h("span", {
                  key: "chip",
                  className: `mov-chip ${row.status === "succeeded" ? "mov-chip-ok" : "mov-chip-bad"}`
                }, row.status === "succeeded" ? t("usageStatusOk") : t("usageStatusFailed"))
              )
            ]))
          ]) : null,
          usageAt ? h("span", { key: "updated-at", className: "mov-foot-note" }, t("quotaUpdatedAt", { time: usageAt })) : null,
          usageMessage ? h("span", { key: "message", className: "mov-hint" }, usageMessage) : null
        ]) : null;
        const updateAvailable = Boolean(updateLatest) && Boolean(PLUGIN_VERSION) && isNewerVersion(updateLatest, PLUGIN_VERSION);
        const updateText = updateStatus === "working" ? t("versionChecking") : updateStatus === "failed" ? updateMessage : updateStatus === "installing" ? t("versionUpdating") : updateStatus === "restart" || updateStatus === "applied" ? updateMessage : updateStatus === "ok" ? updateAvailable ? t("versionNew", { version: updateLatest }) : t("versionLatest") : "";
        const updateTone = updateStatus === "failed" ? TOKENS.error : updateStatus === "restart" || updateStatus === "applied" || updateAvailable ? TOKENS.success : TOKENS.muted;
        const versionBox = h("div", {
          key: "version",
          "data-field": "version",
          className: "mov-card"
        }, [
          h("div", { key: "head", className: "mov-card-head" }, [
            h("span", { key: "title", className: "mov-card-title" }, t("versionTitle")),
            h("span", {
              key: "current",
              "data-field": "versionCurrent",
              className: "mov-hint mov-current-version"
            }, [
              h("span", { key: "label" }, PLUGIN_VERSION ? t("versionCurrent", { version: PLUGIN_VERSION }) : ""),
              updateBell(t, updateLatest, PLUGIN_VERSION)
            ]),
            h("a", { key: "history", className: "mov-hint", href: "https://github.com/wxsimon2022/metaontic-video/blob/master/CHANGELOG.md", target: "_blank", rel: "noopener noreferrer" }, t("versionHistory")),
            h("button", {
              key: "check",
              "data-action": "update-check",
              type: "button",
              className: "mov-btn mov-btn-sm mov-trailing",
              disabled: updateStatus === "working" || updateStatus === "installing",
              onClick: () => {
                checkForUpdate(false).catch(() => {
                });
              }
            }, updateStatus === "working" ? t("versionChecking") : t("versionCheck"))
          ]),
          releaseNotes?.items?.length ? h("div", { key: "release-notes", "data-field": "releaseNotes" }, [
            h("div", { key: "heading", style: { display: "flex", alignItems: "baseline", gap: 12 } }, [
              h("span", { key: "title", className: "mov-card-title" }, `${releaseNotes.version} \xB7 ${t("releaseNotesTitle")}`),
              formatReleaseTime(releaseNotes.publishedAt) ? h("span", { key: "published-at", "data-field": "releasePublishedAt", className: "mov-foot-note" }, t("releaseUpdatedAt", { time: formatReleaseTime(releaseNotes.publishedAt) })) : null
            ]),
            h(
              "ul",
              { key: "items", style: { margin: "8px 0 0", paddingLeft: 18, fontSize: 12, lineHeight: 1.7, color: TOKENS.muted } },
              releaseNotes.items.map((item, index) => h("li", { key: index }, item))
            )
          ]) : null,
          updateText ? h("span", {
            key: "state",
            "data-field": "versionState",
            className: "mov-hint",
            style: { color: updateTone }
          }, updateText) : null,
          updateAvailable ? h("div", { key: "command", className: "mov-cmd-row" }, [
            // 点一下转成「确认更新」，再点一下让宿主重装本插件
            h("button", {
              key: "online",
              "data-action": "update-online",
              type: "button",
              className: "mov-btn mov-btn-sm mov-btn-primary",
              disabled: updateStatus === "installing",
              onClick: () => {
                if (updateConfirm) runOnlineUpdate().catch(() => {
                });
                else setUpdateConfirm(true);
              }
            }, updateStatus === "installing" ? t("versionUpdating") : updateConfirm ? t("versionUpdateConfirm", { version: updateLatest }) : t("versionUpdate"))
          ]) : null,
          updateAvailable && updateConfirm ? h("span", {
            key: "confirm-hint",
            "data-field": "updateConfirmHint",
            className: "mov-hint"
          }, t("versionUpdateConfirmHint")) : null,
          updateAvailable ? h("span", { key: "hint", className: "mov-hint" }, t("versionHint")) : null,
          updateStatus === "ok" && updateAt ? h("span", { key: "at", className: "mov-foot-note" }, t("versionCheckedAt", { time: updateAt })) : null
        ]);
        const registerBox = keyReady || !serviceMode ? null : h("div", {
          key: "register",
          className: "mov-card",
          style: { gap: 10 }
        }, [
          h("div", { key: "text", style: { display: "flex", flexDirection: "column", gap: 4 } }, [
            h(
              "span",
              { key: "title", className: "mov-card-title" },
              t("registerTitle")
            ),
            h("span", { key: "hint", className: "mov-hint" }, t("registerHint"))
          ]),
          h("div", { key: "form", className: "mov-register-form" }, [
            h("input", {
              key: "email",
              "data-field": "registerEmail",
              type: "text",
              className: "mov-input",
              value: registerEmail,
              placeholder: t("registerEmailPlaceholder"),
              "aria-label": t("registerEmail"),
              // 验证码已经发出去了：冷却期内不让改邮箱，免得「码发到 A、注册填 B」
              disabled: emailLocked,
              "data-locked": emailLocked ? "true" : "false",
              title: emailLocked ? t("registerEmailLocked") : void 0,
              onChange: (event) => setRegisterEmail(event.target.value),
              style: {
                ...inputStyle,
                flex: "1 1 220px",
                width: "auto",
                opacity: emailLocked ? 0.6 : 1,
                cursor: emailLocked ? "not-allowed" : "text"
              }
            }),
            h("button", {
              key: "code",
              "data-action": "send-code",
              type: "button",
              className: "mov-btn",
              disabled: codeStatus === "working" || codeCooldown > 0 || !registerEmail.trim(),
              onClick: () => {
                sendEmailCode().catch(() => {
                });
              }
            }, codeCooldown > 0 ? t("registerCodeCooldown", { seconds: codeCooldown }) : codeStatus === "working" ? t("registerCodeSending") : t("registerCodeSend")),
            h("input", {
              key: "code-input",
              "data-field": "registerCode",
              type: "text",
              inputMode: "numeric",
              className: "mov-input",
              value: registerCode,
              placeholder: t("registerCodePlaceholder"),
              "aria-label": t("registerCode"),
              onChange: (event) => setRegisterCode(event.target.value),
              style: { ...inputStyle, flex: "0 1 130px", width: "auto" }
            }),
            h("button", {
              key: "button",
              "data-action": "register",
              type: "button",
              className: "mov-btn mov-btn-primary",
              disabled: registerStatus === "working" || !registerEmail.trim() || !registerCode.trim() || snapshot.writable === false,
              onClick: register
            }, registerStatus === "working" ? t("registerWorking") : t("register"))
          ]),
          codeMessage ? h("span", {
            key: "code-message",
            "data-field": "codeMessage",
            style: {
              flex: "1 1 100%",
              fontSize: 12,
              color: codeStatus === "failed" ? TOKENS.error : TOKENS.success
            }
          }, codeMessage) : null,
          registerText ? h("span", {
            key: "message",
            style: { flex: "1 1 100%", fontSize: 12, color: registerMessageColors[registerStatus] || TOKENS.muted }
          }, registerText) : null
        ]);
        let notice = null;
        if (snapshot.status === "loading") notice = t("loading");
        else if (snapshot.value === void 0) notice = t("unavailable");
        else if (snapshot.writable === false) notice = t("readOnly");
        const blobs = notice && !snapshot.value ? [] : [footer, ...serviceMode ? [quotaBox, usageBox] : [], versionBox, resetRow];
        return h("div", { className: "mov-page" }, [
          // hover / focus 这类效果内联样式写不出来，集中在这张样式表里（class 都带 mov- 前缀）。
          h("style", { key: "styles" }, PAGE_CSS),
          !notice || snapshot.value ? renderUpdateNotice({
            h,
            t,
            available: updateAvailable,
            latest: updateLatest,
            deferred: updateDeferred,
            status: updateStatus,
            confirmed: updateConfirm,
            onUpdate: () => {
              if (updateConfirm) runOnlineUpdate().catch(() => {
              });
              else setUpdateConfirm(true);
            },
            onLater: deferUpdate
          }) : null,
          notice ? h("p", { key: "notice", className: "mov-notice" }, notice) : null,
          ...notice && !snapshot.value ? [] : settingsRows(),
          ...blobs,
          supportOpen ? h("dialog", {
            key: "support-dialog",
            ref: supportDialog,
            className: "mov-support-dialog",
            "aria-labelledby": "mov-support-title",
            onCancel: () => setSupportOpen(false),
            onClose: () => setSupportOpen(false),
            onClick: (event) => {
              if (event.target === event.currentTarget) {
                const rect = event.currentTarget.getBoundingClientRect();
                if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) setSupportOpen(false);
              }
            }
          }, h("div", { className: "mov-support-content" }, [
            h("div", { key: "heading", className: "mov-card-head" }, [
              h("strong", { key: "title", id: "mov-support-title" }, t("supportRecharge")),
              h("button", { key: "close", type: "button", className: "mov-btn mov-btn-sm mov-trailing", "aria-label": t("supportClose"), onClick: () => setSupportOpen(false) }, t("supportClose"))
            ]),
            h("p", { key: "hint", className: "mov-hint" }, t("supportScan")),
            h("iframe", { key: "qr", className: "mov-support-frame", title: t("supportRecharge"), src: "https://work.weixin.qq.com/ca/cawcde20e8080b7f6f", referrerPolicy: "no-referrer" }),
            h("a", { key: "fallback", href: "https://work.weixin.qq.com/ca/cawcde20e8080b7f6f", target: "_blank", rel: "noopener noreferrer" }, t("supportOpenPage"))
          ])) : null
        ]);
      };
    }
    return { makePage };
  }

  // src/client.ts
  window.__ModuleLoader__.load({
    id: "metaontic-video",
    factory(require2) {
      const React = require2("react");
      const h = React.createElement;
      const { TOKENS, inputStyle, PAGE_CSS } = createTheme();
      const { videoExecutionSource, VideoTaskProgress, VideoProgressDock } = createVideoProgress({ React, h, TOKENS });
      const { PLUGIN_OWNED_KEYS, DEFAULT_REGISTER_API, LOGGED_OUT_KEY, DEFAULT_REGISTER_TOKEN, SELECTS, optionLabel, FIELD_BY_KEY, SECTIONS, formatMoney, NS, NAMESPACE } = createClientConfig();
      const { zh, en } = createDictionaries();
      const { useSnapshot, same, validateSettings, persistConnection, persistBatch } = createSettingsState({ React });
      const { PLUGIN_VERSION, UPDATE_CACHE_KEY, UPDATE_MAX_AGE_MS, fetchLatestVersion, PLUGIN_PACKAGE, UPDATE_SPEC, UPDATE_ATTEMPTS, isNewerVersion, updateBell } = createUpdates({ h });
      const { makePage } = createSettingsPage({ useSnapshot, React, h, TOKENS, same, validateSettings, persistConnection, PLUGIN_OWNED_KEYS, persistBatch, DEFAULT_REGISTER_API, LOGGED_OUT_KEY, DEFAULT_REGISTER_TOKEN, PLUGIN_VERSION, UPDATE_CACHE_KEY, UPDATE_MAX_AGE_MS, fetchLatestVersion, SELECTS, inputStyle, optionLabel, FIELD_BY_KEY, SECTIONS, formatMoney, PLUGIN_PACKAGE, UPDATE_SPEC, UPDATE_ATTEMPTS, isNewerVersion, updateBell, PAGE_CSS });
      return {
        inject: ["slots", "locale", "configForms", "uiSession"],
        apply(ctx) {
          ctx.effect(() => ctx.uiSession.provide({
            hooks: ["videoExecutions"],
            resolve: (binding) => ({ hooks: { videoExecutions: videoExecutionSource(binding.eventSource) } })
          }), "metaontic-video: actual video execution");
          const t = ctx.locale.bind(NS);
          ctx.effect(() => ctx.locale.register(NS, { zh, en }), "metaontic-video: dictionaries");
          const form = ctx.configForms.get(NAMESPACE);
          for (const tool of ["video_generate", "video_extend", "video_status"]) {
            ctx.effect(
              () => ctx.slots.inject("tool.call.toolview", () => ctx.slots.register({ name: "tool.call.toolview", key: tool, locale: NS }, VideoTaskProgress)),
              `metaontic-video: ${tool} progress`
            );
          }
          ctx.effect(() => ctx.slots.inject("conversation.input.dock", () => ctx.slots.register(
            { name: "conversation.input.dock", id: "metaontic-video-progress", order: -20 },
            VideoProgressDock
          )), "metaontic-video: visible video progress");
          const pluginManager = () => {
            const tried = [];
            const shape = (value) => value === void 0 ? "undefined" : value === null ? "null" : typeof value;
            try {
              const direct = typeof ctx.get === "function" ? ctx.get("remote.pluginManager") : void 0;
              if (direct && typeof direct.installBundle === "function") return { manager: direct, tried };
              tried.push(`remote.pluginManager=${shape(direct)}`);
            } catch (error) {
              tried.push(`remote.pluginManager \u629B\u9519\uFF1A${error && error.message ? error.message : String(error)}`);
            }
            try {
              const remote = typeof ctx.get === "function" ? ctx.get("remote") : void 0;
              const nested = remote && remote.pluginManager;
              if (nested && typeof nested.installBundle === "function") return { manager: nested, tried };
              tried.push(`remote=${shape(remote)}`);
            } catch (error) {
              tried.push(`remote \u629B\u9519\uFF1A${error && error.message ? error.message : String(error)}`);
            }
            return { manager: null, tried };
          };
          const Page = makePage({ form, t, manager: pluginManager });
          ctx.effect(() => ctx.slots.inject("plugins.bundle.config", () => ctx.slots.register({
            name: "plugins.bundle.config",
            key: NAMESPACE,
            locale: NS
          }, Page)), "metaontic-video: configuration page");
        }
      };
    }
  });
})();
