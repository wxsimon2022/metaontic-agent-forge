(() => {
  // src/client/agent-picker.ts
  var INTERNAL_AGENTS = /* @__PURE__ */ new Set([
    "metaontic-agent-forge-video-director",
    "metaontic-agent-forge-promo-video"
  ]);
  function createAgentPickerView(h, Original, hook, field) {
    const cache = /* @__PURE__ */ new WeakMap();
    const project = (state) => {
      if (!state || !Array.isArray(state[field])) return state;
      if (cache.has(state)) return cache.get(state);
      const rows = state[field].filter((row) => !INTERNAL_AGENTS.has(row.id));
      const result = rows.length === state[field].length ? state : { ...state, [field]: rows };
      cache.set(state, result);
      return result;
    };
    return function AgentPickerView(props) {
      const source = props[hook];
      if (typeof source !== "function") return h(Original, props);
      return h(Original, { ...props, [hook]: (select) => source((state) => select(project(state))) });
    };
  }
  function registerAgentPicker(ctx, h) {
    if (typeof ctx.slots.entries !== "function" || typeof ctx.slots.subscribe !== "function") return;
    const wrappers = /* @__PURE__ */ new WeakSet();
    for (const spec of [
      { name: "conversation.hero.agentPreset", hook: "useAgentPresetSeat", field: "options" },
      { name: "settings.section", id: "agent-presets", hook: "useAgentPresetSection", field: "rows" }
    ]) {
      ctx.effect(() => ctx.slots.inject(spec.name, () => {
        let original, dispose, syncing = false;
        const sync = () => {
          if (syncing) return;
          syncing = true;
          try {
            const next = ctx.slots.entries(spec.name).filter((entry) => entry.component && !wrappers.has(entry.component) && (!spec.id || entry.options?.id === spec.id)).sort((a, b) => (a.options?.priority || 0) - (b.options?.priority || 0))[0];
            if (next === original) return;
            dispose?.();
            dispose = void 0;
            original = next;
            if (!next) return;
            const Component = createAgentPickerView(h, next.component, spec.hook, spec.field);
            wrappers.add(Component);
            dispose = ctx.slots.register({
              ...next.options,
              name: spec.name,
              priority: (next.options?.priority || 0) - 1,
              locale: next.locale,
              inject: next.inject,
              select: next.select,
              store: next.store,
              children: next.children
            }, Component);
          } finally {
            syncing = false;
          }
        };
        const unsubscribe = ctx.slots.subscribe(spec.name, sync);
        try {
          sync();
        } catch (error) {
          unsubscribe();
          dispose?.();
          throw error;
        }
        return () => {
          unsubscribe();
          dispose?.();
        };
      }), `metaontic-agent-forge: ${spec.name} selector`);
    }
  }

  // src/client/infinite-canvas.ts
  var FORGE_CANVAS_KIND = "metaontic-infinite-canvas";
  function registerInfiniteCanvas(ctx, React) {
    if (typeof ctx.inject !== "function") return;
    const h = React.createElement;
    const statusUrl = "/api/metaontic-agent-forge.canvas";
    const start = () => fetch("/api/metaontic-agent-forge.canvas-start", { method: "POST" }).then((response) => response.json());
    const get = () => fetch(statusUrl).then((response) => {
      if (!response.ok) throw new Error("\u753B\u5E03\u8FDE\u63A5\u6682\u65F6\u4E0D\u53EF\u7528\u3002");
      return response.json();
    });
    function CanvasFrame() {
      const [info, setInfo] = React.useState(null), [error, setError] = React.useState("");
      React.useEffect(() => {
        let active = true;
        const update = () => get().then((value) => {
          if (active) setInfo(value);
        }).catch(() => {
          if (active) setError("\u753B\u5E03\u8FDE\u63A5\u6682\u65F6\u4E0D\u53EF\u7528\uFF0C\u8BF7\u91CD\u8BD5\u3002");
        });
        start().then(update).catch(() => {
          if (active) setError("\u753B\u5E03\u542F\u52A8\u5931\u8D25\uFF0C\u8BF7\u91CD\u8BD5\u3002");
        });
        const timer = setInterval(update, 1500);
        return () => {
          active = false;
          clearInterval(timer);
        };
      }, []);
      const requested = info?.requested;
      const src = info?.ready ? info.origin + (requested ? "/canvas/" + requested.id + "?title=" + encodeURIComponent(requested.title) : "/") : "";
      return h("div", { style: { display: "flex", flexDirection: "column", height: "100%", minHeight: 0 } }, [
        h("div", { key: "bar", style: { display: "flex", gap: 8, alignItems: "center", padding: 8, fontSize: 12 } }, [
          h("strong", { key: "title" }, "\u521B\u4F5C\u753B\u5E03"),
          h("span", { key: "state" }, info?.ready ? "\u5DF2\u8FDE\u63A5 \xB7 Haitang-Hub" : "\u6B63\u5728\u8FDE\u63A5"),
          h("button", { key: "retry", type: "button", onClick: () => {
            setError("");
            start().then(setInfo).catch(() => setError("\u753B\u5E03\u542F\u52A8\u5931\u8D25\uFF0C\u8BF7\u91CD\u8BD5\u3002"));
          } }, "\u91CD\u65B0\u8FDE\u63A5")
        ]),
        src ? h("iframe", { key: src, src, title: "\u4E91\u667A\u5DE5\u574A\u65E0\u9650\u753B\u5E03", sandbox: "allow-scripts allow-same-origin allow-downloads", style: { flex: 1, width: "100%", border: 0, minHeight: 0 }, "data-dsh-no-drag": "" }) : h("p", { key: "empty", role: "status", style: { padding: 16 } }, info?.error || error || "\u6B63\u5728\u542F\u52A8\u672C\u5730\u753B\u5E03\u670D\u52A1\uFF0C\u9879\u76EE\u6570\u636E\u4F1A\u4FDD\u7559\u3002")
      ]);
    }
    ctx.effect(() => ctx.inject(["sidebarRightTabs", "sidebarRight"], (right) => {
      const disposers = [
        right.sidebarRightTabs.register({ id: FORGE_CANVAS_KIND, kind: FORGE_CANVAS_KIND, title: () => "\u521B\u4F5C\u753B\u5E03", guide: [{ order: 31, title: () => "\u4E91\u667A\u5DE5\u574A\u753B\u5E03", description: () => "\u7F16\u6392\u521B\u610F\u3001\u5206\u955C\u548C\u5DF2\u6709\u7D20\u6750\uFF0C\u4E0E\u4EFB\u52A1\u5BF9\u8BDD\u5E76\u6392\u4F7F\u7528\u3002" }] }),
        right.slots.inject("sidebar.right.pane.tab", () => right.slots.register({ name: "sidebar.right.pane.tab", key: FORGE_CANVAS_KIND }, CanvasFrame))
      ];
      let disposed = false, last = "";
      const timer = setInterval(() => {
        get().then((value) => {
          if (disposed || !value.ready || !value.requested || last === value.requested.id + ":" + value.requested.sequence) return;
          right.sidebarRight.openTab(FORGE_CANVAS_KIND);
          last = value.requested.id + ":" + value.requested.sequence;
        }).catch(() => {
        });
      }, 1500);
      return () => {
        disposed = true;
        clearInterval(timer);
        disposers.forEach((dispose) => {
          if (typeof dispose === "function") dispose();
        });
      };
    }), "forge: infinite canvas");
  }

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
      .metaontic-agent-forge-page { display: flex; flex-direction: column; gap: 16px; padding: 4px 0; color: ${TOKENS.text}; }
      /* \u5206\u7EC4\u5361\u7247\uFF1A16 \u4E2A\u5B57\u6BB5\u644A\u5728\u4E00\u683C\u91CC\u592A\u7CCA\uFF0C\u6309\u7528\u9014\u5404\u88C5\u4E00\u5F20\u5361 */
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
      /* \u6807\u9898\u5DE6\u8FB9\u4E00\u9053\u4E3B\u8272\u7AD6\u6761\uFF0C\u4EE3\u66FF\u7EAF\u6587\u5B57\u5206\u7EC4\u6807\u9898 */
      .metaontic-agent-forge-section-title::before { content: ""; flex: 0 0 auto; width: 3px; height: 13px; border-radius: 2px; background: ${TOKENS.primaryFill}; }
      .metaontic-agent-forge-section-title::after { content: ""; flex: 1 1 auto; height: 1px; background: ${TOKENS.border}; }
      /* \u4E24\u5217\u81EA\u9002\u5E94\uFF1A\u5355\u5217\u81F3\u5C11 240px\uFF0C\u7A84\u9762\u677F\u81EA\u52A8\u843D\u6210\u4E00\u5217 */
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

      /* \u5F00\u5173\u6CA1\u6709\u6807\u7B7E\u884C\uFF0C\u9760\u5E95\u5BF9\u9F50\u624D\u80FD\u8DDF\u65C1\u8FB9\u8F93\u5165\u6846\u7684\u63A7\u5236\u7EBF\u9F50\u5E73 */
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
      /* \u6A21\u578B ID \u4E0E\u53EF\u6267\u884C\u6587\u4EF6\u8DEF\u5F84\u5F88\u957F\uFF1A\u7B49\u5BBD\u5B57\u4F53 + \u7701\u7565\uFF0C\u4E0D\u628A\u6574\u884C\u6491\u53D8\u5F62 */
      .metaontic-agent-forge-mono { font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace; font-size: 12.5px; }
      /* \u5F00\u5173\u505A\u6210\u8DDF\u8F93\u5165\u6846\u540C\u9AD8\u7684\u5C0F\u65B9\u5757\uFF0C\u548C\u5468\u56F4\u63A7\u4EF6\u4E00\u6761\u7EBF */
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
      /* \u989D\u5EA6\uFF1A\u4E09\u4E2A\u6570\u5B57\u5757\uFF0C\u4E00\u773C\u5206\u6E05\u5269\u4F59 / \u5DF2\u7528 / \u603B\u989D\u5EA6 */
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
      /* ffmpeg \u5B89\u88C5\u547D\u4EE4\uFF1A\u4E00\u884C\u7B49\u5BBD\u3001\u53EF\u590D\u5236\uFF0C\u4E0D\u7528\u6491\u6EE1\u6574\u884C */
      .metaontic-agent-forge-cmd-row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
      .metaontic-agent-forge-tag { flex: 0 0 auto; min-width: 132px; font-size: 12px; color: ${TOKENS.muted}; }
      .metaontic-agent-forge-code { flex: 0 0 auto; max-width: 100%; padding: 6px 10px; border-radius: 8px; border: 1px solid ${TOKENS.border}; background: ${TOKENS.controlFill}; font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace; font-size: 12px; white-space: pre-wrap; word-break: break-all; }
      /* \u4F7F\u7528\u8BB0\u5F55\uFF1A\u6591\u9A6C\u7EB9 + \u7EC6\u8868\u5934\uFF0C\u6A21\u578B\u5217\u5403\u6389\u5269\u4F59\u5BBD\u5EA6 */
      /* \u9762\u677F\u5F88\u7A84\u65F6\u8868\u683C\u6A2A\u5411\u6EDA\u52A8\uFF0C\u4E5F\u4E0D\u628A\u300C\u65F6\u95F4\u300D\u6324\u6210\u4E24\u884C */
      .metaontic-agent-forge-table { display: flex; flex-direction: column; margin: 0 -6px; overflow-x: auto; }
      .metaontic-agent-forge-table-head, .metaontic-agent-forge-table-row { display: grid; grid-template-columns: 106px 78px minmax(72px, 1fr) 84px 60px; align-items: center; gap: 10px; padding: 8px 10px; }
      .metaontic-agent-forge-table-head > :nth-child(1), .metaontic-agent-forge-table-row > :nth-child(1) { white-space: nowrap; }
      .metaontic-agent-forge-table-head { font-size: 11px; letter-spacing: .03em; color: ${TOKENS.muted}; border-bottom: 1px solid ${TOKENS.border}; }
      .metaontic-agent-forge-table-row { font-size: 12.5px; border-radius: 8px; }
      .metaontic-agent-forge-table-row:nth-child(even) { background: rgba(127, 127, 127, .05); }
      .metaontic-agent-forge-table-row:hover { background: rgba(127, 127, 127, .1); }
      /* \u8D39\u7528\u4E0E\u7ED3\u679C\u4E24\u5217\u53F3\u5BF9\u9F50\uFF0C\u6570\u5B57\u7AD6\u7740\u5BF9\u5F97\u9F50 */
      .metaontic-agent-forge-table-head > :nth-child(4), .metaontic-agent-forge-table-row > :nth-child(4),
      .metaontic-agent-forge-table-head > :nth-child(5), .metaontic-agent-forge-table-row > :nth-child(5) { text-align: right; }
      .metaontic-agent-forge-model { min-width: 0; overflow: hidden; color: ${TOKENS.muted}; white-space: nowrap; text-overflow: ellipsis; font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace; }
      .metaontic-agent-forge-num { font-variant-numeric: tabular-nums; }
      /* \u7ED3\u679C\u7528\u80F6\u56CA\u6807\u7B7E\uFF0C\u6BD4\u88F8\u6587\u5B57\u66F4\u5BB9\u6613\u4E00\u773C\u626B\u5230 */
      .metaontic-agent-forge-chip { display: inline-flex; align-items: center; justify-content: center; padding: 1px 8px; border-radius: 999px; font-size: 11.5px; line-height: 1.7; }
      .metaontic-agent-forge-chip-ok { color: ${TOKENS.success}; background: rgba(46, 158, 91, .12); }
      .metaontic-agent-forge-chip-bad { color: ${TOKENS.error}; background: rgba(217, 83, 79, .12); }
      /* \u6CE8\u518C\u8868\u5355\uFF1A\u8F93\u5165\u6846\u5403\u6389\u591A\u4F59\u5BBD\u5EA6\uFF0C\u4E24\u4E2A\u6309\u94AE\u4E0D\u6362\u884C */
      .metaontic-agent-forge-register-form { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
      /* \u5E95\u90E8\u64CD\u4F5C\u6761\uFF1A\u4E0A\u8FB9\u7EBF\u628A\u300C\u4FDD\u5B58\u300D\u548C\u914D\u7F6E\u5185\u5BB9\u5206\u5F00 */
      .metaontic-agent-forge-footer { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; padding: 12px 2px 2px; border-top: 1px solid ${TOKENS.border}; }
      .metaontic-agent-forge-notice { margin: 0; font-size: 12px; color: ${TOKENS.muted}; line-height: 1.5; }
    `;
    return { TOKENS, inputStyle, PAGE_CSS };
  }

  // src/client/task-canvas.ts
  var AGENTS = /* @__PURE__ */ new Set(["metaontic-agent-forge-studio", "metaontic-agent-forge-video-director", "metaontic-agent-forge-promo-video"]);
  function taskGraph(snapshot = {}, statuses = /* @__PURE__ */ new Map()) {
    const summaries = snapshot.byId || {};
    const projections = snapshot.projectionsBySession || {};
    const values = (id) => ({ ...summaries[id]?.projectionValues, ...projections[id]?.values });
    const nodes = /* @__PURE__ */ new Map(), edges = [];
    const insert = (id, entry, parent) => {
      const summary = summaries[id];
      const value = values(id), live = statuses?.get?.(id);
      const pending = live?.pendingInteraction;
      const state = pending ? "waiting" : (live?.running ?? summary?.running) === true ? "running" : value.subagentTiming?.lastTurnCompleted === true ? "turn-ended" : "idle";
      nodes.set(id, {
        id,
        title: summary?.title || entry?.label || id,
        preset: value.agentPreset,
        state,
        pending: pending?.kind || pending?.type,
        parent,
        address: parent ? { parentSessionId: parent, childSessionId: id, mode: entry?.mode || "unknown" } : id,
        external: entry?.mode === "external",
        projectionState: projections[id]?.state
      });
    };
    for (const [id] of Object.entries(summaries)) if (AGENTS.has(values(id).agentPreset)) insert(id);
    const visited = /* @__PURE__ */ new Set();
    const visit = (id) => {
      if (visited.has(id)) return;
      visited.add(id);
      for (const entry of values(id).subagentCatalog || []) {
        if (!entry?.id || entry.id === id || visited.has(entry.id)) continue;
        insert(entry.id, entry, id);
        edges.push({ from: id, to: entry.id });
        visit(entry.id);
      }
    };
    for (const id of [...nodes.keys()]) visit(id);
    const children = new Set(edges.map((edge) => edge.to));
    return { nodes: [...nodes.values()], edges, roots: [...nodes.keys()].filter((id) => !children.has(id)) };
  }
  function createTaskCanvas({ React, h, t }) {
    return function TaskCanvas({ useSessions, useSessionStatus, openTask, refreshTask }) {
      const snapshot = useSessions((state) => state);
      const statuses = useSessionStatus((state) => state);
      const graph = React.useMemo(() => taskGraph(snapshot, statuses), [snapshot, statuses]);
      const [chosenRoot, chooseRoot] = React.useState("");
      const [chosenNode, chooseNode] = React.useState("");
      const [zoom, setZoom] = React.useState(1);
      const root = graph.roots.includes(chosenRoot) ? chosenRoot : graph.roots[0];
      const shown = /* @__PURE__ */ new Set();
      const walk = (id) => {
        if (shown.has(id)) return;
        shown.add(id);
        for (const edge of graph.edges) if (edge.from === id) walk(edge.to);
      };
      if (root) walk(root);
      const nodes = graph.nodes.filter((node) => shown.has(node.id));
      const selected = nodes.find((node) => node.id === chosenNode) || nodes[0];
      React.useEffect(() => {
        if (root) refreshTask?.(root);
      }, [root, refreshTask]);
      if (!graph.roots.length) return h("section", { className: "metaontic-agent-forge-section", "aria-label": t("canvasTitle") }, [
        h("h2", { key: "title" }, t("canvasTitle")),
        h("p", { key: "empty", role: "status" }, snapshot.state === "error" ? t("canvasLoadError") : t("canvasEmpty"))
      ]);
      const positions = /* @__PURE__ */ new Map();
      const depth = (node, seen = /* @__PURE__ */ new Set()) => {
        if (!node.parent || seen.has(node.id)) return 0;
        seen.add(node.id);
        const parent = nodes.find((item) => item.id === node.parent);
        return parent ? depth(parent, seen) + 1 : 0;
      };
      const rows = /* @__PURE__ */ new Map();
      for (const node of nodes) {
        const level = depth(node), row = rows.get(level) || 0;
        rows.set(level, row + 1);
        positions.set(node.id, { x: 24 + level * 260, y: 24 + row * 118 });
      }
      const width = Math.max(520, ...[...positions.values()].map((p) => p.x + 246));
      const height = Math.max(200, ...[...positions.values()].map((p) => p.y + 110));
      const stateLabel = (node) => t(`canvasState_${node.state}`);
      const controls = h("div", { key: "controls", style: { display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" } }, [
        h("select", { key: "tasks", "aria-label": t("canvasChoose"), value: root, onChange: (event) => {
          chooseRoot(event.target.value);
          chooseNode("");
        }, style: { maxWidth: "100%" } }, graph.roots.map((id) => h("option", { key: id, value: id }, graph.nodes.find((node) => node.id === id)?.title))),
        h("button", { key: "refresh", type: "button", onClick: () => {
          for (const node of nodes) refreshTask?.(node.id);
        } }, t("canvasRefresh")),
        h("button", { key: "out", type: "button", "aria-label": t("canvasZoomOut"), disabled: zoom <= 0.5, onClick: () => setZoom((value) => Math.max(0.5, value - 0.25)) }, "\u2212"),
        h("button", { key: "reset", type: "button", onClick: () => setZoom(1) }, `${Math.round(zoom * 100)}%`),
        h("button", { key: "in", type: "button", "aria-label": t("canvasZoomIn"), disabled: zoom >= 1.5, onClick: () => setZoom((value) => Math.min(1.5, value + 0.25)) }, "+")
      ]);
      return h("section", { className: "metaontic-agent-forge-section", "aria-label": t("canvasTitle") }, [
        h("h2", { key: "title", style: { margin: "0 0 8px", fontSize: 15 } }, t("canvasTitle")),
        h("p", { key: "hint", style: { fontSize: 12, opacity: 0.75 } }, t("canvasHint")),
        controls,
        h(
          "div",
          { key: "viewport", tabIndex: 0, "aria-label": t("canvasTitle"), style: { overflow: "auto", maxHeight: 480, marginTop: 12, border: "1px solid currentColor", borderRadius: 12 } },
          h(
            "div",
            { style: { width: width * zoom, height: height * zoom } },
            h("div", { style: { position: "relative", width, height, transform: `scale(${zoom})`, transformOrigin: "top left" } }, [
              h("svg", { key: "edges", width, height, "aria-hidden": true, style: { position: "absolute", inset: 0, pointerEvents: "none" } }, graph.edges.filter((edge) => shown.has(edge.from) && shown.has(edge.to)).map((edge) => {
                const a = positions.get(edge.from), b = positions.get(edge.to);
                return h("path", { key: `${edge.from}:${edge.to}`, d: `M${a.x + 220},${a.y + 40} C${a.x + 240},${a.y + 40} ${b.x - 20},${b.y + 40} ${b.x},${b.y + 40}`, fill: "none", stroke: "currentColor", strokeWidth: 2, opacity: 0.35 });
              })),
              ...nodes.map((node) => {
                const p = positions.get(node.id);
                return h("button", {
                  key: node.id,
                  type: "button",
                  "aria-pressed": node.id === selected?.id,
                  onClick: () => chooseNode(node.id),
                  style: { position: "absolute", left: p.x, top: p.y, width: 220, minHeight: 82, padding: 12, textAlign: "left", borderRadius: 10, border: `2px solid ${node.id === selected?.id ? "#5584eb" : "#8492a640"}`, background: "var(--dsw-alias-background-primary,Canvas)", color: "inherit", cursor: "pointer" }
                }, [h("strong", { key: "title", style: { display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, node.title), h("span", { key: "state", role: "status", style: { display: "block", marginTop: 8, fontSize: 12 } }, stateLabel(node))]);
              })
            ])
          )
        ),
        selected && h("div", { key: "detail", style: { marginTop: 12, overflowWrap: "anywhere" } }, [
          h("strong", { key: "name" }, selected.title),
          h("p", { key: "state", role: "status" }, stateLabel(selected)),
          h("p", { key: "id", style: { fontSize: 12, opacity: 0.65 } }, selected.id),
          selected.projectionState === "error" && h("p", { key: "error", role: "status" }, t("canvasLoadError")),
          h("button", { key: "open", type: "button", disabled: selected.external || typeof openTask !== "function", onClick: () => openTask?.(selected.address) }, t(selected.state === "waiting" ? "canvasReview" : "canvasOpen"))
        ])
      ]);
    };
  }

  // src/client/panel.ts
  function createSidebarPanel({ React, h, TOKENS, PAGE_CSS, t, PANEL_ID: PANEL_ID2, GUIDE_URL: GUIDE_URL2, LOGO_SVG }) {
    const TaskCanvas = createTaskCanvas({ React, h, t });
    const LOGO_SRC = LOGO_SVG ? `data:image/svg+xml,${encodeURIComponent(LOGO_SVG)}` : "";
    const PANEL_CSS = `
      .metaontic-agent-forge-panel { width: 100%; max-width: 880px; margin: 0 auto; padding: 30px 32px 44px; display: flex; flex-direction: column; gap: 18px; }
      /* \u54C1\u724C\u5934\u56FE\uFF1A\u63D2\u4EF6 logo + \u6807\u9898/\u7B80\u4ECB\uFF0C\u7ED9\u7A7A\u8361\u7684\u5185\u5BB9\u533A\u4E00\u4E2A\u89C6\u89C9\u951A\u70B9 */
      .metaontic-agent-forge-panel-hero { display: flex; align-items: center; gap: 14px; }
      .metaontic-agent-forge-panel-mark { flex: 0 0 auto; display: inline-flex; align-items: center; justify-content: center; width: 44px; height: 44px; color: ${TOKENS.primaryFill}; }
      .metaontic-agent-forge-panel-logo { width: 100%; height: 100%; object-fit: contain; }
      /* \u5DE6\u4FA7\u680F\u90A3\u4E00\u884C\u7684 logo\uFF1A\u6309\u5BBF\u4E3B\u7ED9\u7684\u5C3A\u5BF8\u539F\u6837\u94FA\u5F00\uFF0C\u4E0D\u53C2\u4E0E\u4E3B\u9898\u53D6\u8272 */
      .metaontic-agent-forge-rail-logo { display: block; object-fit: contain; }
      .metaontic-agent-forge-panel-head { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
      .metaontic-agent-forge-panel-title { margin: 0; font-size: 19px; font-weight: 600; color: ${TOKENS.text}; }
      .metaontic-agent-forge-panel-intro { margin: 0; font-size: 13px; line-height: 1.55; color: ${TOKENS.muted}; }
      /* \u4E3B\u6309\u94AE\u5403\u6389\u591A\u4F59\u5BBD\u5EA6\uFF0C\u6B21\u8981\u6309\u94AE\u4E0E\u94FE\u63A5\u9000\u5230\u7B2C\u4E8C\u6392 */
      .metaontic-agent-forge-panel-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; }
      .metaontic-agent-forge-panel-actions .metaontic-agent-forge-btn-primary { flex: 1 1 220px; width: auto; min-width: 160px; height: 38px; }
      .metaontic-agent-forge-panel-actions .metaontic-agent-forge-btn:not(.metaontic-agent-forge-btn-primary) { min-width: 132px; }
      .metaontic-agent-forge-panel-link { margin-left: auto; font-size: 12px; color: ${TOKENS.primaryFill}; text-decoration: none; border-bottom: 1px solid transparent; }
      .metaontic-agent-forge-panel-link:hover { border-bottom-color: currentColor; }
      /* \u4E24\u5757\u4EF7\u503C\u70B9\u5361\u7247\uFF1A\u56FE\u6807 + \u6807\u9898 + \u4E00\u53E5\u8BF4\u660E\uFF0C\u7A84\u5BB9\u5668\u81EA\u52A8\u843D\u6210\u4E00\u5217 */
      .metaontic-agent-forge-panel-highlights { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 260px), 1fr)); gap: 12px; }
      .metaontic-agent-forge-panel-highlight { display: flex; align-items: flex-start; gap: 12px; padding: 13px 14px; border: 1px solid ${TOKENS.border}; border-radius: 12px; background: ${TOKENS.cardFill}; }
      .metaontic-agent-forge-panel-highlight-icon { flex: 0 0 auto; display: inline-flex; align-items: center; justify-content: center; width: 34px; height: 34px; border-radius: 10px; color: ${TOKENS.primaryFill}; background: ${TOKENS.controlFill}; }
      .metaontic-agent-forge-panel-highlight-body { min-width: 0; }
      .metaontic-agent-forge-panel-highlight-title { font-size: 13px; font-weight: 600; color: ${TOKENS.text}; }
      .metaontic-agent-forge-panel-highlight-desc { margin: 4px 0 0; font-size: 12px; line-height: 1.55; color: ${TOKENS.muted}; }
      /* \u6D41\u7A0B\u6F14\u793A\uFF1A\u56DB\u6B65\u5361\u7247\u6A2A\u6392\uFF0C\u5361\u7247\u4E4B\u95F4\u7528\u7BAD\u5934\u8FDE\u8D77\u6765\uFF1B\u7A84\u5BB9\u5668\u843D\u6210\u4E00\u5217 */
      .metaontic-agent-forge-panel-flow { display: flex; align-items: stretch; }
      .metaontic-agent-forge-panel-step { position: relative; overflow: hidden; flex: 1 1 0; min-width: 0; display: flex; flex-direction: column; gap: 7px; padding: 13px 14px 14px; border: 1px solid ${TOKENS.border}; border-radius: 12px; background: ${TOKENS.cardFill}; animation: metaontic-agent-forge-flow-card 9s ease-in-out infinite; }
      .metaontic-agent-forge-panel-step-head { display: flex; align-items: center; gap: 8px; }
      .metaontic-agent-forge-panel-step-badge { flex: 0 0 auto; display: inline-flex; align-items: center; justify-content: center; width: 22px; height: 22px; border-radius: 50%; font-size: 11px; font-weight: 600; color: ${TOKENS.primaryFill}; background: ${TOKENS.controlFill}; animation: metaontic-agent-forge-flow-badge 9s ease-in-out infinite; }
      .metaontic-agent-forge-panel-step-title { min-width: 0; font-size: 13px; font-weight: 600; color: ${TOKENS.text}; }
      .metaontic-agent-forge-panel-step-desc { margin: 0; font-size: 12px; line-height: 1.55; color: ${TOKENS.muted}; }
      /* \u53F3\u4E0A\u89D2\u7684\u6DE1\u8272\u6C34\u5370\u56FE\u6807\uFF0C\u53EA\u505A\u88C5\u9970 */
      .metaontic-agent-forge-panel-step-icon { position: absolute; top: 10px; right: 10px; color: ${TOKENS.primaryFill}; opacity: .14; pointer-events: none; }
      /* \u5361\u7247\u4E4B\u95F4\u7684\u7BAD\u5934\uFF1A\u6A2A\u6392\u65F6\u5411\u53F3\uFF0C\u7A84\u5BB9\u5668\u91CC\u8F6C\u6210\u5411\u4E0B */
      .metaontic-agent-forge-panel-conn { flex: 0 0 26px; align-self: center; height: 2px; border-radius: 1px; background: ${TOKENS.border}; position: relative; }
      .metaontic-agent-forge-panel-conn::after { content: ''; position: absolute; top: 50%; right: -1px; width: 5px; height: 5px; border-top: 2px solid ${TOKENS.border}; border-right: 2px solid ${TOKENS.border}; transform: translateY(-50%) rotate(45deg); }
      /* \u56DB\u6B65\u4F9D\u6B21\u70B9\u4EAE\uFF0C\u5F62\u6210\u4E00\u6761\u8D70\u52A8\u7684\u6D41\u7A0B\uFF1B\u5EF6\u8FDF\u6309\u6B65\u53F7\u9519\u5F00 */
      @keyframes metaontic-agent-forge-flow-card { 0%, 16% { border-color: ${TOKENS.primaryFill}; } 28%, 100% { border-color: ${TOKENS.border}; } }
      @keyframes metaontic-agent-forge-flow-badge { 0%, 16% { color: #fff; background: ${TOKENS.primaryFill}; } 28%, 100% { color: ${TOKENS.primaryFill}; background: ${TOKENS.controlFill}; } }
      .metaontic-agent-forge-panel-step[data-step="1"], .metaontic-agent-forge-panel-step[data-step="1"] .metaontic-agent-forge-panel-step-badge { animation-delay: 2.25s; }
      .metaontic-agent-forge-panel-step[data-step="2"], .metaontic-agent-forge-panel-step[data-step="2"] .metaontic-agent-forge-panel-step-badge { animation-delay: 4.5s; }
      .metaontic-agent-forge-panel-step[data-step="3"], .metaontic-agent-forge-panel-step[data-step="3"] .metaontic-agent-forge-panel-step-badge { animation-delay: 6.75s; }
      .metaontic-agent-forge-panel { container-type: inline-size; }
      @container (max-width: 620px) {
        .metaontic-agent-forge-panel-flow { flex-direction: column; align-items: stretch; }
        /* \u7AD6\u5411\u6392\u5E03\u65F6\u4E0D\u80FD\u518D\u6309\u5269\u4F59\u7A7A\u95F4\u62C9\u4F38\uFF0C\u5426\u5219\u5361\u7247\u4F1A\u88AB\u538B\u6241 */
        .metaontic-agent-forge-panel-step { flex: 0 0 auto; }
        .metaontic-agent-forge-panel-conn { flex: 0 0 18px; width: 2px; height: 18px; align-self: flex-start; margin-left: 24px; }
        .metaontic-agent-forge-panel-conn::after { top: auto; right: 50%; bottom: -1px; transform: translateX(50%) rotate(135deg); }
      }
      @container (max-width: 560px) {
        .metaontic-agent-forge-panel { padding: 22px 18px 34px; }
        .metaontic-agent-forge-panel-link { margin-left: 0; }
      }
      @media (prefers-reduced-motion: reduce) {
        .metaontic-agent-forge-panel-step, .metaontic-agent-forge-panel-step-badge { animation: none; }
      }
    `;
    function PanelIcon({ size = 18 }) {
      const pixels = Number(size) || 18;
      if (LOGO_SRC) {
        return h("img", {
          className: "metaontic-agent-forge-rail-logo",
          src: LOGO_SRC,
          alt: "",
          width: pixels,
          height: pixels,
          "aria-hidden": true
        });
      }
      return h("svg", {
        width: pixels,
        height: pixels,
        viewBox: "0 0 24 24",
        fill: "none",
        stroke: "currentColor",
        strokeWidth: 1.7,
        strokeLinecap: "round",
        strokeLinejoin: "round",
        "aria-hidden": true
      }, [
        h("rect", { key: "frame", x: 2.5, y: 4.5, width: 13.5, height: 15, rx: 2.5 }),
        h("path", { key: "lens", d: "M16 10.4 21.5 7.3v9.4L16 13.6z" })
      ]);
    }
    function flowIcon(name, size = 22) {
      const common = {
        width: size,
        height: size,
        viewBox: "0 0 24 24",
        fill: "none",
        stroke: "currentColor",
        strokeWidth: 1.6,
        strokeLinecap: "round",
        strokeLinejoin: "round",
        "aria-hidden": true
      };
      if (name === "idea") {
        return h("svg", common, [
          h("path", { key: "bulb", d: "M12 3.5a5.5 5.5 0 0 0-3.2 9.9V16h6.4v-2.6A5.5 5.5 0 0 0 12 3.5Z" }),
          h("path", { key: "base", d: "M9.5 18.5h5M10.5 21h3" })
        ]);
      }
      if (name === "script") {
        return h("svg", common, [
          h("rect", { key: "frame", x: 3, y: 4.5, width: 18, height: 15, rx: 2.2 }),
          h("path", { key: "split", d: "M3 12h18M11 12v7.5" })
        ]);
      }
      if (name === "generate") {
        return h("svg", common, [
          h("rect", { key: "frame", x: 3, y: 5, width: 18, height: 14, rx: 2.2 }),
          h("path", { key: "play", d: "M10.4 9.4 15 12l-4.6 2.6z" })
        ]);
      }
      if (name === "easy") {
        return h("svg", common, [
          h("path", { key: "star", d: "M12 4.2l1.9 5.1 5.1 1.9-5.1 1.9L12 18.2l-1.9-5.1L5 11.2l5.1-1.9z" }),
          h("path", { key: "spark", d: "M19 4.2v3M17.5 5.7h3" })
        ]);
      }
      if (name === "cheap") {
        return h("svg", common, [
          h("path", { key: "tag", d: "M11.2 3.8H5.4A1.6 1.6 0 0 0 3.8 5.4v5.8l8.8 8.8a1.6 1.6 0 0 0 2.3 0l5.8-5.8a1.6 1.6 0 0 0 0-2.3z" }),
          h("circle", { key: "hole", cx: 7.6, cy: 7.6, r: 1.2 })
        ]);
      }
      return h("svg", common, [
        h("path", { key: "down", d: "M12 3.5v10m0 0 3.6-3.6M12 13.5 8.4 9.9" }),
        h("path", { key: "tray", d: "M4.5 16.5v2.2a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-2.2" })
      ]);
    }
    function highlight(key, icon, title, desc) {
      return h("div", { key, className: "metaontic-agent-forge-panel-highlight" }, [
        h("span", { key: "icon", className: "metaontic-agent-forge-panel-highlight-icon" }, flowIcon(icon, 20)),
        h("div", { key: "body", className: "metaontic-agent-forge-panel-highlight-body" }, [
          h("div", { key: "title", className: "metaontic-agent-forge-panel-highlight-title" }, title),
          h("p", { key: "desc", className: "metaontic-agent-forge-panel-highlight-desc" }, desc)
        ])
      ]);
    }
    function ForgePanel(props) {
      const flow = [
        { icon: "idea", title: t("panelStep1Title"), desc: t("panelStep1Desc") },
        { icon: "script", title: t("panelStep2Title"), desc: t("panelStep2Desc") },
        { icon: "generate", title: t("panelStep3Title"), desc: t("panelStep3Desc") },
        { icon: "merge", title: t("panelStep4Title"), desc: t("panelStep4Desc") }
      ];
      const flowChildren = flow.flatMap((step, index) => {
        const card = h("div", {
          key: `step-${index}`,
          className: "metaontic-agent-forge-panel-step",
          "data-step": String(index)
        }, [
          h("div", { key: "head", className: "metaontic-agent-forge-panel-step-head" }, [
            h("span", { key: "badge", className: "metaontic-agent-forge-panel-step-badge" }, String(index + 1)),
            h("span", { key: "title", className: "metaontic-agent-forge-panel-step-title" }, step.title)
          ]),
          h("p", { key: "desc", className: "metaontic-agent-forge-panel-step-desc" }, step.desc),
          h("span", { key: "icon", className: "metaontic-agent-forge-panel-step-icon" }, flowIcon(step.icon))
        ]);
        return index === 0 ? [card] : [h("span", { key: `conn-${index}`, className: "metaontic-agent-forge-panel-conn", "aria-hidden": true }), card];
      });
      return h("div", { className: "metaontic-agent-forge-panel" }, [
        h("style", { key: "styles" }, PAGE_CSS + PANEL_CSS),
        h("header", { key: "hero", className: "metaontic-agent-forge-panel-hero" }, [
          h(
            "span",
            { key: "mark", className: "metaontic-agent-forge-panel-mark" },
            LOGO_SRC ? h("img", { key: "logo", className: "metaontic-agent-forge-panel-logo", src: LOGO_SRC, alt: "", "aria-hidden": true }) : PanelIcon({ size: 24 })
          ),
          h("div", { key: "head", className: "metaontic-agent-forge-panel-head" }, [
            h("h1", { key: "title", className: "metaontic-agent-forge-panel-title" }, t("panelTitle")),
            h("p", { key: "intro", className: "metaontic-agent-forge-panel-intro" }, t("panelIntro"))
          ])
        ]),
        h("section", { key: "highlights", className: "metaontic-agent-forge-section" }, [
          h("div", { key: "highlights-label", className: "metaontic-agent-forge-section-title" }, t("panelHighlights")),
          h("div", { key: "highlights-cards", className: "metaontic-agent-forge-panel-highlights" }, [
            highlight("easy", "easy", t("panelHighlight1Title"), t("panelHighlight1Desc")),
            highlight("cheap", "cheap", t("panelHighlight2Title"), t("panelHighlight2Desc"))
          ])
        ]),
        h("section", { key: "start", className: "metaontic-agent-forge-section" }, [
          h("div", { key: "start-label", className: "metaontic-agent-forge-section-title" }, t("panelStart")),
          h("div", { key: "start-actions", className: "metaontic-agent-forge-panel-actions" }, [
            h("button", {
              key: "new",
              type: "button",
              className: "metaontic-agent-forge-btn metaontic-agent-forge-btn-primary",
              onClick: () => props?.startSession?.()
            }, t("panelNew")),
            h("button", {
              key: "canvas",
              type: "button",
              className: "metaontic-agent-forge-btn",
              disabled: typeof props?.openCanvas !== "function",
              onClick: () => props?.openCanvas?.()
            }, t("panelCanvas")),
            h("button", {
              key: "settings",
              type: "button",
              className: "metaontic-agent-forge-btn",
              disabled: typeof props?.openSettings !== "function",
              onClick: () => props?.openSettings?.()
            }, t("panelSettings")),
            h("a", {
              key: "guide",
              className: "metaontic-agent-forge-panel-link",
              href: GUIDE_URL2,
              target: "_blank",
              rel: "noopener noreferrer"
            }, t("panelGuide"))
          ])
        ]),
        typeof props.useSessions === "function" && typeof props.useSessionStatus === "function" ? h(TaskCanvas, { key: "task-canvas", ...props }) : null,
        h("section", { key: "flow", className: "metaontic-agent-forge-section" }, [
          h("div", { key: "flow-label", className: "metaontic-agent-forge-section-title" }, t("panelFlow")),
          h("div", { key: "flow-steps", className: "metaontic-agent-forge-panel-flow" }, flowChildren)
        ])
      ]);
    }
    return { PANEL_ID: PANEL_ID2, PanelIcon, ForgePanel };
  }

  // src/client/locale.ts
  function createPlatformDictionaries() {
    const zh = {
      "canvasTitle": "\u4EFB\u52A1\u5173\u7CFB",
      "canvasChoose": "\u9009\u62E9\u4EFB\u52A1",
      "canvasRefresh": "\u5237\u65B0\u72B6\u6001",
      "canvasZoomOut": "\u7F29\u5C0F\u753B\u5E03",
      "canvasZoomIn": "\u653E\u5927\u753B\u5E03",
      "canvasHint": "\u8282\u70B9\u6765\u81EA\u771F\u5B9E\u4F1A\u8BDD\u4E0E\u59D4\u6D3E\u8BB0\u5F55\u3002\u7B49\u5F85\u786E\u8BA4\u65F6\u8FDB\u5165\u539F\u4EFB\u52A1\u5BA1\u6838\uFF1B\u672C\u8F6E\u7ED3\u675F\u4E0D\u4EE3\u8868\u89C6\u9891\u5DF2\u4EA4\u4ED8\u3002",
      "canvasEmpty": "\u6682\u65E0\u53EF\u5C55\u793A\u7684\u5E73\u53F0\u4EFB\u52A1\u3002\u901A\u8FC7\u4E91\u667A\u5DE5\u574A\u5F00\u59CB\u534F\u4F5C\u540E\uFF0C\u4EFB\u52A1\u4E0E\u4E13\u4E1A\u52A9\u624B\u5C06\u5728\u8FD9\u91CC\u663E\u793A\u3002",
      "canvasLoadError": "\u90E8\u5206\u4EFB\u52A1\u8BB0\u5F55\u6682\u65F6\u65E0\u6CD5\u8BFB\u53D6\uFF0C\u8BF7\u5237\u65B0\u6216\u6253\u5F00\u539F\u4EFB\u52A1\u67E5\u770B\u3002",
      "canvasState_waiting": "\u7B49\u5F85\u786E\u8BA4",
      "canvasState_running": "\u6B63\u5728\u8FD0\u884C",
      "canvasState_turn-ended": "\u672C\u8F6E\u7ED3\u675F",
      "canvasState_idle": "\u5F53\u524D\u672A\u8FD0\u884C",
      "canvasOpen": "\u6253\u5F00\u4EFB\u52A1\u5BF9\u8BDD",
      "canvasReview": "\u524D\u5F80\u786E\u8BA4",
      panelTitle: "\u4E91\u667A\u5DE5\u574A \xB7 \u667A\u80FD\u4F53\u5E73\u53F0",
      panelSidebarLabel: "\u4E91\u667A\u5DE5\u574A",
      panelIntro: "\u7531\u603B\u63A7\u62C6\u89E3\u9700\u6C42\u3001\u59D4\u6D3E\u4E13\u4E1A Agent \u5E76\u6C47\u603B\u6210\u679C\uFF0C\u5F53\u524D\u5DF2\u63A5\u5165\u89C6\u9891\u521B\u4F5C\u4E0E\u5BA3\u4F20\u89C6\u9891\u4E1A\u52A1\u3002",
      panelStart: "\u5F00\u59CB\u534F\u4F5C",
      panelNew: "\u6253\u5F00\u4E91\u667A\u5DE5\u574A",
      panelCanvas: "\u6253\u5F00\u521B\u4F5C\u753B\u5E03",
      panelSettings: "\u6253\u5F00\u63D2\u4EF6\u8BBE\u7F6E",
      panelGuide: "\u4F7F\u7528\u8BF4\u660E",
      panelHighlights: "\u4E3A\u4EC0\u4E48\u7528\u5B83",
      panelHighlight1Title: "\u603B\u63A7\u7EDF\u7B79\uFF0C\u4E13\u4E1A\u6267\u884C",
      panelHighlight1Desc: "\u4E91\u667A\u5DE5\u574A\u6309\u767D\u540D\u5355\u5206\u914D\u52A9\u624B\u3001\u8DDF\u8FDB\u4EFB\u52A1\u5E76\u6C47\u603B\u6210\u679C\uFF0C\u5173\u952E\u5BA1\u6838\u4E0E\u8D39\u7528\u7531\u4F60\u786E\u8BA4\u3002",
      panelHighlight2Title: "\u72EC\u7ACB\u4E1A\u52A1\uFF0C\u6301\u7EED\u6269\u5C55",
      panelHighlight2Desc: "\u4E1A\u52A1\u6A21\u5757\u4E0E Agent \u5B9A\u4E49\u5206\u79BB\uFF0C\u73B0\u6709\u89C6\u9891\u4E1A\u52A1\u652F\u6301\u5206\u6BB5\u7EED\u62CD\u3001\u9010\u6BB5\u5BA1\u6838\u548C\u672C\u673A\u5408\u5E76\u3002",
      panelFlow: "\u4F7F\u7528\u6D41\u7A0B",
      panelStep1Title: "\u660E\u786E\u9700\u6C42",
      panelStep1Desc: "\u8BF4\u660E\u76EE\u6807\u3001\u5DF2\u6709\u7D20\u6750\u4E0E\u9650\u5236\uFF0C\u5DF2\u63D0\u4F9B\u7684\u4FE1\u606F\u76F4\u63A5\u6CBF\u7528\u3002",
      panelStep2Title: "\u5206\u914D\u52A9\u624B",
      panelStep2Desc: "\u603B\u63A7\u9009\u62E9\u767D\u540D\u5355\u4E2D\u7684\u4E13\u4E1A\u52A9\u624B\uFF0C\u4E00\u5C42\u59D4\u6D3E\uFF0C\u4E0D\u5FAA\u73AF\u8C03\u7528\u3002",
      panelStep3Title: "\u6267\u884C\u5BA1\u6838",
      panelStep3Desc: "\u4E13\u4E1A\u52A9\u624B\u5904\u7406\u4EFB\u52A1\uFF0C\u811A\u672C\u3001\u8D39\u7528\u4E0E\u89C6\u9891\u5206\u6BB5\u7EE7\u7EED\u7531\u4F60\u786E\u8BA4\u3002",
      panelStep4Title: "\u6C47\u603B\u6210\u679C",
      panelStep4Desc: "\u5B8C\u6210\u901A\u77E5\u56DE\u5230\u603B\u63A7\uFF0C\u6C47\u603B\u6210\u679C\u94FE\u63A5\u548C\u5F85\u529E\uFF0C\u4E0D\u5C06\u542F\u52A8\u5F53\u4F5C\u5B8C\u6210\u3002"
    };
    const en = {
      "canvasTitle": "Task canvas",
      "canvasChoose": "Choose a task",
      "canvasRefresh": "Refresh status",
      "canvasZoomOut": "Zoom out",
      "canvasZoomIn": "Zoom in",
      "canvasHint": "Nodes reflect recorded sessions and delegation. Review requests in the original task. An ended turn does not mean a delivered video.",
      "canvasEmpty": "No platform tasks available. Start with Cloud Studio to see the coordinator and its specialists here.",
      "canvasLoadError": "Some task records are unavailable. Refresh or open the original task.",
      "canvasState_waiting": "Awaiting confirmation",
      "canvasState_running": "Running",
      "canvasState_turn-ended": "Turn ended",
      "canvasState_idle": "Not running",
      "canvasOpen": "Open task conversation",
      "canvasReview": "Review request",
      panelTitle: "MetaOntic Agent Forge",
      panelSidebarLabel: "Agent Forge",
      panelIntro: "Coordinate specialist agents and review their results. Video creation and promotional video are currently available.",
      panelStart: "Start collaborating",
      panelNew: "Open Cloud Studio",
      panelCanvas: "Open creative canvas",
      panelSettings: "Open plugin settings",
      panelGuide: "User guide",
      panelHighlights: "Why it works",
      panelHighlight1Title: "Coordinator and specialists",
      panelHighlight1Desc: "Delegate approved tasks, track progress, and keep user review and cost approval.",
      panelHighlight2Title: "Independent business modules",
      panelHighlight2Desc: "Extend business modules independently. Video workflows include continuation, review and local merging.",
      panelFlow: "How it works",
      panelStep1Title: "Define the task",
      panelStep1Desc: "Share the goal, source material and constraints.",
      panelStep2Title: "Choose a specialist",
      panelStep2Desc: "Use approved specialists with one delegation level.",
      panelStep3Title: "Execute and review",
      panelStep3Desc: "Review scripts, costs and generated video segments.",
      panelStep4Title: "Collect results",
      panelStep4Desc: "Summarize completed deliverables and unfinished work."
    };
    return { zh, en };
  }

  // icon.svg
  var icon_default = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" fill="none"><defs><linearGradient id="metaontic-agent-forge-brand-bg" x1="3" y1="2" x2="45" y2="47" gradientUnits="userSpaceOnUse"><stop stop-color="#163C66"/><stop offset="1" stop-color="#26254F"/></linearGradient></defs><rect width="48" height="48" rx="12" fill="url(#metaontic-agent-forge-brand-bg)"/><path d="M24 15v7m-10 9 7-5m13 5-7-5" stroke="#D7E8FA" stroke-width="2.2" stroke-linecap="round"/><path d="m24 6 7 4v8l-7 4-7-4v-8l7-4Z" fill="#87A7F7"/><path d="m24 6 7 4-7 4-7-4 7-4Z" fill="#C4D4FF"/><path d="M24 14v8l7-4v-8l-7 4Z" fill="#6C86D3"/><path d="m12 26 7 4v8l-7 4-7-4v-8l7-4Z" fill="#64DDCF"/><path d="m12 26 7 4-7 4-7-4 7-4Z" fill="#B3F5E7"/><path d="M12 34v8l7-4v-8l-7 4Z" fill="#38B4AE"/><path d="m36 26 7 4v8l-7 4-7-4v-8l7-4Z" fill="#72C2F3"/><path d="m36 26 7 4-7 4-7-4 7-4Z" fill="#C2E7FF"/><path d="M36 34v8l7-4v-8l-7 4Z" fill="#4C98D5"/><path d="m24 19 2.3 4.2L31 25l-4.7 2.1L24 32l-2.1-4.9L17 25l4.9-1.8L24 19Z" fill="#FFD68A"/></svg>\n';

  // src/client/platform.ts
  var PANEL_ID = "metaontic-agent-forge";
  var NAMESPACE = "metaontic-agent-forge";
  var NS = "platform.metaonticAgentForge";
  var GUIDE_URL = "https://ai.mybfs.cn";
  function createPlatformClient(require2) {
    const React = require2("react"), h = React.createElement;
    const { TOKENS, PAGE_CSS } = createTheme();
    return {
      inject: ["slots", "locale"],
      apply(ctx) {
        registerAgentPicker(ctx, h);
        registerInfiniteCanvas(ctx, React);
        ctx.effect(() => ctx.locale.register(NS, createPlatformDictionaries()), "forge: platform dictionaries");
        const t = ctx.locale.bind(NS);
        const { PanelIcon, ForgePanel } = createSidebarPanel({ React, h, TOKENS, PAGE_CSS, t, PANEL_ID, GUIDE_URL, LOGO_SVG: icon_default });
        ctx.effect(() => ctx.slots.inject("sidebar.panellist", () => ctx.slots.register({
          name: "sidebar.panellist",
          id: PANEL_ID,
          order: 30,
          locale: NS,
          label: () => t("panelSidebarLabel")
        }, PanelIcon)), "forge: platform entry");
        ctx.effect(() => ctx.slots.inject("main", () => ctx.slots.register({
          name: "main",
          key: PANEL_ID,
          locale: NS,
          inject: () => ({
            openTask: (address) => ctx.get("uiWorkspace")?.openSession(address),
            refreshTask: (id) => ctx.get("sessions")?.refreshProjections(id),
            startSession: () => ctx.get("uiWorkspace")?.startSession(void 0, { agentPreset: "metaontic-agent-forge-studio" }),
            openSettings: () => ctx.get("pluginNavigation")?.openBundle(NAMESPACE),
            openCanvas: () => ctx.get("sidebarRight")?.openTab(FORGE_CANVAS_KIND)
          })
        }, ForgePanel)), "forge: platform dashboard");
      }
    };
  }

  // src/core/settings/client.ts
  function createSettingsPages(h) {
    const pages = /* @__PURE__ */ new Map();
    return {
      register(page) {
        const group = pages.get(page.namespace) || [];
        if (group.some((existing) => existing.id === page.id)) throw new Error(`\u91CD\u590D\u7684\u8BBE\u7F6E\u9875\uFF1A${page.id}`);
        group.push(page);
        pages.set(page.namespace, group);
      },
      mount(ctx) {
        for (const [namespace, group] of pages) {
          const Page = group.length === 1 ? group[0].Page : (props) => h("div", {}, ...group.map((page) => h(page.Page, { ...props, key: page.id })));
          ctx.effect(() => ctx.slots.inject("plugins.bundle.config", () => ctx.slots.register({
            name: "plugins.bundle.config",
            key: namespace,
            locale: group[0].locale
          }, Page)), `${namespace}: configuration page`);
        }
      }
    };
  }

  // src/client/runtime.ts
  function createClientRuntime(require2, modules) {
    const ids = /* @__PURE__ */ new Set();
    const plugins = modules.map((module) => {
      if (!module.id || ids.has(module.id)) throw new Error(`\u91CD\u590D\u6216\u65E0\u6548\u7684\u754C\u9762\u6A21\u5757\uFF1A${module.id}`);
      ids.add(module.id);
      return module.create(require2);
    });
    return {
      inject: [...new Set(plugins.flatMap((plugin) => plugin.inject || []))],
      apply(ctx) {
        const settings = createSettingsPages(require2("react").createElement);
        for (const plugin of plugins) plugin.apply(ctx, { settings });
        settings.mount(ctx);
      }
    };
  }

  // src/client/auth-notice.ts
  function createAuthNotice({ h, Original, hostT, t }) {
    return function AuthNotice(props) {
      if (props.node?.data?.code !== "AUTH") return h(Original, { ...props, t: hostT });
      return h("div", { role: "status", "data-field": "auth-notice", style: { display: "flex", gap: 10, padding: "10px 0", alignItems: "flex-start" } }, [
        h("span", { key: "dot", "aria-hidden": true, style: { flex: "0 0 auto", width: 7, height: 7, marginTop: 6, borderRadius: "50%", background: "var(--dsw-alias-state-error-primary,#d9534f)" } }),
        h("div", { key: "copy", style: { minWidth: 0, fontSize: 13, lineHeight: 1.65, color: "var(--dsw-alias-label-primary,inherit)" } }, [
          h("strong", { key: "title", style: { fontWeight: 500 } }, t("authNoticeTitle")),
          h("div", { key: "hint", style: { color: "var(--dsw-alias-label-secondary,inherit)" } }, t("authNoticeHint")),
          h("a", { key: "support", href: "https://work.weixin.qq.com/kfid/kfcd6fc4ca793eeac18", target: "_blank", rel: "noopener noreferrer", referrerPolicy: "no-referrer" }, t("supportContact"))
        ])
      ]);
    };
  }
  function registerAuthNotice(ctx, h, t) {
    if (typeof ctx.slots.entriesOfSlot !== "function") return;
    const entries = (typeof ctx.slots.entries === "function" ? ctx.slots.entries("conversation.chat.node") : ctx.slots.entriesOfSlot("conversation.chat.node")).filter((entry) => entry.options?.key === "turn-error");
    const original = ctx.slots.entriesOfSlot("conversation.chat.node").filter((entry) => entry.options?.key === "turn-error").sort((a, b) => (a.options.priority || 0) - (b.options.priority || 0))[0];
    if (!original?.component) return;
    const Notice = createAuthNotice({ h, Original: original.component, hostT: ctx.locale.bind(original.locale || "chat"), t });
    return ctx.slots.register({ name: "conversation.chat.node", key: "turn-error", priority: Math.min(...entries.map((entry) => entry.options.priority || 0)) - 2, locale: "chat" }, Notice);
  }

  // src/businesses/video/client/tool-result.ts
  function createToolResultView({ h, MediaPreview, VideoTaskProgress }) {
    function ToolResultView(props) {
      if (props.block && "kind" in props.block) return h(MediaPreview, props);
      if (!["metaontic_agent_forge_video_generate", "metaontic_agent_forge_video_extend"].includes(props.toolName)) return null;
      return h(VideoTaskProgress, props);
    }
    return { ToolResultView };
  }

  // src/businesses/video/client/media-preview.ts
  function localMediaUrl(file, base) {
    if (typeof file !== "string" || /[\u0000-\u001f\u007f]/.test(file) || !/^(?:\/(?!\/)|[a-z]:[/\\])/i.test(file)) return "";
    if (typeof base !== "string" || !/^https?:/i.test(base) && !base.startsWith("dsh-app://app/")) return "";
    try {
      return new URL(`api/file?path=${encodeURIComponent(file)}`, base).href;
    } catch {
      return "";
    }
  }
  function remoteMediaUrl(value) {
    try {
      const url = new URL(String(value || ""));
      return ["https:", "http:"].includes(url.protocol) && !url.username && !url.password ? url.href : "";
    } catch {
      return "";
    }
  }
  function previewMediaFromBlock(block, toolName) {
    if (!block || !("kind" in block) || block.isError) return [];
    const projected = block.meta?.metaonticMedia;
    if (projected?.version === 1 && Array.isArray(projected.media)) return projected.media.filter((item) => item && ["video", "image"].includes(item.kind)).slice(0, 40);
    const text = (Array.isArray(block.content) ? block.content : []).filter((p) => p.type === "text").map((p) => p.text || "").join("\n");
    const media = [], seen = /* @__PURE__ */ new Set();
    for (const match of text.matchAll(/\[([^\]]*)\]\(\s*(?:<([^>]+)>|([^\s)]+))\s*\)/g)) {
      const source = match[2] || match[3];
      if (seen.has(source)) continue;
      let kind = /\.(png|jpe?g|webp|gif|svg)(?:[?#]|$)/i.test(source) || /图片|参考图/.test(match[1]) || toolName === "metaontic_agent_forge_video_prepare_image" ? "image" : /\.(mp4|webm|mov|m4v)(?:[?#]|$)/i.test(source) || /视频|第.*段/.test(match[1]) ? "video" : "";
      if (!kind) continue;
      seen.add(source);
      let url = remoteMediaUrl(source);
      let file = "";
      if (!url) {
        try {
          file = decodeURI(source);
        } catch {
          continue;
        }
      }
      media.push({ kind, label: match[1] || (kind === "image" ? "\u56FE\u7247" : "\u89C6\u9891"), ...url ? { url } : { localPath: file } });
      if (media.length >= 40) break;
    }
    return media;
  }
  function createMediaPreview({ React, h }) {
    function MediaItem({ item }) {
      const sources = [...new Set([localMediaUrl(item.localPath, document.baseURI), remoteMediaUrl(item.url)].filter(Boolean))];
      const signature = sources.join("\n");
      const [index, setIndex] = React.useState(0);
      const [failed, setFailed] = React.useState(false);
      const [zoom, setZoom] = React.useState(false);
      const dialog = React.useRef(null);
      React.useEffect(() => {
        setIndex(0);
        setFailed(false);
        setZoom(false);
      }, [signature]);
      React.useEffect(() => {
        if (zoom && dialog.current && !dialog.current.open) dialog.current.showModal();
      }, [zoom]);
      const source = sources[index] || "";
      const error = () => {
        if (index + 1 < sources.length) setIndex(index + 1);
        else setFailed(true);
      };
      const label = String(item.label || (item.kind === "image" ? "\u56FE\u7247" : "\u89C6\u9891"));
      const media = !source || failed ? h("p", { role: "status", className: "metaontic-agent-forge-media-error" }, item.kind === "image" ? "\u56FE\u7247\u9884\u89C8\u65E0\u6CD5\u52A0\u8F7D\uFF0C\u6587\u4EF6\u53EF\u80FD\u5DF2\u79FB\u52A8\u6216\u94FE\u63A5\u5DF2\u8FC7\u671F\u3002\u8BF7\u5C1D\u8BD5\u6253\u5F00\u539F\u56FE\u3002" : "\u89C6\u9891\u9884\u89C8\u65E0\u6CD5\u64AD\u653E\uFF0C\u53EF\u80FD\u662F\u6587\u4EF6\u5DF2\u79FB\u52A8\u3001\u94FE\u63A5\u5DF2\u8FC7\u671F\u6216\u7F16\u7801\u4E0D\u53D7\u652F\u6301\u3002\u8BF7\u5C1D\u8BD5\u6253\u5F00\u539F\u89C6\u9891\u6216\u4E0B\u8F7D\u540E\u64AD\u653E\u3002") : item.kind === "image" ? h("button", { type: "button", className: "metaontic-agent-forge-media-image-button", onClick: () => setZoom(true), "aria-label": `\u653E\u5927${label}` }, h("img", { src: source, alt: label, loading: "lazy", onError: error, className: "metaontic-agent-forge-media-image", referrerPolicy: "no-referrer" })) : h("video", { key: source, src: source, controls: true, playsInline: true, preload: "metadata", onError: error, className: "metaontic-agent-forge-media-video", "aria-label": label, referrerPolicy: "no-referrer" });
      return h("figure", { className: "metaontic-agent-forge-media-item", "data-media-kind": item.kind }, [
        h("figcaption", { key: "caption", className: "metaontic-agent-forge-media-caption" }, label),
        h("div", { key: "body", className: "metaontic-agent-forge-media-surface" }, media),
        sources.length ? h("div", { key: "links", className: "metaontic-agent-forge-media-links" }, [
          h("a", { key: "open", href: source || sources[0], target: "_blank", rel: "noopener noreferrer", referrerPolicy: "no-referrer" }, item.kind === "image" ? "\u6253\u5F00\u539F\u56FE" : "\u6253\u5F00\u539F\u89C6\u9891"),
          item.localPath && remoteMediaUrl(item.url) ? h("a", { key: "remote", href: remoteMediaUrl(item.url), target: "_blank", rel: "noopener noreferrer", referrerPolicy: "no-referrer" }, "\u4E0A\u6E38\u94FE\u63A5") : null
        ]) : null,
        zoom && item.kind === "image" ? h("dialog", { key: "zoom", ref: dialog, className: "metaontic-agent-forge-media-dialog", "aria-label": label, onCancel: () => setZoom(false), onClose: () => setZoom(false), onClick: (e) => {
          if (e.target === e.currentTarget) setZoom(false);
        } }, [
          h("button", { key: "close", type: "button", className: "metaontic-agent-forge-media-close", onClick: () => {
            dialog.current?.close();
            setZoom(false);
          }, "aria-label": "\u5173\u95ED\u56FE\u7247\u9884\u89C8" }, "\u5173\u95ED"),
          h("img", { key: "image", src: source, alt: label, className: "metaontic-agent-forge-media-zoom", referrerPolicy: "no-referrer", onError: error })
        ]) : null
      ]);
    }
    function MediaPreview({ block, toolName }) {
      const items = previewMediaFromBlock(block, toolName);
      const [expanded, setExpanded] = React.useState(false);
      if (!items.length) return null;
      const visible = expanded ? items : items.slice(0, 2);
      return h("section", { className: "metaontic-agent-forge-media-preview", "aria-label": "\u751F\u6210\u7ED3\u679C\u9884\u89C8", "data-field": "media-preview" }, [
        h("style", { key: "styles" }, `
        .metaontic-agent-forge-media-preview{margin-top:12px;min-width:0;color:var(--dsw-alias-label-primary,inherit)}
        .metaontic-agent-forge-media-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,300px),1fr));gap:12px;min-width:0}
        .metaontic-agent-forge-media-item{margin:0;min-width:0;border:1px solid var(--dsw-alias-border-l2,#dfe3eb);border-radius:10px;overflow:hidden}
        .metaontic-agent-forge-media-caption{padding:8px 12px;font-size:13px;font-weight:600;overflow-wrap:anywhere}
        .metaontic-agent-forge-media-surface{min-width:0;background:var(--dsw-specific-input-major,#f5f6f8)}
        .metaontic-agent-forge-media-image-button{display:block;width:100%;padding:0;border:0;background:transparent;cursor:zoom-in}
        .metaontic-agent-forge-media-image{display:block;width:100%;max-height:320px;object-fit:contain}
        .metaontic-agent-forge-media-video{display:block;width:100%;max-height:420px;background:#10131a;object-fit:contain}
        .metaontic-agent-forge-media-links{display:flex;gap:16px;flex-wrap:wrap;padding:8px 12px;font-size:12px}
        .metaontic-agent-forge-media-links a{color:var(--dsw-alias-link,#247bbf);text-decoration:underline;overflow-wrap:anywhere}
        .metaontic-agent-forge-media-error{margin:0;padding:18px 12px;font-size:12px;line-height:1.6;color:var(--dsw-alias-label-caption,#737b8b)}
        .metaontic-agent-forge-media-more{margin-top:10px;border:1px solid var(--dsw-alias-border-l2,#dfe3eb);border-radius:6px;padding:6px 10px;background:transparent;color:inherit;cursor:pointer}
        .metaontic-agent-forge-media-dialog{box-sizing:border-box;max-width:94vw;max-height:94vh;padding:42px 12px 12px;border:0;border-radius:12px;background:var(--dsw-alias-settings-card-fill,#fff);color:inherit}
        .metaontic-agent-forge-media-dialog::backdrop{background:rgba(0,0,0,.7)}
        .metaontic-agent-forge-media-zoom{display:block;max-width:calc(94vw - 24px);max-height:calc(94vh - 70px);object-fit:contain}
        .metaontic-agent-forge-media-close{position:absolute;top:8px;right:10px;background:transparent;color:inherit;border:1px solid var(--dsw-alias-border-l2,#dfe3eb);border-radius:6px;padding:4px 10px;cursor:pointer}
        .metaontic-agent-forge-media-image-button:focus-visible,.metaontic-agent-forge-media-more:focus-visible,.metaontic-agent-forge-media-close:focus-visible{outline:2px solid #247bbf;outline-offset:-2px}
      `),
        h("div", { key: "grid", className: "metaontic-agent-forge-media-grid" }, visible.map((item) => h(MediaItem, { key: `${item.kind}:${item.localPath || item.url}`, item }))),
        items.length > 2 ? h("button", { key: "more", type: "button", className: "metaontic-agent-forge-media-more", onClick: () => setExpanded(!expanded), "aria-expanded": expanded }, expanded ? "\u6536\u8D77\u5176\u4ED6\u6210\u679C" : `\u5C55\u5F00\u5176\u4ED6\u6210\u679C\uFF08${items.length - 2}\uFF09`) : null
      ]);
    }
    return { MediaPreview };
  }

  // src/businesses/video/client/progress.ts
  function estimatedVideoWait(duration) {
    const seconds = Number(duration);
    return Number.isFinite(seconds) && seconds > 0 ? 105 + seconds * 3 : 180;
  }
  function estimatedVideoProgress(elapsed, duration) {
    const seconds = Math.max(0, Number(elapsed) || 0);
    return Math.min(99, Math.max(1, Math.floor(seconds / estimatedVideoWait(duration) * 100)));
  }
  function activeVideoCalls(chat) {
    const calls = [];
    const seen = /* @__PURE__ */ new Set();
    function visit(block) {
      if (!block)
        return;
      const done = "kind" in block;
      const name = done ? block.call?.name : block.name;
      if (!done && ["metaontic_agent_forge_video_generate", "metaontic_agent_forge_video_extend"].includes(name) && !seen.has(block.callId)) {
        seen.add(block.callId);
        calls.push({ block, toolName: name, callId: block.callId });
      }
      for (const child of block.subCalls || [])
        visit(child);
    }
    const nodes = chat?.nodes?.values?.() ?? (chat?.order || []).map((key) => chat.nodes?.get(key));
    for (const node of nodes) {
      if (node?.kind === "tool-call")
        visit(node.data?.root);
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
        if (window2 === previous)
          return snapshot;
        const next = /* @__PURE__ */ new Map();
        for (const { event } of window2.entries) {
          if (event.type === "plugin:metaontic-agent-forge/execution") {
            const { callId, phase } = event.data || {};
            if (typeof callId !== "string")
              continue;
            if (phase === "start")
              next.set(callId, event.time);
            else if (phase === "end")
              next.delete(callId);
          } else if (event.type === "turn/end")
            next.clear();
        }
        previous = window2;
        if (next.size !== snapshot.size || [...next].some(([id, time]) => snapshot.get(id) !== time))
          snapshot = next;
        return snapshot;
      }
    };
  }
  function createVideoProgress({ React, h, TOKENS }) {
    function VideoTaskProgress({ block = {}, toolName = "metaontic_agent_forge_video_generate", callId, useMetaonticAgentForgeVideoExecutions, startedAt }) {
      const done = "kind" in block;
      const executions = useMetaonticAgentForgeVideoExecutions?.((snapshot) => snapshot);
      const beganAt = startedAt ?? executions?.get(callId);
      const [elapsed, setElapsed] = React.useState(0);
      React.useEffect(() => {
        if (done || beganAt === void 0)
          return;
        const tick = () => setElapsed(Math.max(0, Math.floor((Date.now() - beganAt) / 1e3)));
        tick();
        const timer = window.setInterval(tick, 1e3);
        return () => window.clearInterval(timer);
      }, [done, callId, beganAt]);
      if (done)
        return null;
      if (!["metaontic_agent_forge_video_generate", "metaontic_agent_forge_video_extend"].includes(toolName) || block.phase !== "start" || beganAt === void 0)
        return null;
      const status = "\u6B63\u5728\u751F\u6210 \xB7 \u7B49\u5F85\u7ED3\u679C";
      const duration = block.args?.duration;
      const estimatedWait = estimatedVideoWait(duration);
      const progress = estimatedVideoProgress(elapsed, duration);
      const waitingDots = ".".repeat(elapsed % 3 + 1);
      const title = toolName === "metaontic_agent_forge_video_extend" ? "\u89C6\u9891\u7EED\u62CD" : "\u89C6\u9891\u751F\u6210";
      return h("div", { className: "metaontic-agent-forge-task metaontic-agent-forge-task-running", "data-field": "video-task-progress" }, [
        h("style", { key: "style" }, `
          @keyframes metaontic-agent-forge-task-spin { to { transform: rotate(360deg); } }
          @keyframes metaontic-agent-forge-task-flow { from { background-position:0 0; } to { background-position:32px 0; } }
          @keyframes metaontic-agent-forge-task-shimmer { from { transform:translateX(-120%); } to { transform:translateX(420%); } }
          @keyframes metaontic-agent-forge-task-pulse { 0%,100% { opacity:.45; } 50% { opacity:1; } }
          @keyframes metaontic-agent-forge-task-breath { 0%,100% { border-color:${TOKENS.border}; box-shadow:0 0 0 0 transparent; } 50% { border-color:${TOKENS.primaryFill}; box-shadow:0 0 12px 0 ${TOKENS.primaryFill}; } }
          .metaontic-agent-forge-task { box-sizing:border-box; min-width:0; width:100%; border:1px solid ${TOKENS.border}; border-radius:10px; padding:10px 12px; color:${TOKENS.text}; margin:6px 0; overflow-wrap:anywhere; }
          .metaontic-agent-forge-task-running { animation:metaontic-agent-forge-task-breath 2.4s ease-in-out infinite; }
          .metaontic-agent-forge-task-head { display:flex; align-items:center; gap:10px; flex-wrap:wrap; font-size:13px; }
          .metaontic-agent-forge-task-spinner { width:14px; height:14px; border:2px solid ${TOKENS.border}; border-top-color:${TOKENS.primaryFill}; border-radius:50%; animation:metaontic-agent-forge-task-spin .9s linear infinite; }
          .metaontic-agent-forge-task-note { font-size:12px; color:${TOKENS.muted}; margin-top:8px; }
          .metaontic-agent-forge-task-rail { position:relative; margin-top:20px; }
          .metaontic-agent-forge-task-track { height:5px; border-radius:999px; overflow:hidden; background:${TOKENS.border}; }
          .metaontic-agent-forge-task-turtle { position:absolute; top:-14px; transform:translateX(-50%) scaleX(-1); font-size:12px; line-height:1; transition:left 1s ease; }
          .metaontic-agent-forge-task-fill { height:100%; border-radius:999px; background:${TOKENS.primaryFill}; transition:width 1s ease; position:relative; overflow:hidden; }
          .metaontic-agent-forge-task-active .metaontic-agent-forge-task-fill { background-image:repeating-linear-gradient(110deg,transparent 0px,transparent 12px,rgba(255,255,255,.22) 12px,rgba(255,255,255,.22) 22px,transparent 22px,transparent 32px); background-size:32px 100%; animation:metaontic-agent-forge-task-flow 1s linear infinite; }
          .metaontic-agent-forge-task-active .metaontic-agent-forge-task-fill::after { content:''; position:absolute; inset:0; width:30%; background:linear-gradient(90deg,transparent,rgba(255,255,255,.6),transparent); animation:metaontic-agent-forge-task-shimmer 2s linear infinite; }
          .metaontic-agent-forge-task-live { display:inline-block; width:6px; height:6px; border-radius:50%; background:${TOKENS.primaryFill}; margin-right:6px; animation:metaontic-agent-forge-task-pulse 1.4s ease-in-out infinite; }
          .metaontic-agent-forge-task-dots { display:inline-block; width:18px; text-align:left; }
          @media(prefers-reduced-motion:reduce) { .metaontic-agent-forge-task-spinner, .metaontic-agent-forge-task-live, .metaontic-agent-forge-task-active .metaontic-agent-forge-task-fill, .metaontic-agent-forge-task-active .metaontic-agent-forge-task-fill::after { animation:none; } .metaontic-agent-forge-task-turtle { transition:none; } .metaontic-agent-forge-task-running { animation:none; } }
        `),
        h("div", { key: "head", className: "metaontic-agent-forge-task-head" }, [
          h("span", { key: "spinner", className: "metaontic-agent-forge-task-spinner", "aria-hidden": true }),
          h("strong", { key: "title" }, title),
          h("span", { key: "status", role: "status" }, [status, h("span", { key: "dots", className: "metaontic-agent-forge-task-dots", "aria-hidden": true }, waitingDots)]),
          h("span", { key: "elapsed", style: { marginLeft: "auto", fontVariantNumeric: "tabular-nums" } }, `\u5DF2\u7B49\u5F85 ${Math.floor(elapsed / 60)}\u5206${String(elapsed % 60).padStart(2, "0")}\u79D2`)
        ]),
        h("div", { key: "progress", className: "metaontic-agent-forge-task-rail" }, [
          h("div", { className: "metaontic-agent-forge-task-track metaontic-agent-forge-task-active", role: "progressbar", "aria-label": "\u4F30\u7B97\u8FDB\u5EA6", "aria-valuemin": 0, "aria-valuemax": 100, "aria-valuenow": progress }, h("div", { className: "metaontic-agent-forge-task-fill", style: { width: `${progress}%` } })),
          // 装饰用的小乌龟：跟着进度条填充的右端一起从左往右爬，只表示「还在忙」，不代表真实进度；屏幕阅读器不读它。
          h("span", { key: "turtle", className: "metaontic-agent-forge-task-turtle", style: { left: `${progress}%` }, "aria-hidden": true }, "\u{1F422}")
        ]),
        h("div", { key: "percent", className: "metaontic-agent-forge-task-note" }, `${progress}% \xB7 \u4F30\u7B97\u8FDB\u5EA6`),
        h("div", { key: "note", className: "metaontic-agent-forge-task-note" }, [
          h("span", { key: "live", className: "metaontic-agent-forge-task-live", "aria-hidden": true }),
          `${duration ? `\u76EE\u6807 ${duration} \u79D2 \xB7 \u9884\u8BA1\u7B49\u5F85\u7EA6 ${Math.round(estimatedWait)} \u79D2 \xB7 ` : ""}${progress >= 99 ? "\u4EFB\u52A1\u4ECD\u5728\u7B49\u5F85\u7ED3\u679C\uFF0C\u8FDB\u5EA6\u505C\u572899%\u4E0D\u8868\u793A\u5931\u8D25\u3002" : "\u4EFB\u52A1\u5904\u7406\u4E2D\uFF0C\u5B8C\u6210\u540E\u81EA\u52A8\u663E\u793A\u7ED3\u679C\u3002"}\u8BF7\u52FF\u91CD\u590D\u63D0\u4EA4\u3002`
        ])
      ]);
    }
    function VideoProgressDock({ useChat, useMetaonticAgentForgeVideoExecutions }) {
      const chat = useChat((snapshot) => snapshot);
      const executions = useMetaonticAgentForgeVideoExecutions?.((snapshot) => snapshot);
      const calls = activeVideoCalls(chat).filter((call) => call.block.phase === "start" && executions?.has(call.callId));
      if (!calls.length)
        return null;
      return h("div", {
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
      }, calls.map((call) => h(VideoTaskProgress, { ...call, startedAt: executions.get(call.callId), key: call.callId })));
    }
    return { videoExecutionSource, VideoTaskProgress, VideoProgressDock };
  }

  // src/businesses/video/connection-defaults.ts
  var METAONTIC_BASE_URL = "https://ai.bileego.com";
  var VOLCENGINE_MODE_AVAILABLE = false;
  var IMAGE_MODEL = "doubao-seedream-5-0-pro-260628";
  var RETIRED_IMAGE_MODELS = ["doubao-seedream-5-0-260128"];
  function resolveImageModel(value) {
    const model = String(value ?? "").trim();
    if (!model || RETIRED_IMAGE_MODELS.includes(model)) return IMAGE_MODEL;
    return model;
  }
  function connectionDefaults(values) {
    const text = (key, fallback) => String(values[key] ?? "").trim() || fallback;
    const volc = values.connectionMode === "volcengine";
    return {
      ...volc ? { baseUrl: "https://ark.cn-beijing.volces.com" } : { baseUrl: text("baseUrl", METAONTIC_BASE_URL).replace(/\/+$/, "") },
      submitPath: volc ? "/api/v3/contents/generations/tasks" : text("submitPath", "/doubao/api/v3/contents/generations/tasks"),
      queryPath: volc ? "/api/v3/contents/generations/tasks/{task_id}" : text("queryPath", "/doubao/api/v3/contents/generations/tasks/{task_id}"),
      model: text("model", "doubao-seedance-2-0-mini-260615"),
      imageModel: resolveImageModel(text("imageModel", IMAGE_MODEL)),
      imageUseVideoKey: values.imageUseVideoKey !== false
    };
  }

  // src/businesses/video/client/config.ts
  function createClientConfig() {
    const NAMESPACE2 = "metaontic-agent-forge";
    const NS2 = "settings.metaonticAgentForge";
    const MODEL_OPTIONS = [
      "doubao-seedance-2-0-mini-260615",
      "doubao-seedance-2-0-fast-260128"
    ];
    const SELECTS = {
      // MetaOntic AI；火山直连按开关提供。
      connectionMode: VOLCENGINE_MODE_AVAILABLE ? ["metaontic", "volcengine"] : ["metaontic"],
      model: MODEL_OPTIONS,
      // 图片模型只提供在售的 pro 版；旧型号已下线，存量配置由 resolveImageModel 归一到这一项。
      imageModel: [IMAGE_MODEL],
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
      { key: "usageStatsEnabled", kind: "switch" },
      { key: "seamTrimSeconds", kind: "text" },
      { key: "mergeMode", kind: "select", wide: true },
      { key: "pollIntervalMs", kind: "number" },
      { key: "maxWaitMs", kind: "number" },
      { key: "ffmpegBinary", kind: "text", mono: true },
      { key: "ffprobeBinary", kind: "text", mono: true }
    ];
    const FIELD_BY_KEY = Object.fromEntries(FIELDS.map((field) => [field.key, field]));
    const PLUGIN_OWNED_KEYS = [
      "usageStatsEnabled",
      "connectionMode",
      "metaonticApiKey",
      "volcengineApiKey",
      "baseUrl",
      "model",
      "imageModel",
      "imageUseVideoKey",
      "imageApiKey"
    ];
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
    return { PLUGIN_OWNED_KEYS, SELECTS, optionLabel, FIELD_BY_KEY, SECTIONS, formatMoney, NS: NS2, NAMESPACE: NAMESPACE2 };
  }

  // src/businesses/video/client/locale.ts
  function createDictionaries() {
    const zh = {
      summaryEmpty: "\u8BF7\u9009\u62E9\u63A5\u5165\u65B9\u5F0F\uFF0C\u586B\u5199 API\u5BC6\u94A5\u540E\u4FDD\u5B58\u3002",
      summary: "{provider} \xB7 {model}",
      apiKeyConfigured: "\u5DF2\u914D\u7F6E\uFF0C\u7559\u7A7A\u4FDD\u7559\u73B0\u6709 API\u5BC6\u94A5",
      connectionMode: "\u63A5\u5165\u65B9\u5F0F",
      connectionModeHint: "\u4F7F\u7528\u81EA\u5DF1\u7684 MetaOntic AI API\u5BC6\u94A5\u3002\u5207\u6362\u540E\u4FDD\u5B58\u751F\u6548\u3002",
      connectionVolcengineUnavailable: "\u706B\u5C71\u5F15\u64CE\u76F4\u8FDE\u5F53\u524D\u6682\u4E0D\u63D0\u4F9B\u9009\u62E9\uFF1A\u5DF2\u6709\u7684\u914D\u7F6E\u4ECD\u53EF\u7EE7\u7EED\u751F\u6210\uFF1B\u5982\u9700\u66F4\u6362\uFF0C\u8BF7\u5728\u300C\u63A5\u5165\u65B9\u5F0F\u300D\u91CC\u9009\u62E9 MetaOntic AI\u3002",
      connectionMetaonticHint: "\u4F7F\u7528 MetaOntic AI \u7684 API\u5BC6\u94A5\uFF0C\u586B\u5199\u540E\u4FDD\u5B58\u751F\u6548\u3002",
      connectionMetaonticRegister: "\u6CE8\u518C\u83B7\u53D6 API\u5BC6\u94A5",
      volcengineKeyHint: "\u586B\u5199\u706B\u5C71\u65B9\u821F\u63A7\u5236\u53F0\u7684 API\u5BC6\u94A5\u540E\u4FDD\u5B58\uFF0C\u8D39\u7528\u7531\u706B\u5C71\u5F15\u64CE\u8D26\u6237\u627F\u62C5\u3002\u9700\u8981\u81EA\u884C\u6838\u5BF9\u597D API\u5BC6\u94A5\u7684\u6A21\u578B\u80FD\u529B\u3002",
      metaontic: "MetaOntic AI",
      metaonticApiKey: "MetaOntic AI API\u5BC6\u94A5",
      showKey: "\u663E\u793A API\u5BC6\u94A5",
      hideKey: "\u9690\u85CF API\u5BC6\u94A5",
      metaonticKeyHint: "\u586B\u5199 API\u5BC6\u94A5\u540E\u4FDD\u5B58\uFF0C\u65E0\u9700\u90AE\u7BB1\u767B\u5F55\u3002\u6309\u5B9E\u9645\u8C03\u7528\u8BA1\u8D39\uFF0C\u8D39\u7528\u4E0E\u7528\u91CF\u8BF7\u5728\u6E20\u9053\u5E73\u53F0\u67E5\u770B\u3002",
      volcengineApiKey: "\u706B\u5C71\u5F15\u64CE API\u5BC6\u94A5",
      volcengine: "\u706B\u5C71\u5F15\u64CE\u76F4\u8FDE",
      volcengineUnavailable: "\u706B\u5C71\u5F15\u64CE\u76F4\u8FDE\uFF08\u6682\u4E0D\u63D0\u4F9B\u9009\u62E9\uFF09",
      seamTrimSeconds: "\u63A5\u7F1D\u88C1\u526A\u79D2\u6570\uFF08\u5982 0.5,0\uFF09",
      modelHiddenCurrent: "\u5F53\u524D\u6A21\u578B\uFF08\u6682\u4E0D\u63D0\u4F9B\u9009\u62E9\uFF09",
      releaseNotesTitle: "\u66F4\u65B0\u5185\u5BB9",
      releaseUpdatedAt: "{time}",
      resetConfirm: "\u786E\u5B9A\u91CD\u7F6E\u63D2\u4EF6\u5417\uFF1F\u8FD9\u4F1A\u6E05\u9664\u672C\u63D2\u4EF6\u4FDD\u5B58\u7684\u914D\u7F6E\u548CAPI\u5BC6\u94A5\uFF0C\u9700\u8981\u91CD\u65B0\u914D\u7F6E\u3002\u5DF2\u751F\u6210\u7684\u89C6\u9891\u4E0D\u4F1A\u5220\u9664\u3002",
      model: "\u89C6\u9891\u6A21\u578B",
      imageModel: "\u56FE\u7247\u6A21\u578B",
      imageUseVideoKey: "\u56FE\u7247\u6A21\u578B\u4E0E\u89C6\u9891\u6A21\u578B\u5171\u7528 API\u5BC6\u94A5",
      sharedModelKey: "\u5171\u7528 API\u5BC6\u94A5",
      videoModelKey: "\u89C6\u9891\u6A21\u578B API\u5BC6\u94A5",
      imageApiKey: "\u56FE\u7247\u6A21\u578B API\u5BC6\u94A5",
      resolution: "\u89C6\u9891\u6E05\u6670\u5EA6",
      imageModelHint: "Seedream\u53EF\u751F\u6210\u89D2\u8272\u56FE\uFF1B\u9047\u771F\u4EBA\u9650\u5236\u65F6\uFF0C\u7ECF\u540C\u610F\u53EF\u8F6C\u6362\u53C2\u8003\u56FE\u3002\u56FE\u7247\u8C03\u7528\u5355\u72EC\u8BA1\u8D39\uFF0C\u7ED3\u679C\u9700\u5BA1\u6838\u3002",
      modelHint: "mini \u4FA7\u91CD\u6210\u672C\uFF0Cfast \u4FA7\u91CD\u751F\u6210\u901F\u5EA6\u3002\u5B9E\u9645\u4EF7\u683C\u4EE5\u6240\u9009\u6E20\u9053\u4E3A\u51C6\u3002",
      mergeMode: "\u5408\u5E76\u65B9\u5F0F",
      mergeModeSeamless: "\u76F4\u63A5\u62FC\u63A5\uFF08\u65E7\u914D\u7F6E\u517C\u5BB9\uFF09",
      mergeModeCopy: "\u65E0\u635F\u62FC\u63A5",
      mergeModeReencode: "\u91CD\u7F16\u7801\u62FC\u63A5",
      ffmpegBinary: "ffmpeg \u8DEF\u5F84",
      ffprobeBinary: "ffprobe \u8DEF\u5F84",
      ffmpegTitle: "\u957F\u89C6\u9891\u5408\u5E76\u9700\u8981 ffmpeg",
      ffmpegBody: "\u89C6\u9891\u8D85\u8FC7\u6A21\u578B\u5355\u6B21\u4E0A\u9650\uFF082.0 \u4E3A 15 \u79D2\u30012.5 \u4E3A 30 \u79D2\uFF09\u65F6\u4F1A\u62C6\u6210\u51E0\u6BB5\u5206\u522B\u751F\u6210\u3001\u518D\u5728\u672C\u673A\u5408\u5E76\u6210\u4E00\u6761\u2014\u2014\u5408\u5E76\u8FD9\u4E00\u6B65\u7528\u7684\u662F ffmpeg\u3002\u9ED8\u8BA4\u5408\u5E76\u524D\u4F1A\u68C0\u67E5\u662F\u5426\u5B89\u88C5\uFF1B\u660E\u786E\u9009\u62E9\u53EA\u751F\u6210\u5206\u6BB5\u65F6\u53EF\u4E0D\u5408\u5E76\u3002",
      ffmpegInstallFor: "\u6309\u4F60\u7684\u7CFB\u7EDF\u88C5\u4E00\u4E0B\uFF08\u70B9\u53F3\u8FB9\u6309\u94AE\u590D\u5236\u547D\u4EE4\uFF09\uFF1A",
      ffmpegCopy: "\u590D\u5236",
      ffmpegCopied: "\u5DF2\u590D\u5236",
      ffmpegMore: "\u5176\u4ED6\u7CFB\u7EDF",
      ffmpegLess: "\u6536\u8D77\u5176\u4ED6\u7CFB\u7EDF",
      ffmpegAfter: "\u4E0D\u60F3\u81EA\u5DF1\u6572\u547D\u4EE4\u7684\u8BDD\uFF0C\u76F4\u63A5\u5728\u5BF9\u8BDD\u91CC\u8BF4\u300C\u5E2E\u6211\u88C5 ffmpeg\u300D\u2014\u2014\u63D2\u4EF6\u4F1A\u6267\u884C\u5B89\u88C5\uFF08\u547D\u4EE4\u4F1A\u5148\u8BA9\u4F60\u786E\u8BA4\uFF09\uFF1B\u88C5\u597D\u540E\u7528\u539F\u6682\u505C\u8FDB\u5EA6\u91CD\u8BD5\u4E0B\u8F7D\u6216\u5408\u5E76\uFF0C\u4E0D\u91CD\u65B0\u63D0\u4EA4\u89C6\u9891\u751F\u6210\u3002ffmpeg \u88C5\u5728\u975E\u9ED8\u8BA4\u4F4D\u7F6E\u7684\u8BDD\uFF0C\u628A\u7EDD\u5BF9\u8DEF\u5F84\u586B\u5230\u4E0A\u9762\u7684\u300Cffmpeg \u8DEF\u5F84\u300D\u4E5F\u4E00\u6837\u7BA1\u7528\u3002\u5B89\u88C5\u5305\u81EA\u5E26 ffprobe\uFF0C\u5206\u6BB5\u65F6\u957F\u63A2\u6D4B\u4F1A\u4E00\u8D77\u89E3\u51B3\u3002",
      ffmpegManual: "\u60F3\u81EA\u5DF1\u88C5\uFF1AmacOS \u7528 Homebrew\uFF0CWindows \u7528 winget\uFF0CLinux \u7528\u7CFB\u7EDF\u5305\u7BA1\u7406\u5668\uFF1B\u88C5\u5B8C\u786E\u8BA4\u547D\u4EE4\u884C\u91CC\u80FD\u8DD1 ffmpeg -version \u5C31\u884C\u3002",
      supportContact: "\u5BA2\u670D",
      advancedStats: "\u4F7F\u7528\u7EDF\u8BA1",
      usageStatsEnabled: "\u533F\u540D\u4F7F\u7528\u7EDF\u8BA1",
      usageStatsHint: "\u7528\u4E8E\u7EDF\u8BA1\u9996\u6B21\u542F\u7528\u3001\u542F\u52A8\u548C\u529F\u80FD\u4F7F\u7528\u60C5\u51B5\uFF0C\u4EC5\u4E0A\u62A5\u533F\u540D\u6807\u8BC6\u3001\u7248\u672C\u3001\u57FA\u7840\u8BBE\u5907\u4FE1\u606F\u4E0E\u8C03\u7528\u7ED3\u679C\uFF0C\u4E0D\u542B\u5BF9\u8BDD\u3001\u7D20\u6750\u6216API\u5BC6\u94A5\u3002\u5173\u95ED\u4E0D\u5F71\u54CD\u89C6\u9891\u521B\u4F5C\u3002",
      authNoticeTitle: "\u670D\u52A1\u8FDE\u63A5\u9A8C\u8BC1\u672A\u901A\u8FC7",
      authNoticeHint: "\u8BF7\u5230 Harness \u7684\u6A21\u578B\u8BBE\u7F6E\u68C0\u67E5\u5F53\u524D API\u5BC6\u94A5\u548C\u4E2D\u8F6C\u5730\u5740\uFF1B\u5982\u679C\u914D\u7F6E\u65E0\u8BEF\uFF0C\u8BF7\u8054\u7CFB\u5BA2\u670D\u6838\u67E5\u3002",
      supportClose: "\u5173\u95ED",
      supportScan: "\u8BF7\u6309\u9875\u9762\u63D0\u793A\u4F7F\u7528\u5FAE\u4FE1\u8054\u7CFB\u5BA2\u670D\uFF0C\u54A8\u8BE2\u4F7F\u7528\u6216\u63A5\u5165\u95EE\u9898\u3002\u9875\u9762\u672A\u52A0\u8F7D\u65F6\u53EF\u70B9\u51FB\u4E0B\u65B9\u94FE\u63A5\u3002",
      supportOpenPage: "\u6253\u5F00\u5BA2\u670D\u9875\u9762",
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
      versionUpdateConfirmHint: "\u66F4\u65B0\u671F\u95F4\u8BBE\u7F6E\u9875\u53EF\u80FD\u77ED\u6682\u5173\u95ED\uFF0C\u73B0\u6709\u914D\u7F6E\u4E0E API\u5BC6\u94A5\u4F1A\u4FDD\u7559\u3002",
      versionUpdating: "\u66F4\u65B0\u4E2D\u2026",
      versionUpdateDone: "\u5DF2\u66F4\u65B0\u5230 v{version}\uFF0C\u5DF2\u901A\u8FC7\u70ED\u52A0\u8F7D\u751F\u6548\uFF0C\u65E0\u9700\u91CD\u542F\u3002\u73B0\u6709\u5BF9\u8BDD\u4E0B\u4E00\u8F6E\u4F7F\u7528\u6700\u65B0\u63D2\u4EF6\u89C4\u5219\u3002",
      versionUpdatePending: "v{version} \u5DF2\u5B89\u88C5\uFF0C\u5F53\u524D\u914D\u7F6E\u5C1A\u672A\u542F\u7528\u65B0\u7248\uFF0C\u8BF7\u5728\u63D2\u4EF6\u9875\u68C0\u67E5\u542F\u7528\u72B6\u6001\u3002",
      versionUpdateRestart: "\u65B0\u7248\u672C v{version} \u5DF2\u88C5\u597D\uFF1A\u91CD\u542F Harness \u540E\u751F\u6548\u3002",
      versionUpdateCancelled: "\u66F4\u65B0\u5DF2\u53D6\u6D88\u3002",
      versionUpdateRetry: "\u66F4\u65B0\u672A\u5B8C\u6210\uFF0C\u6B63\u5728\u91CD\u8BD5\uFF08{attempt}/{total}\uFF09\u2026",
      versionUpdateFailed: "\u5728\u7EBF\u66F4\u65B0\u5931\u8D25\uFF1A{message}",
      versionUpdateRemoved: "\u672A\u80FD\u786E\u8BA4\u63D2\u4EF6\u5B89\u88C5\u72B6\u6001\uFF0C\u8BF7\u5230\u300C\u63D2\u4EF6\u300D\u9875\u68C0\u67E5\uFF1B\u4FDD\u7559\u73B0\u6709\u914D\u7F6E\uFF0C\u4E0D\u8981\u76F4\u63A5\u5378\u8F7D\u3002",
      versionUpdateRateLimited: "Gitee \u8BF7\u6C42\u8FC7\u4E8E\u9891\u7E41\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5\u3002\u73B0\u6709\u914D\u7F6E\u4E0E API\u5BC6\u94A5\u4F1A\u4FDD\u7559\u3002",
      versionUpdateLockfile: "\u5B89\u88C5\u76EE\u5F55\u7684 pnpm-lock.yaml \u91CC\u6709\u672C\u63D2\u4EF6\u7F3A\u5C11 integrity \u7684\u65E7\u8BB0\u5F55\uFF0Cpnpm \u56E0\u6B64\u62D2\u7EDD\u5B89\u88C5\uFF08ERR_PNPM_MISSING_TARBALL_INTEGRITY\uFF09\u3002\u63D2\u4EF6\u4F1A\u6BCF 2 \u79D2\u68C0\u67E5\u4E00\u6B21\u3001\u81EA\u52A8\u6E05\u7406\u8FD9\u4E9B\u65E0\u6548\u8BB0\u5F55\u5E76\u4FDD\u7559\u5907\u4EFD\uFF0C\u66F4\u65B0\u5931\u8D25\u540E\u4E5F\u4F1A\u7B49\u6E05\u7406\u5B8C\u6210\u81EA\u52A8\u91CD\u8BD5\uFF1B\u82E5\u4ECD\u7136\u5931\u8D25\uFF0C\u5B8C\u5168\u9000\u51FA Harness \u540E\u624B\u52A8\u5220\u9664\u63D2\u4EF6\u5B89\u88C5\u76EE\u5F55\u4E0B\u7684 pnpm-lock.yaml \u518D\u8BD5\u3002",
      versionUpdateUnavailable: "\u5F53\u524D Harness \u4E0D\u652F\u6301\u6B64\u5728\u7EBF\u66F4\u65B0\u5165\u53E3\uFF0C\u8BF7\u4FDD\u7559\u73B0\u6709\u63D2\u4EF6\u4E0E\u914D\u7F6E\uFF0C\u53C2\u8003\u4F7F\u7528\u8BF4\u660E\u901A\u8FC7\u6B63\u5F0F\u7248\u6210\u54C1\u5305\u66F4\u65B0\u3002",
      versionHint: "\u53EF\u5728\u6B64\u68C0\u67E5\u5E76\u5B89\u88C5\u65B0\u7248\u672C\uFF0C\u73B0\u6709\u914D\u7F6E\u4E0E API\u5BC6\u94A5\u4F1A\u4FDD\u7559\u3002",
      versionCheckedAt: "\u68C0\u67E5\u4E8E {time}",
      sectionGeneration: "\u751F\u6210\u53C2\u6570",
      sectionConnection: "\u63A5\u5165\u4E0E API\u5BC6\u94A5",
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
      resetHint: "\u6E05\u9664\u672C\u673A\u4FDD\u5B58\u7684 API\u5BC6\u94A5\u4E0E\u81EA\u5B9A\u4E49\u8BBE\u7F6E\uFF0C\u6062\u590D\u9ED8\u8BA4\u914D\u7F6E\u3002",
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
      connectionModeHint: "Log in by email to receive a key, or use your own MetaOntic AI key. Save to apply a change.",
      connectionVolcengineUnavailable: 'Volcano Engine direct is not offered right now. An existing configuration keeps working; switch to MetaOntic AI in "Connection" to change it.',
      connectionMetaonticHint: "Use your MetaOntic AI API key, then save to apply.",
      connectionMetaonticRegister: "Register to get a key",
      volcengineKeyHint: "Enter an API key from the Volcano Ark console and save. No email login required. Billed to your Volcano Engine account. Check which models your key can access.",
      metaontic: "MetaOntic AI",
      metaonticApiKey: "MetaOntic AI API key",
      showKey: "Show key",
      hideKey: "Hide key",
      metaonticKeyHint: "Enter an API key and save. No email login required. Check actual charges and usage on your provider platform.",
      volcengineApiKey: "Volcano Engine API key",
      volcengine: "Volcano Engine",
      volcengineUnavailable: "Volcano Engine (not offered right now)",
      seamTrimSeconds: "Seam head trims (e.g. 0.5,0)",
      modelHiddenCurrent: "Current model (selection unavailable)",
      releaseNotesTitle: "Release notes",
      releaseUpdatedAt: "{time}",
      resetConfirm: "Reset this plugin? Saved settings, API keys and login state will be cleared. Generated videos will be kept.",
      model: "Video model",
      imageModel: "Image model",
      imageUseVideoKey: "Use video API key for images",
      sharedModelKey: "Shared key",
      videoModelKey: "Video model key",
      imageApiKey: "Image model key",
      resolution: "Video resolution",
      imageModelHint: "Seedream creates character images or, with consent after a real-person restriction, stylizes references. Image calls are billed separately and results require review.",
      modelHint: "mini focuses on cost; fast focuses on generation speed. Actual prices depend on your provider.",
      mergeMode: "Merge mode",
      mergeModeSeamless: "Direct concat (legacy setting)",
      mergeModeCopy: "Stream copy",
      mergeModeReencode: "Re-encode",
      ffmpegBinary: "ffmpeg path",
      ffprobeBinary: "ffprobe path",
      ffmpegTitle: "Merging long videos needs ffmpeg",
      ffmpegBody: "Videos exceeding the model limit (15s for 2.0, 30s for 2.5) are generated as several shots and merged into one file on this machine using ffmpeg. The default merge workflow checks for ffmpeg first; you may explicitly choose separate segments without merging.",
      ffmpegInstallFor: "Install it for your OS (click the button to copy the command):",
      ffmpegCopy: "Copy",
      ffmpegCopied: "Copied",
      ffmpegMore: "Other systems",
      ffmpegLess: "Hide other systems",
      ffmpegAfter: 'Rather not touch a terminal? Just say "\u5E2E\u6211\u88C5 ffmpeg" in the chat and the plugin runs the install after you confirm the command. Resume the original saved progress to retry downloading or merging without submitting new generation tasks. Installed somewhere unusual? Put the absolute path in the "ffmpeg path" field above. The package ships ffprobe too, so segment probing is fixed at the same time.',
      ffmpegManual: "Installing by hand: Homebrew on macOS, winget on Windows, your distro package manager on Linux \u2014 you are set once `ffmpeg -version` works in a terminal.",
      supportContact: "Support",
      advancedStats: "Usage statistics",
      usageStatsEnabled: "Anonymous usage statistics",
      usageStatsHint: "Reports an anonymous installation ID, version, basic device information and operation results. No conversations, media or API keys. Turning it off does not affect video creation.",
      authNoticeTitle: "Service authentication could not be verified",
      authNoticeHint: "Check the API key and relay URL in Harness model settings. If they are correct, contact support.",
      supportClose: "Close",
      supportScan: "Follow the page instructions to contact support with WeChat for usage or connection questions. If it does not load, use the link below.",
      supportOpenPage: "Open support page",
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
      versionUpdateRemoved: "The installation state could not be confirmed. Check the Plugins page and preserve your configuration; do not uninstall immediately.",
      versionUpdateRateLimited: "Gitee is limiting requests. Try again later. Your settings and keys will be kept.",
      versionUpdateLockfile: "The profile pnpm-lock.yaml still has metaontic-agent-forge entries without integrity, so pnpm refuses to install (ERR_PNPM_MISSING_TARBALL_INTEGRITY). The plugin checks every 2 seconds, clears those invalid entries in the background and keeps a backup, and the update retries once the cleanup is done. If it still fails, quit Harness and delete pnpm-lock.yaml in the plugin install directory.",
      versionUpdateUnavailable: "This Harness version does not support this update entry. Keep the existing plugin and configuration; follow the guide to update using a stable release package.",
      versionHint: "Check for and install updates here. Your settings and keys will be kept.",
      versionCheckedAt: "checked {time}",
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

  // src/core/settings/state.ts
  function createFormState({ React }) {
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
        globalThis.console?.warn?.("[MetaOntic Agent Forge] settings-save", {
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
    return { useSnapshot, same, persistBatch };
  }

  // src/businesses/video/client/state.ts
  function createSettingsState({ React }) {
    const { useSnapshot, same, persistBatch } = createFormState({ React });
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
      if (!["metaontic", "volcengine"].includes(nextMode)) throw new Error("unknownConnection");
      const inactiveKeys = nextMode === "volcengine" ? ["metaonticApiKey", "baseUrl", "submitPath", "queryPath"] : ["volcengineApiKey"];
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
  function createUpdates({ h, fetchSource }) {
    const PLUGIN_PACKAGE = "metaontic-agent-forge";
    const UPDATE_SPEC = "git+https://gitee.com/hadlooop/metaontic-agent-forge.git";
    const UPDATE_ATTEMPTS = 3;
    const UPDATE_CACHE_KEY = "metaontic-agent-forge.update-check-v3";
    const UPDATE_MAX_AGE_MS = 6 * 60 * 60 * 1e3;
    const PLUGIN_VERSION = true ? "1.0.0".trim().replace(/^v/i, "") : "";
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
        { key: "update-bell", className: "metaontic-agent-forge-update-bell", "data-field": "update-bell", role: "img", "aria-label": label, title: label },
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
        "https://gitee.com/api/v5/repos/hadlooop/metaontic-agent-forge/releases?per_page=100",
        "https://api.github.com/repos/wxsimon2022/metaontic-agent-forge/releases?per_page=100"
      ];
      const results = await Promise.allSettled(urls.map(async (url) => {
        const body = await (await (fetchSource || fetchUpdateSource)(url, 6e3)).json();
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
          context.setUpdateMessage("\u5F53\u524D\u4E3A\u672C\u5730\u76EE\u5F55\u94FE\u63A5\u5B89\u88C5\uFF0C\u5DF2\u505C\u6B62\u5728\u7EBF\u66F4\u65B0\uFF0C\u672A\u6267\u884C\u66FF\u6362\u3002\u76EE\u5F55\u94FE\u63A5\u5207\u6362\u4E3A\u6210\u54C1\u5305\u5B58\u5728\u6587\u4EF6\u88AB\u6E05\u7A7A\u6216\u4ECD\u52A0\u8F7D\u65E7\u76EE\u5F55\u7684\u98CE\u9669\u3002\u8BF7\u5148\u5907\u4EFD\u5E76\u4FDD\u7559\u539F\u76EE\u5F55\uFF0C\u4F7F\u7528\u6210\u54C1\u5305\u8FC1\u79FB\u6D41\u7A0B\uFF1B\u82E5\u76EE\u5F55\u5DF2\u7A7A\uFF0C\u5148\u6062\u590D\u5B8C\u6574package\u3002\u4E0D\u8981\u91CD\u7F6E API\u5BC6\u94A5\u6216\u76F4\u63A5\u5378\u8F7D\u3002");
          return;
        }
        if (bundle.error || bundle.meta?.error) throw new Error("metadata-unavailable");
      } catch {
        context.setUpdateStatus("failed");
        context.setUpdateMessage("\u65E0\u6CD5\u6838\u5B9E\u63D2\u4EF6\u5B89\u88C5\u6765\u6E90\u6216\u5143\u4FE1\u606F\uFF0C\u5DF2\u505C\u6B62\u66F4\u65B0\uFF0C\u672A\u6267\u884C\u66FF\u6362\u3002\u8BF7\u4FDD\u7559\u73B0\u6709\u914D\u7F6E\u548C\u5B89\u88C5\u76EE\u5F55\uFF0C\u6838\u5BF9\u5B89\u88C5\u72B6\u6001\u540E\u518D\u5904\u7406\uFF1B\u4E0D\u8981\u91CD\u7F6E API\u5BC6\u94A5\u6216\u5148\u5378\u8F7D\u3002");
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
        `https://gitee.com/hadlooop/metaontic-agent-forge/releases/download/v${context.updateLatest}/metaontic-agent-forge-${context.updateLatest}.tgz`,
        `https://github.com/wxsimon2022/metaontic-agent-forge/releases/download/v${context.updateLatest}/metaontic-agent-forge-${context.updateLatest}.tgz`
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
          if (lockfileUnverifiable(text)) {
            if (round < context.UPDATE_ATTEMPTS) {
              context.setUpdateMessage(context.t("versionUpdateRetry", { attempt: round + 1, total: context.UPDATE_ATTEMPTS }));
              await new Promise((resolve) => window.setTimeout(resolve, 5e3));
              continue;
            }
            return { failure: text, next: false, lockfile: true };
          }
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
    return h("div", { key: "update-notice", className: "metaontic-agent-forge-notice", role: "status", "data-field": "update-notice" }, [
      h("strong", { key: "title" }, t("versionNew", { version: latest })),
      h("p", { key: "optional" }, t("versionOptional")),
      confirmed ? h("p", { key: "confirm" }, t("versionUpdateConfirmHint")) : null,
      h("div", { key: "actions", className: "metaontic-agent-forge-cmd-row" }, [
        h(
          "button",
          {
            key: "update",
            type: "button",
            className: "metaontic-agent-forge-btn metaontic-agent-forge-btn-sm metaontic-agent-forge-btn-primary",
            "data-action": confirmed ? "update-notice-confirm" : "update-notice-open",
            onClick: onUpdate
          },
          confirmed ? t("versionUpdateConfirm", { version: latest }) : t("versionUpdate")
        ),
        h("button", { key: "later", type: "button", className: "metaontic-agent-forge-btn metaontic-agent-forge-btn-sm", "data-action": "update-later", onClick: onLater }, t("versionLater"))
      ])
    ]);
  }
  function formatReleaseTime(value) {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) return "";
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return "";
    return new Date(date.getTime() + 8 * 60 * 60 * 1e3).toISOString().slice(0, 16).replace("T", " ");
  }

  // src/businesses/video/client/settings-actions.ts
  var HIDDEN_CONNECTION_MODES = [
    ...VOLCENGINE_MODE_AVAILABLE ? [] : ["volcengine"]
  ];
  function hiddenConnectionLabel(t, mode) {
    if (mode === "volcengine")
      return t(VOLCENGINE_MODE_AVAILABLE ? "volcengine" : "volcengineUnavailable");
    return t(mode);
  }
  function createSettingsActions(context) {
    async function save() {
      const { saveInFlight, connectionBusy, setSaveError, setStatus, form, draft, same, validateSettings, persistConnection, setDraft, flashStatus, settingsError } = context;
      if (saveInFlight.current)
        return;
      if (connectionBusy.current && !connectionBusy.pending)
        return;
      saveInFlight.current = true;
      setSaveError("");
      setStatus("saving");
      try {
        if (connectionBusy.pending)
          await connectionBusy.pending.catch(() => {
          });
        connectionBusy.current = true;
        const latest = form.getSnapshot().value || {};
        const nextMode = draft.connectionMode ?? latest.connectionMode ?? "metaontic";
        const changes = Object.entries(draft).filter(([key, next]) => !same(latest[key], next));
        validateSettings({ ...latest, ...draft });
        await persistConnection(form, changes, nextMode);
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
      const { connectionBusy, t, setSaveError, setStatus, snapshot, PLUGIN_OWNED_KEYS, persistBatch, form, setDraft, setVisibleKey, flashStatus, settingsError } = context;
      if (connectionBusy.current)
        return;
      if (!context.confirm(t("resetConfirm")))
        return;
      connectionBusy.current = true;
      setSaveError("");
      setStatus("saving");
      try {
        const targets = /* @__PURE__ */ new Set([...Object.keys(snapshot.user || {}), ...PLUGIN_OWNED_KEYS]);
        await persistBatch(form, [...targets].map((key) => ({ op: "unset", path: [key] })));
        setDraft({});
        setVisibleKey("");
        flashStatus("reset");
      } catch (error) {
        setSaveError(t("resetFailed", { message: settingsError(error) }));
        setStatus("failed");
      } finally {
        connectionBusy.current = false;
      }
    }
    function control(field) {
      const { draft, value, h, SELECTS, inputStyle, t, snapshot, visibleKey, setVisibleKey, edit, optionLabel } = context;
      const current = draft[field.key] !== void 0 ? draft[field.key] : value[field.key] ?? (["imageUseVideoKey", "usageStatsEnabled"].includes(field.key) ? true : field.key === "pollIntervalMs" ? 5e3 : field.key === "maxWaitMs" ? 6e5 : void 0);
      const secondsField = field.key === "pollIntervalMs" || field.key === "maxWaitMs";
      const displayed = secondsField && current !== void 0 && current !== "" ? Number(current) / 1e3 : current;
      const id = `metaontic-agent-forge-${field.key}`;
      if (field.kind === "switch") {
        return h("label", { key: "control", htmlFor: id, className: "metaontic-agent-forge-switch" }, h("input", {
          id,
          "data-field": field.key,
          type: "checkbox",
          checked: Boolean(current),
          onChange: (event) => edit(field.key, event.target.checked)
        }), h("span", null, t(field.key)));
      }
      if (field.kind === "select") {
        const options = SELECTS[field.key] || [];
        const hiddenModel = field.key === "model" && /seedance-2(?:-5|\.5)/i.test(String(current || ""));
        const hiddenMode = field.key === "connectionMode" && HIDDEN_CONNECTION_MODES.includes(String(current || ""));
        const legacyMerge = field.key === "mergeMode" && current === "seamless";
        const retiredImageModel = field.key === "imageModel" && !options.includes(String(current || ""));
        const removedMode = field.key === "connectionMode" && !["metaontic", "volcengine"].includes(String(current || ""));
        const list = !removedMode && current && !options.includes(current) && !hiddenModel && !hiddenMode && !legacyMerge && !retiredImageModel ? [...options, current] : options;
        return h("select", {
          key: "control",
          id,
          "data-field": field.key,
          className: `metaontic-agent-forge-input${field.mono ? " metaontic-agent-forge-mono" : ""}`,
          style: inputStyle,
          value: removedMode ? "" : legacyMerge ? "copy" : retiredImageModel ? options[0] ?? "" : current ?? "",
          onChange: (event) => edit(field.key, event.target.value)
        }, [
          removedMode ? h("option", { key: "select-connection", value: "", disabled: true }, t("unknownConnection")) : null,
          hiddenModel ? h("option", { key: "hidden-current", value: current, hidden: true }, t("modelHiddenCurrent")) : null,
          // 下架期间直接标出不可用；恢复后这一支不会走到（该方式会回到候选里）。
          hiddenMode ? h("option", { key: "hidden-current", value: current, hidden: true }, hiddenConnectionLabel(t, String(current || ""))) : null,
          ...list.map((option) => h("option", { key: option, value: option }, optionLabel(t, field.key, option)))
        ]);
      }
      const canReveal = field.key === "metaonticApiKey" || field.key === "volcengineApiKey" || field.key === "imageApiKey";
      const revealed = canReveal && visibleKey === field.key;
      const input = h("input", {
        // 这个 input 会和右侧眼睛按钮一起放进数组，React 要求数组子节点带 key
        key: "input",
        id,
        "data-field": field.key,
        className: `metaontic-agent-forge-input${field.mono ? " metaontic-agent-forge-mono" : ""}`,
        style: inputStyle,
        type: field.kind === "number" ? "number" : field.secret && !revealed ? "password" : "text",
        value: displayed ?? "",
        min: secondsField ? 1 : void 0,
        step: secondsField ? 1e-3 : void 0,
        placeholder: field.secret && (snapshot.secrets?.[field.key] || value[field.key]) ? t("apiKeyConfigured") : "",
        onChange: (event) => edit(field.key, field.kind === "number" && event.target.value !== "" ? secondsField ? Math.round(Number(event.target.value) * 1e3) : Number(event.target.value) : event.target.value)
      });
      if (!canReveal)
        return input;
      return h("div", { key: "control", className: "metaontic-agent-forge-key-control" }, [
        input,
        h("button", {
          key: "toggle",
          type: "button",
          className: "metaontic-agent-forge-key-eye",
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
    return { save, reset, control };
  }

  // package.json
  var package_default = {
    name: "metaontic-agent-forge",
    version: "1.0.0",
    description: "\u4E91\u667A\u5DE5\u574A \xB7 \u667A\u80FD\u4F53\u5E73\u53F0\uFF1A\u4E3A DeepSeek Harness \u63D0\u4F9B\u603B\u63A7\u8C03\u5EA6\u3001\u4E13\u4E1A Agent \u4E0E\u53EF\u6269\u5C55\u4E1A\u52A1\u6A21\u5757\uFF0C\u5185\u7F6E\u89C6\u9891\u521B\u4F5C\u4E0E\u5BA3\u4F20\u89C6\u9891\u5DE5\u4F5C\u6D41\u3002",
    license: "SEE LICENSE IN LICENSE",
    type: "module",
    keywords: [
      "metaontic-agent-forge",
      "deepseek-harness",
      "dsh-plugin",
      "agent-platform",
      "agent-orchestration",
      "multi-agent",
      "ai-video",
      "seedance",
      "long-video",
      "ffmpeg"
    ],
    repository: {
      type: "git",
      url: "git+https://github.com/wxsimon2022/metaontic-agent-forge.git"
    },
    homepage: "https://github.com/wxsimon2022/metaontic-agent-forge#readme",
    bugs: {
      url: "https://github.com/wxsimon2022/metaontic-agent-forge/issues"
    },
    exports: {
      ".": "./index.js",
      "./client": "./client.js",
      "./locale/*.json": "./locale/*.json",
      "./icon": "./icon.svg",
      "./package.json": "./package.json",
      "./presets/metaontic-agent-forge-video-director": "./presets/metaontic-agent-forge-video-director.js",
      "./presets/metaontic-agent-forge-video-director/locale/*.json": "./locale/presets/metaontic-agent-forge-video-director/*.json",
      "./presets/metaontic-agent-forge-promo-video": "./presets/metaontic-agent-forge-promo-video.js",
      "./presets/metaontic-agent-forge-promo-video/locale/*.json": "./locale/presets/metaontic-agent-forge-promo-video/*.json",
      "./presets/metaontic-agent-forge-video-director/icon": "./presets/icons/metaontic-agent-forge-video-director.svg",
      "./presets/metaontic-agent-forge-promo-video/icon": "./presets/icons/metaontic-agent-forge-promo-video.svg",
      "./presets/metaontic-agent-forge-studio": "./presets/metaontic-agent-forge-studio.js",
      "./presets/metaontic-agent-forge-studio/locale/*.json": "./locale/presets/metaontic-agent-forge-studio/*.json",
      "./presets/metaontic-agent-forge-studio/icon": "./presets/icons/metaontic-agent-forge-studio.svg",
      "./presets/metaontic-agent-forge-controls": "./presets/metaontic-agent-forge-controls.js",
      "./presets/metaontic-agent-forge-report": "./presets/metaontic-agent-forge-report.js",
      "./presets/metaontic-agent-forge-controls/locale/*.json": "./locale/presets/controls/*.json",
      "./presets/metaontic-agent-forge-controls/icon": "./icon.svg"
    },
    files: [
      "canvas",
      "vendor/infinite-canvas",
      "index.js",
      "client.js",
      "cordis.patch.yml",
      "skills",
      "locale/*.json",
      "icon.svg",
      "logo.svg",
      "README.en.md",
      "MetaOnticAgentForge\u4F7F\u7528\u8BF4\u660E\u4E66.md",
      "MetaOnticAgentForge\u4F7F\u7528\u8BF4\u660E\u4E66.pdf",
      "CHANGELOG.md",
      "LICENSE",
      "THIRD_PARTY_NOTICES.md",
      "presets/*.js",
      "locale/presets/**/*.json",
      "presets/icons/*.svg"
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
          "@deepseek-ai/dsh-api-remotes",
          "@deepseek-ai/dsh-client-ui-agent-preset",
          "@deepseek-ai/dsh-client-ui-sidebar-right"
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
      version: "1.0.0",
      prerelease: false,
      publishedAt: "2026-11-08T11:47:48.629Z",
      items: [
        "\u65B0\u589E\uFF1A\u603B\u63A7\u8C03\u5EA6\u4E13\u4E1A\u52A9\u624B\uFF0C\u652F\u6301\u4EFB\u52A1\u5173\u7CFB\u67E5\u770B\u4E0E\u6210\u679C\u6C47\u603B\u3002",
        "\u4F18\u5316\uFF1A\u4FEE\u590D\u8BBE\u7F6E\u4FDD\u5B58\u4E0E\u603B\u63A7\u5165\u53E3\u517C\u5BB9\u95EE\u9898\uFF0C\u8865\u9F50\u4E13\u4E1A\u52A9\u624B\u6D88\u606F\u56DE\u4F20\u3002"
      ]
    }
  };

  // src/businesses/video/client/settings.ts
  function createSettingsPage(deps) {
    const {
      useSnapshot,
      React,
      h,
      TOKENS,
      same,
      validateSettings,
      persistConnection,
      PLUGIN_OWNED_KEYS,
      persistBatch,
      PLUGIN_VERSION,
      UPDATE_CACHE_KEY,
      UPDATE_MAX_AGE_MS,
      fetchLatestVersion,
      SELECTS,
      inputStyle,
      optionLabel,
      FIELD_BY_KEY,
      SECTIONS,
      formatMoney,
      PLUGIN_PACKAGE,
      UPDATE_SPEC,
      UPDATE_ATTEMPTS,
      isNewerVersion,
      updateBell,
      PAGE_CSS
    } = deps;
    function makePage({ form, t, manager }) {
      return function ConfigPage(props) {
        const snapshot = useSnapshot(form);
        const value = snapshot.value || {};
        const [draft, setDraft] = React.useState({});
        const selectedMode = draft.connectionMode ?? value.connectionMode ?? "metaontic";
        const directMode = selectedMode === "volcengine";
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
        const { save, reset, control } = createSettingsActions({
          saveInFlight,
          connectionBusy,
          setSaveError,
          setStatus,
          form,
          draft,
          same,
          validateSettings,
          persistConnection,
          persistBatch,
          setDraft,
          flashStatus,
          settingsError,
          t,
          snapshot,
          PLUGIN_OWNED_KEYS,
          setVisibleKey,
          value,
          h,
          SELECTS,
          inputStyle,
          optionLabel,
          edit,
          visibleKey,
          confirm: (message) => window.confirm(message)
        });
        const hints = {
          connectionMode: selectedMode === "metaontic" ? [t("connectionMetaonticHint"), " ", h("a", { key: "metaontic-register", href: "https://ai.bileego.com/sign-up?aff=VzYr", target: "_blank", rel: "noopener noreferrer", style: { textDecoration: "underline" } }, t("connectionMetaonticRegister"))] : directMode && !VOLCENGINE_MODE_AVAILABLE ? t("connectionVolcengineUnavailable") : t("connectionModeHint"),
          metaonticApiKey: t("metaonticKeyHint"),
          volcengineApiKey: t("volcengineKeyHint"),
          model: t("modelHint"),
          imageModel: t("imageModelHint"),
          seamTrimSeconds: t("seamTrimSecondsHint"),
          maxWaitMs: t("waitSecondsHint")
        };
        function fieldCell(field) {
          const classes = ["metaontic-agent-forge-field"];
          if (field.kind === "switch") classes.push("metaontic-agent-forge-field-switch");
          if (field.wide) classes.push("metaontic-agent-forge-field-wide");
          return h("div", { key: field.key, className: classes.join(" ") }, [
            field.kind === "switch" ? null : h("label", { key: "label", className: "metaontic-agent-forge-label", htmlFor: `metaontic-agent-forge-${field.key}` }, t(["metaonticApiKey", "volcengineApiKey"].includes(field.key) ? !directMode && (draft.imageUseVideoKey ?? value.imageUseVideoKey ?? true) !== false ? "sharedModelKey" : "videoModelKey" : field.key)),
            control(field),
            hints[field.key] ? h("span", { key: "hint", className: "metaontic-agent-forge-hint", style: { marginTop: 4 } }, hints[field.key]) : null
          ]);
        }
        const renderGrid = (section) => {
          if (section.key === "sectionModels") {
            const shared2 = (draft.imageUseVideoKey ?? value.imageUseVideoKey ?? true) !== false;
            const common = !directMode ? [fieldCell(FIELD_BY_KEY.imageUseVideoKey), ...shared2 ? [fieldCell(FIELD_BY_KEY.metaonticApiKey)] : []] : [];
            const videoFields = ["model", ...directMode || !shared2 ? [directMode ? "volcengineApiKey" : "metaonticApiKey"] : []];
            const imageFields = ["imageModel", ...!shared2 ? ["imageApiKey"] : []];
            return h("div", { key: section.key, className: "metaontic-agent-forge-model-settings" }, [
              ...common,
              h("div", { key: "models", className: `metaontic-agent-forge-model-grid${directMode ? " metaontic-agent-forge-model-grid-single" : ""}` }, [
                h("div", { key: "video", className: "metaontic-agent-forge-model-card", "data-group": "video-model" }, videoFields.map((key) => fieldCell(FIELD_BY_KEY[key]))),
                !directMode ? h("div", { key: "image", className: "metaontic-agent-forge-model-card", "data-group": "image-model" }, imageFields.map((key) => fieldCell(FIELD_BY_KEY[key]))) : null
              ])
            ]);
          }
          if (section.key === "sectionVideo") {
            return h("div", { key: section.key, className: "metaontic-agent-forge-av-grid" }, [
              h("div", { key: "picture", className: "metaontic-agent-forge-av-card" }, [
                fieldCell(FIELD_BY_KEY.ratio),
                h("span", { key: "hint", className: "metaontic-agent-forge-hint" }, t("ratioLayoutHint"))
              ]),
              h("div", { key: "audio", className: "metaontic-agent-forge-av-card metaontic-agent-forge-av-audio" }, [
                h("span", { key: "label", className: "metaontic-agent-forge-label" }, t("audioSettings")),
                control(FIELD_BY_KEY.generateAudio),
                h("span", { key: "hint", className: "metaontic-agent-forge-hint" }, t("audioLayoutHint"))
              ])
            ]);
          }
          const shared = (draft.imageUseVideoKey ?? value.imageUseVideoKey ?? true) !== false;
          const videoKey = directMode ? "volcengineApiKey" : "metaonticApiKey";
          const fields = section.key === "sectionModels" ? directMode ? ["model", videoKey] : shared ? ["imageUseVideoKey", videoKey, "model", "imageModel"] : ["imageUseVideoKey", "model", videoKey, "imageModel", "imageApiKey"] : section.fields;
          return h(
            "div",
            { key: section.key, className: "metaontic-agent-forge-grid" },
            fields.filter((key) => (key !== "volcengineApiKey" || directMode) && (!["imageModel", "imageUseVideoKey", "imageApiKey"].includes(key) || !directMode) && (key !== "imageApiKey" || (draft.imageUseVideoKey ?? value.imageUseVideoKey ?? true) === false) && (key !== "metaonticApiKey" || selectedMode === "metaontic")).map((key) => fieldCell(FIELD_BY_KEY[key])).filter(Boolean)
          );
        };
        const settingsRows = () => [
          h("div", { key: "generation", className: "metaontic-agent-forge-section" }, [
            h("div", { key: "title", className: "metaontic-agent-forge-section-title" }, t("sectionGeneration")),
            ...SECTIONS.map((section) => h("div", { key: section.key, className: "metaontic-agent-forge-parameter-group" }, [
              h("div", { key: "heading", className: "metaontic-agent-forge-parameter-heading" }, t(section.key)),
              renderGrid(section)
            ]))
          ]),
          h("details", { key: "advanced", className: "metaontic-agent-forge-section metaontic-agent-forge-advanced" }, [
            h("summary", { key: "toggle", className: "metaontic-agent-forge-advanced-toggle" }, [
              h("span", { key: "title" }, t("sectionCombined")),
              h("span", { key: "hint", className: "metaontic-agent-forge-hint" }, t("sectionCombinedHint"))
            ]),
            h("div", { key: "body", className: "metaontic-agent-forge-advanced-body" }, [
              ...[
                { key: "advancedPicture", fields: ["watermark"] },
                { key: "advancedMerge", fields: ["mergeMode", "seamTrimSeconds"], hint: "segmentsRetained" },
                { key: "advancedWait", fields: ["pollIntervalMs", "maxWaitMs"] },
                { key: "advancedTools", fields: ["ffmpegBinary", "ffprobeBinary"], hint: "toolsHint" },
                { key: "advancedStats", fields: ["usageStatsEnabled"], hint: "usageStatsHint" }
              ].map((group) => h("div", { key: group.key, className: `metaontic-agent-forge-advanced-group${group.key === "advancedTools" ? " metaontic-agent-forge-advanced-tools" : ""}`, "data-group": group.key }, [
                h("div", { key: "title", className: "metaontic-agent-forge-parameter-heading" }, t(group.key)),
                renderGrid(group),
                group.hint ? h("p", { key: "hint", className: "metaontic-agent-forge-hint", style: { margin: 0 } }, t(group.hint)) : null
              ]))
            ])
          ])
        ];
        const overrides = Object.keys(snapshot.user || {});
        const footerMessage = status === "saved" ? t("saved") : status === "reset" ? t("resetDone") : status === "failed" ? saveError || t("saveFailed") : pending.length ? t("dirty") : "";
        const footer = pending.length || status !== "idle" ? h("div", { key: "footer", className: "metaontic-agent-forge-footer" }, [
          footerMessage ? h("span", {
            key: "status",
            style: {
              fontSize: 12,
              color: status === "failed" ? TOKENS.error : status === "saved" || status === "reset" ? TOKENS.success : TOKENS.muted
            }
          }, footerMessage) : null
        ]) : null;
        const resetRow = overrides.length || pending.length ? h("div", { key: "reset-row", className: "metaontic-agent-forge-footer metaontic-agent-forge-reset-row" }, [
          h("span", { key: "hint", className: "metaontic-agent-forge-hint", style: { flex: "1 1 200px" } }, t("resetHint")),
          pending.length ? h("button", {
            key: "save",
            "data-action": "save",
            type: "button",
            className: "metaontic-agent-forge-btn metaontic-agent-forge-btn-primary",
            disabled: status === "saving" || snapshot.writable === false,
            onClick: save
          }, status === "saving" ? t("saving") : t("save")) : null,
          h("button", {
            key: "reset",
            "data-action": "reset",
            type: "button",
            className: "metaontic-agent-forge-btn",
            disabled: status === "saving" || snapshot.writable === false,
            onClick: reset
          }, t("reset"))
        ]) : null;
        const updateAvailable = Boolean(updateLatest) && Boolean(PLUGIN_VERSION) && isNewerVersion(updateLatest, PLUGIN_VERSION);
        const updateText = updateStatus === "working" ? t("versionChecking") : updateStatus === "failed" ? updateMessage : updateStatus === "installing" ? t("versionUpdating") : updateStatus === "restart" || updateStatus === "applied" ? updateMessage : updateStatus === "ok" ? updateAvailable ? t("versionNew", { version: updateLatest }) : t("versionLatest") : "";
        const updateTone = updateStatus === "failed" ? TOKENS.error : updateStatus === "restart" || updateStatus === "applied" || updateAvailable ? TOKENS.success : TOKENS.muted;
        const versionBox = h("div", {
          key: "version",
          "data-field": "version",
          className: "metaontic-agent-forge-card"
        }, [
          h("div", { key: "head", className: "metaontic-agent-forge-card-head" }, [
            h("span", { key: "title", className: "metaontic-agent-forge-card-title" }, t("versionTitle")),
            h("span", {
              key: "current",
              "data-field": "versionCurrent",
              className: "metaontic-agent-forge-hint metaontic-agent-forge-current-version"
            }, [
              h("span", { key: "label" }, PLUGIN_VERSION ? t("versionCurrent", { version: PLUGIN_VERSION }) : ""),
              updateBell(t, updateLatest, PLUGIN_VERSION)
            ]),
            h("a", { key: "history", className: "metaontic-agent-forge-hint", href: "https://github.com/wxsimon2022/metaontic-agent-forge/blob/master/CHANGELOG.md", target: "_blank", rel: "noopener noreferrer" }, t("versionHistory")),
            h("button", {
              key: "check",
              "data-action": "update-check",
              type: "button",
              className: "metaontic-agent-forge-btn metaontic-agent-forge-btn-sm metaontic-agent-forge-trailing",
              disabled: updateStatus === "working" || updateStatus === "installing",
              onClick: () => {
                checkForUpdate(false).catch(() => {
                });
              }
            }, updateStatus === "working" ? t("versionChecking") : t("versionCheck"))
          ]),
          releaseNotes?.items?.length ? h("div", { key: "release-notes", "data-field": "releaseNotes" }, [
            h("div", { key: "heading", style: { display: "flex", alignItems: "baseline", gap: 12 } }, [
              h("span", { key: "title", className: "metaontic-agent-forge-card-title" }, `${releaseNotes.version} \xB7 ${t("releaseNotesTitle")}`),
              formatReleaseTime(releaseNotes.publishedAt) ? h("span", { key: "published-at", "data-field": "releasePublishedAt", className: "metaontic-agent-forge-foot-note" }, t("releaseUpdatedAt", { time: formatReleaseTime(releaseNotes.publishedAt) })) : null
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
            className: "metaontic-agent-forge-hint",
            style: { color: updateTone }
          }, updateText) : null,
          updateAvailable ? h("div", { key: "command", className: "metaontic-agent-forge-cmd-row" }, [
            // 点一下转成「确认更新」，再点一下让宿主重装本插件
            h("button", {
              key: "online",
              "data-action": "update-online",
              type: "button",
              className: "metaontic-agent-forge-btn metaontic-agent-forge-btn-sm metaontic-agent-forge-btn-primary",
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
            className: "metaontic-agent-forge-hint"
          }, t("versionUpdateConfirmHint")) : null,
          updateAvailable ? h("span", { key: "hint", className: "metaontic-agent-forge-hint" }, t("versionHint")) : null,
          updateStatus === "ok" && updateAt ? h("span", { key: "at", className: "metaontic-agent-forge-foot-note" }, t("versionCheckedAt", { time: updateAt })) : null
        ]);
        let notice = null;
        if (snapshot.status === "loading") notice = t("loading");
        else if (snapshot.value === void 0) notice = t("unavailable");
        else if (snapshot.writable === false) notice = t("readOnly");
        const blobs = notice && !snapshot.value ? [] : [footer, versionBox, resetRow];
        return h("div", { className: "metaontic-agent-forge-page" }, [
          // hover / focus 这类效果内联样式写不出来，集中在这张样式表里（class 都带 metaontic-agent-forge- 前缀）。
          h("style", { key: "styles" }, PAGE_CSS),
          h(
            "div",
            { key: "support-actions", className: "metaontic-agent-forge-card-head", style: { justifyContent: "flex-end", marginBottom: 12 } },
            h("button", {
              key: "support",
              type: "button",
              className: "metaontic-agent-forge-btn metaontic-agent-forge-btn-sm",
              "data-action": "contact-support",
              "aria-haspopup": "dialog",
              "aria-expanded": supportOpen,
              onClick: () => setSupportOpen(true)
            }, t("supportContact"))
          ),
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
          notice ? h("p", { key: "notice", className: "metaontic-agent-forge-notice" }, notice) : null,
          ...notice && !snapshot.value ? [] : settingsRows(),
          ...blobs,
          supportOpen ? h("dialog", {
            key: "support-dialog",
            ref: supportDialog,
            className: "metaontic-agent-forge-support-dialog",
            "aria-labelledby": "metaontic-agent-forge-support-title",
            onCancel: () => setSupportOpen(false),
            onClose: () => setSupportOpen(false),
            onClick: (event) => {
              if (event.target === event.currentTarget) {
                const rect = event.currentTarget.getBoundingClientRect();
                if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) setSupportOpen(false);
              }
            }
          }, h("div", { className: "metaontic-agent-forge-support-content" }, [
            h("div", { key: "heading", className: "metaontic-agent-forge-card-head" }, [
              h("strong", { key: "title", id: "metaontic-agent-forge-support-title" }, t("supportContact")),
              h("button", { key: "close", type: "button", className: "metaontic-agent-forge-btn metaontic-agent-forge-btn-sm metaontic-agent-forge-trailing", "aria-label": t("supportClose"), onClick: () => setSupportOpen(false) }, t("supportClose"))
            ]),
            h("p", { key: "hint", className: "metaontic-agent-forge-hint" }, t("supportScan")),
            h("iframe", { key: "qr", className: "metaontic-agent-forge-support-frame", title: t("supportContact"), src: "https://work.weixin.qq.com/kfid/kfcd6fc4ca793eeac18", referrerPolicy: "no-referrer" }),
            h("a", { key: "fallback", href: "https://work.weixin.qq.com/kfid/kfcd6fc4ca793eeac18", target: "_blank", rel: "noopener noreferrer" }, t("supportOpenPage"))
          ])) : null
        ]);
      };
    }
    return { makePage };
  }

  // src/businesses/video/client.ts
  function createVideoClient(require2) {
    const React = require2("react");
    const h = React.createElement;
    const { TOKENS, inputStyle, PAGE_CSS } = createTheme();
    const { MediaPreview } = createMediaPreview({ React, h });
    const { videoExecutionSource: videoExecutionSource2, VideoTaskProgress, VideoProgressDock } = createVideoProgress({ React, h, TOKENS });
    const { ToolResultView } = createToolResultView({ h, MediaPreview, VideoTaskProgress });
    const { PLUGIN_OWNED_KEYS, SELECTS, optionLabel, FIELD_BY_KEY, SECTIONS, formatMoney, NS: NS2, NAMESPACE: NAMESPACE2 } = createClientConfig();
    const { zh, en } = createDictionaries();
    const { useSnapshot, same, validateSettings, persistConnection, persistBatch } = createSettingsState({ React });
    const { PLUGIN_VERSION, UPDATE_CACHE_KEY, UPDATE_MAX_AGE_MS, fetchLatestVersion, PLUGIN_PACKAGE, UPDATE_SPEC, UPDATE_ATTEMPTS, isNewerVersion, updateBell } = createUpdates({ h });
    const { makePage } = createSettingsPage({ useSnapshot, React, h, TOKENS, same, validateSettings, persistConnection, PLUGIN_OWNED_KEYS, persistBatch, PLUGIN_VERSION, UPDATE_CACHE_KEY, UPDATE_MAX_AGE_MS, fetchLatestVersion, SELECTS, inputStyle, optionLabel, FIELD_BY_KEY, SECTIONS, formatMoney, PLUGIN_PACKAGE, UPDATE_SPEC, UPDATE_ATTEMPTS, isNewerVersion, updateBell, PAGE_CSS });
    return {
      inject: ["slots", "locale", "configForms", "uiSession"],
      apply(ctx, { settings }) {
        ctx.effect(() => ctx.uiSession.provide({
          hooks: ["metaonticAgentForgeVideoExecutions"],
          resolve: (binding) => ({ hooks: { metaonticAgentForgeVideoExecutions: videoExecutionSource2(binding.eventSource) } })
        }), "metaontic-agent-forge: actual video execution");
        const t = ctx.locale.bind(NS2);
        ctx.effect(() => ctx.locale.register(NS2, { zh, en }), "metaontic-agent-forge: dictionaries");
        ctx.effect(() => ctx.slots.inject("conversation.chat.node", () => registerAuthNotice(ctx, h, t)), "metaontic-agent-forge: friendly service authentication notice");
        const form = ctx.configForms.get(NAMESPACE2);
        for (const tool of ["metaontic_agent_forge_video_generate", "metaontic_agent_forge_video_extend", "metaontic_agent_forge_video_status", "metaontic_agent_forge_video_prepare_image"]) {
          ctx.effect(
            () => ctx.slots.inject("tool.call.toolview", () => ctx.slots.register({ name: "tool.call.toolview", key: tool, locale: NS2 }, ToolResultView)),
            `metaontic-agent-forge: ${tool} progress`
          );
        }
        ctx.effect(() => ctx.slots.inject("conversation.input.dock", () => ctx.slots.register(
          { name: "conversation.input.dock", id: "metaontic-agent-forge-progress", order: -20 },
          VideoProgressDock
        )), "metaontic-agent-forge: visible video progress");
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
        settings.register({ id: "video", namespace: NAMESPACE2, locale: NS2, Page });
      }
    };
  }

  // src/client.ts
  window.__ModuleLoader__.load({
    id: "metaontic-agent-forge",
    factory: (require2) => createClientRuntime(require2, [{ id: "platform", create: createPlatformClient }, { id: "video", create: createVideoClient }])
  });
})();
