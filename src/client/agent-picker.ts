/** 专业助手保留在宿主注册表中供委派和历史会话恢复，仅过滤选择界面。 */
const INTERNAL_AGENTS = new Set([
  'metaontic-agent-forge-video-director',
  'metaontic-agent-forge-promo-video',
]);
export function createAgentPickerView(h: any, Original: any, hook: string, field: string) {
  const cache = new WeakMap<object, any>();
  const project = (state: any) => {
    if (!state || !Array.isArray(state[field])) return state;
    if (cache.has(state)) return cache.get(state);
    const rows = state[field].filter((row: any) => !INTERNAL_AGENTS.has(row.id));
    const result = rows.length === state[field].length ? state : { ...state, [field]: rows };
    cache.set(state, result);
    return result;
  };
  return function AgentPickerView(props: any) {
    const source = props[hook];
    if (typeof source !== 'function') return h(Original, props);
    return h(Original, { ...props, [hook]: (select: any) => source((state: any) => select(project(state))) });
  };
}
/** 使用宿主槽位扩展，不修改预设注册表或远程接口；卸载即恢复。 */
export function registerAgentPicker(ctx: any, h: any) {
  if (typeof ctx.slots.entriesOfSlot !== 'function' || typeof ctx.slots.subscribe !== 'function') return;
  const wrappers = new WeakSet<object>();
  for (const spec of [
    { name: 'conversation.hero.agentPreset', hook: 'useAgentPresetSeat', field: 'options' },
    { name: 'settings.section', id: 'agent-presets', hook: 'useAgentPresetSection', field: 'rows' },
  ]) {
    ctx.effect(() => ctx.slots.inject(spec.name, () => {
      let original: any, dispose: any, syncing = false;
      const sync = () => {
        if (syncing) return;
        syncing = true;
        try {
          const next = ctx.slots.entriesOfSlot(spec.name)
            .filter((entry: any) => entry.component && !wrappers.has(entry.component) && (!spec.id || entry.options?.id === spec.id))
            .sort((a: any, b: any) => (a.options?.priority || 0) - (b.options?.priority || 0))[0];
          if (next === original) return;
          dispose?.(); dispose = undefined; original = next;
          if (!next) return;
          const Component = createAgentPickerView(h, next.component, spec.hook, spec.field);
          wrappers.add(Component);
          dispose = ctx.slots.register({
            ...next.options, name: spec.name,
            priority: (next.options?.priority || 0) - 1,
            locale: next.locale, inject: next.inject, select: next.select,
            store: next.store, children: next.children,
          }, Component);
        } finally { syncing = false; }
      };
      const unsubscribe = ctx.slots.subscribe(spec.name, sync);
      try { sync(); } catch (error) { unsubscribe(); dispose?.(); throw error; }
      return () => { unsubscribe(); dispose?.(); };
    }), `metaontic-agent-forge: ${spec.name} selector`);
  }
}
