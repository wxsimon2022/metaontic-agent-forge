/** 浏览器端 theme：由入口注入宿主 React 与共享依赖。 */
export function createTheme() {
const TOKENS = {
      text: 'var(--dsw-alias-label-primary, inherit)',
      muted: 'var(--dsw-alias-label-caption, #8886)',
      border: 'var(--dsw-alias-border-l2, #8884)',
      cardFill: 'var(--dsw-alias-settings-card-fill, transparent)',
      controlFill: 'var(--dsw-specific-input-major, transparent)',
      primaryFill: 'var(--dsw-alias-button-primary-fill, #247bbf)',
      error: 'var(--dsw-alias-state-error-primary, #d9534f)',
      success: 'var(--dsw-alias-state-success-primary, #2e9e5b)',
    };

    // 控件的外观（边框 / 圆角 / 高度 / 聚焦圈）统一放进 PAGE_CSS 的 .metaontic-agent-forge-input，
    // 内联样式只留布局（宽度），免得改一处样式要在两处同步。
    const inputStyle = { width: '100%', boxSizing: 'border-box' };

    /**
     * 页面静态样式：能 hover / focus 的效果（按钮、表格行、输入聚焦圈）内联样式表达不了，
     * 所以集中在这张表里；class 统一 metaontic-agent-forge- 前缀，避免和宿主其他插件串味。
     */
    const PAGE_CSS = `
      /* 整页纵向排布：块与块之间统一 16px，比一整片表单好扫 */
      .metaontic-agent-forge-page { display: flex; flex-direction: column; gap: 16px; padding: 4px 0; color: ${TOKENS.text}; }
      /* 分组卡片：16 个字段摊在一格里太糊，按用途各装一张卡 */
      .metaontic-agent-forge-section { display: flex; flex-direction: column; gap: 14px; padding: 14px 16px 16px; border-radius: 12px; border: 1px solid ${TOKENS.border}; background: ${TOKENS.cardFill}; }
      .metaontic-agent-forge-advanced { display: block; }
      .metaontic-agent-forge-advanced-toggle { cursor: pointer; font-size: 13px; font-weight: 600; color: ${TOKENS.text}; }
      .metaontic-agent-forge-advanced-toggle .metaontic-agent-forge-hint { display: block; margin: 5px 0 0 16px; font-weight: 400; }
      .metaontic-agent-forge-advanced-toggle:focus-visible { outline: 2px solid ${TOKENS.primaryFill}; outline-offset: 5px; border-radius: 4px; }
      .metaontic-agent-forge-advanced-body { display: flex; flex-direction: column; gap: 18px; border-top: 1px solid ${TOKENS.border}; margin-top: 14px; padding-top: 16px; }
      .metaontic-agent-forge-advanced-body .metaontic-agent-forge-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px 18px; align-items: start; }
      .metaontic-agent-forge-advanced-body .metaontic-agent-forge-field-wide { grid-column: auto; }
      .metaontic-agent-forge-advanced-group { display: flex; flex-direction: column; gap: 12px; min-width: 0; }
      .metaontic-agent-forge-advanced-group + .metaontic-agent-forge-advanced-group { border-top: 1px solid ${TOKENS.border}; padding-top: 16px; }
      .metaontic-agent-forge-advanced-group .metaontic-agent-forge-label { min-height: 30px; display: flex; align-items: flex-end; }
      .metaontic-agent-forge-advanced-tools .metaontic-agent-forge-grid { grid-template-columns: minmax(0, 1fr); }
      .metaontic-agent-forge-advanced-tools .metaontic-agent-forge-label { min-height: 0; }
      .metaontic-agent-forge-advanced-group[data-group="advancedPicture"] .metaontic-agent-forge-grid { grid-template-columns: minmax(0, 1fr); }
      .metaontic-agent-forge-advanced-group[data-group="advancedPicture"] .metaontic-agent-forge-switch { justify-content: space-between; flex-direction: row-reverse; }

      @container (max-width: 480px) { .metaontic-agent-forge-advanced-body .metaontic-agent-forge-grid { grid-template-columns: minmax(0, 1fr); } .metaontic-agent-forge-advanced-group .metaontic-agent-forge-label { min-height: 0; } }
      .metaontic-agent-forge-advanced { container-type: inline-size; }
      .metaontic-agent-forge-section-title { display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 600; color: ${TOKENS.text}; }
      /* 标题左边一道主色竖条，代替纯文字分组标题 */
      .metaontic-agent-forge-section-title::before { content: ""; flex: 0 0 auto; width: 3px; height: 13px; border-radius: 2px; background: ${TOKENS.primaryFill}; }
      .metaontic-agent-forge-section-title::after { content: ""; flex: 1 1 auto; height: 1px; background: ${TOKENS.border}; }
      /* 两列自适应：单列至少 240px，窄面板自动落成一列 */
      .metaontic-agent-forge-parameter-group { container-type: inline-size; display: flex; flex-direction: column; gap: 12px; min-width: 0; }
      .metaontic-agent-forge-parameter-group + .metaontic-agent-forge-parameter-group { border-top: 1px solid ${TOKENS.border}; padding-top: 16px; }
      .metaontic-agent-forge-parameter-heading { font-size: 12px; font-weight: 600; color: ${TOKENS.muted}; }
      .metaontic-agent-forge-parameter-group .metaontic-agent-forge-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); align-items: start; }
      @container (max-width: 480px) { .metaontic-agent-forge-parameter-group .metaontic-agent-forge-grid { grid-template-columns: minmax(0, 1fr); } }
      .metaontic-agent-forge-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 240px), 1fr)); gap: 14px 18px; }
      .metaontic-agent-forge-field { display: flex; flex-direction: column; min-width: 0; }
      .metaontic-agent-forge-model-settings { display: flex; flex-direction: column; gap: 14px; min-width: 0; }
      .metaontic-agent-forge-model-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
      .metaontic-agent-forge-model-grid-single { grid-template-columns: minmax(0, 1fr); }
      .metaontic-agent-forge-model-card { display: flex; flex-direction: column; gap: 14px; padding: 12px; border: 1px solid ${TOKENS.border}; border-radius: 10px; min-width: 0; }
      .metaontic-agent-forge-parameter-group > .metaontic-agent-forge-card { border: 0; padding: 0; background: transparent; }
      @container (max-width: 600px) { .metaontic-agent-forge-model-grid { grid-template-columns: minmax(0, 1fr); } }

      .metaontic-agent-forge-av-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
      .metaontic-agent-forge-av-card { display: flex; flex-direction: column; min-width: 0; padding: 12px; gap: 8px; border: 1px solid ${TOKENS.border}; border-radius: 10px; background: ${TOKENS.cardFill}; }
      .metaontic-agent-forge-av-card > .metaontic-agent-forge-label { margin-bottom: -2px; }
      .metaontic-agent-forge-av-card .metaontic-agent-forge-hint { margin-top: auto; }
      .metaontic-agent-forge-av-audio .metaontic-agent-forge-switch { justify-content: space-between; gap: 12px; padding: 0; border: 0; background: transparent; }
      .metaontic-agent-forge-av-audio .metaontic-agent-forge-switch span { order: 0; }
      .metaontic-agent-forge-av-audio .metaontic-agent-forge-switch input { appearance: none; order: 1; flex: 0 0 34px; width: 34px; height: 20px; margin: 0; border: 1px solid ${TOKENS.border}; border-radius: 999px; background: ${TOKENS.border}; position: relative; transition: background .15s; }
      .metaontic-agent-forge-av-audio .metaontic-agent-forge-switch input::after { content: ''; position: absolute; width: 14px; height: 14px; left: 2px; top: 2px; border-radius: 50%; background: white; transition: transform .15s; }
      .metaontic-agent-forge-av-audio .metaontic-agent-forge-switch input:checked { background: ${TOKENS.primaryFill}; border-color: ${TOKENS.primaryFill}; }
      .metaontic-agent-forge-av-audio .metaontic-agent-forge-switch input:checked::after { transform: translateX(14px); }
      .metaontic-agent-forge-av-audio .metaontic-agent-forge-switch input:focus-visible { outline: 2px solid ${TOKENS.primaryFill}; outline-offset: 3px; }
      @container (max-width: 480px) { .metaontic-agent-forge-av-grid { grid-template-columns: minmax(0, 1fr); } }
      @media (prefers-reduced-motion: reduce) { .metaontic-agent-forge-av-audio .metaontic-agent-forge-switch input, .metaontic-agent-forge-av-audio .metaontic-agent-forge-switch input::after { transition: none; } }

      /* 开关没有标签行，靠底对齐才能跟旁边输入框的控制线齐平 */
      .metaontic-agent-forge-field-switch { justify-content: flex-end; }
      .metaontic-agent-forge-field-wide { grid-column: 1 / -1; }
      .metaontic-agent-forge-label { display: block; font-size: 12px; color: ${TOKENS.muted}; margin-bottom: 6px; }
      .metaontic-agent-forge-input { padding: 8px 10px; border-radius: 8px; border: 1px solid ${TOKENS.border}; background: ${TOKENS.controlFill}; color: ${TOKENS.text}; font: inherit; font-size: 13px; height: 36px; }
      .metaontic-agent-forge-key-control { position: relative; min-width: 0; }
      .metaontic-agent-forge-key-control .metaontic-agent-forge-input { padding-right: 40px; }
      .metaontic-agent-forge-key-eye { position: absolute; right: 4px; top: 50%; transform: translateY(-50%); width: 30px; height: 28px; display: flex; align-items: center; justify-content: center; padding: 0; border: 0; border-radius: 5px; background: transparent; color: ${TOKENS.muted}; cursor: pointer; }
      .metaontic-agent-forge-key-eye:hover { color: ${TOKENS.text}; background: ${TOKENS.border}; }
      .metaontic-agent-forge-key-eye:focus-visible { outline: 2px solid ${TOKENS.primaryFill}; outline-offset: 1px; }
      .metaontic-agent-forge-input:focus, .metaontic-agent-forge-input:focus-visible { outline: none; border-color: ${TOKENS.primaryFill}; box-shadow: 0 0 0 3px rgba(36, 123, 191, .18); }
      /* 模型 ID 与可执行文件路径很长：等宽字体 + 省略，不把整行撑变形 */
      .metaontic-agent-forge-mono { font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace; font-size: 12.5px; }
      /* 开关做成跟输入框同高的小方块，和周围控件一条线 */
      .metaontic-agent-forge-switch { display: flex; align-items: center; gap: 8px; padding: 0 10px; height: 36px; box-sizing: border-box; border: 1px solid ${TOKENS.border}; border-radius: 8px; background: ${TOKENS.controlFill}; font-size: 13px; color: ${TOKENS.text}; cursor: pointer; }
      .metaontic-agent-forge-switch:hover { border-color: ${TOKENS.primaryFill}; }
      .metaontic-agent-forge-switch input { width: 15px; height: 15px; accent-color: ${TOKENS.primaryFill}; cursor: pointer; }
      .metaontic-agent-forge-card { display: flex; flex-direction: column; gap: 10px; padding: 14px 16px; border-radius: 12px; border: 1px solid ${TOKENS.border}; background: ${TOKENS.cardFill}; }
      .metaontic-agent-forge-current-version { display: inline-flex; align-items: center; gap: 6px; flex: 1 1 120px; }
      .metaontic-agent-forge-update-bell { display: inline-flex; flex: 0 0 auto; color: ${TOKENS.primaryFill}; transform-origin: 50% 10%; animation: metaontic-agent-forge-bell-swing 1.6s ease-in-out infinite; }
      @keyframes metaontic-agent-forge-bell-swing { 0%, 60%, 100% { transform: rotate(0deg); } 10%, 30% { transform: rotate(-18deg); } 20%, 40% { transform: rotate(18deg); } 50% { transform: rotate(-8deg); } }
      @media (prefers-reduced-motion: reduce) { .metaontic-agent-forge-update-bell { animation: none; } }
      .metaontic-agent-forge-card-head { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
      .metaontic-agent-forge-card-title { font-size: 13px; font-weight: 600; color: ${TOKENS.text}; }
      .metaontic-agent-forge-hint { font-size: 12px; color: ${TOKENS.muted}; line-height: 1.5; }
      .metaontic-agent-forge-btn { display: inline-flex; align-items: center; justify-content: center; gap: 6px; box-sizing: border-box; flex: 0 0 120px; width: 120px; min-width: 120px; height: 36px; min-height: 36px; padding: 4px 10px; border-radius: 8px; border: 1px solid ${TOKENS.border}; background: transparent; color: ${TOKENS.text}; font: inherit; font-size: 12px; line-height: 1.2; text-align: center; cursor: pointer; white-space: normal; overflow-wrap: anywhere; transition: background .15s, border-color .15s, color .15s, opacity .15s; }
      .metaontic-agent-forge-btn:hover:not(:disabled) { border-color: ${TOKENS.primaryFill}; color: ${TOKENS.primaryFill}; }
      .metaontic-agent-forge-btn:disabled { opacity: .5; cursor: default; }
      .metaontic-agent-forge-btn-primary { border-color: ${TOKENS.primaryFill}; background: ${TOKENS.primaryFill}; color: #fff; font-weight: 600; }
      .metaontic-agent-forge-btn-primary:hover:not(:disabled) { color: #fff; opacity: .88; }
      .metaontic-agent-forge-quota-actions { display: flex; gap: 8px; flex: 0 0 auto; }
      .metaontic-agent-forge-support-dialog { width: min(420px, calc(100vw - 32px)); max-height: calc(100vh - 32px); padding: 0; border: 1px solid ${TOKENS.border}; border-radius: 12px; color: ${TOKENS.text}; background: ${TOKENS.cardFill}; overflow: auto; }
      .metaontic-agent-forge-support-dialog::backdrop { background: rgba(0, 0, 0, .45); }
      .metaontic-agent-forge-support-content { padding: 16px; display: flex; flex-direction: column; gap: 12px; }
      .metaontic-agent-forge-support-content p { margin: 0; }
      .metaontic-agent-forge-support-frame { width: 100%; height: min(480px, 62vh); border: 0; border-radius: 8px; background: white; }
      .metaontic-agent-forge-trailing { margin-left: auto; }
      /* 额度：三个数字块，一眼分清剩余 / 已用 / 总额度 */
      .metaontic-agent-forge-quota-compact { padding: 8px 12px; gap: 10px 14px; flex-direction: row; align-items: center; flex-wrap: wrap; }
      .metaontic-agent-forge-quota-compact .metaontic-agent-forge-card-head { min-height: 24px; flex: 0 0 auto; gap: 8px; }
      .metaontic-agent-forge-quota-compact .metaontic-agent-forge-stats { display: flex; flex: 1 1 auto; flex-wrap: wrap; gap: 8px 16px; min-width: 0; }
      .metaontic-agent-forge-quota-compact .metaontic-agent-forge-stat { flex-direction: row; align-items: baseline; justify-content: space-between; gap: 6px; padding: 0; border: 0; border-radius: 0; white-space: nowrap; }
      .metaontic-agent-forge-quota-compact .metaontic-agent-forge-stat-label { font-size: 11px; white-space: nowrap; }
      .metaontic-agent-forge-quota-compact .metaontic-agent-forge-stat-value { font-size: 14px; }
      .metaontic-agent-forge-quota-compact .metaontic-agent-forge-foot-note { font-size: 10px; white-space: nowrap; flex: 0 0 auto; }
      .metaontic-agent-forge-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 10px; }
      .metaontic-agent-forge-stat { display: flex; flex-direction: column; gap: 4px; padding: 10px 12px; border-radius: 10px; border: 1px solid ${TOKENS.border}; }
      .metaontic-agent-forge-stat-label { font-size: 11.5px; color: ${TOKENS.muted}; }
      .metaontic-agent-forge-stat-value { font-size: 16px; font-weight: 600; font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
      .metaontic-agent-forge-foot-note { font-size: 11.5px; color: ${TOKENS.muted}; }
      /* ffmpeg 安装命令：一行等宽、可复制，不用撑满整行 */
      .metaontic-agent-forge-cmd-row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
      .metaontic-agent-forge-tag { flex: 0 0 auto; min-width: 132px; font-size: 12px; color: ${TOKENS.muted}; }
      .metaontic-agent-forge-code { flex: 0 0 auto; max-width: 100%; padding: 6px 10px; border-radius: 8px; border: 1px solid ${TOKENS.border}; background: ${TOKENS.controlFill}; font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace; font-size: 12px; white-space: pre-wrap; word-break: break-all; }
      /* 使用记录：斑马纹 + 细表头，模型列吃掉剩余宽度 */
      /* 面板很窄时表格横向滚动，也不把「时间」挤成两行 */
      .metaontic-agent-forge-table { display: flex; flex-direction: column; margin: 0 -6px; overflow-x: auto; }
      .metaontic-agent-forge-table-head, .metaontic-agent-forge-table-row { display: grid; grid-template-columns: 106px 78px minmax(72px, 1fr) 84px 60px; align-items: center; gap: 10px; padding: 8px 10px; }
      .metaontic-agent-forge-table-head > :nth-child(1), .metaontic-agent-forge-table-row > :nth-child(1) { white-space: nowrap; }
      .metaontic-agent-forge-table-head { font-size: 11px; letter-spacing: .03em; color: ${TOKENS.muted}; border-bottom: 1px solid ${TOKENS.border}; }
      .metaontic-agent-forge-table-row { font-size: 12.5px; border-radius: 8px; }
      .metaontic-agent-forge-table-row:nth-child(even) { background: rgba(127, 127, 127, .05); }
      .metaontic-agent-forge-table-row:hover { background: rgba(127, 127, 127, .1); }
      /* 费用与结果两列右对齐，数字竖着对得齐 */
      .metaontic-agent-forge-table-head > :nth-child(4), .metaontic-agent-forge-table-row > :nth-child(4),
      .metaontic-agent-forge-table-head > :nth-child(5), .metaontic-agent-forge-table-row > :nth-child(5) { text-align: right; }
      .metaontic-agent-forge-model { min-width: 0; overflow: hidden; color: ${TOKENS.muted}; white-space: nowrap; text-overflow: ellipsis; font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace; }
      .metaontic-agent-forge-num { font-variant-numeric: tabular-nums; }
      /* 结果用胶囊标签，比裸文字更容易一眼扫到 */
      .metaontic-agent-forge-chip { display: inline-flex; align-items: center; justify-content: center; padding: 1px 8px; border-radius: 999px; font-size: 11.5px; line-height: 1.7; }
      .metaontic-agent-forge-chip-ok { color: ${TOKENS.success}; background: rgba(46, 158, 91, .12); }
      .metaontic-agent-forge-chip-bad { color: ${TOKENS.error}; background: rgba(217, 83, 79, .12); }
      /* 注册表单：输入框吃掉多余宽度，两个按钮不换行 */
      .metaontic-agent-forge-register-form { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
      /* 底部操作条：上边线把「保存」和配置内容分开 */
      .metaontic-agent-forge-footer { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; padding: 12px 2px 2px; border-top: 1px solid ${TOKENS.border}; }
      .metaontic-agent-forge-notice { margin: 0; font-size: 12px; color: ${TOKENS.muted}; line-height: 1.5; }
    `;
  return { TOKENS, inputStyle, PAGE_CSS };
}
