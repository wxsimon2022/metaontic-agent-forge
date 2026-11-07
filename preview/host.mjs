/**
 * Standalone preview adapter for the host services consumed by the real client.
 *
 * 每个 slot 注册项按 `名称:key`（list 用 id、keyed 用 key）存下来，面板与设置页因此不会
 * 互相覆盖；`calls` 记录面板按钮触发的宿主动作，预览界面据此显示“点了什么”。
 */
export function createPreviewHost({ form, components, dictionaries, getLocale, onUpdate }) {
  const calls = [];
  // 左侧栏那一行的显示名由注册项的 label 给（宿主要求传函数），预览按同样方式取。
  const labels = {};
  const uuid = (() => { let n = 0; return () => `reg-${++n}`; })();
  return {
    calls,
    labels,
    locale: {
      register(ns, dictionary) { dictionaries[ns] = dictionary; },
      bind(ns) {
        return (key, args = {}) => String(dictionaries[ns]?.[getLocale()]?.[key] ?? key)
          .replace(/\{(\w+)\}/g, (_, name) => args[name] ?? `{${name}}`);
      },
    },
    configForms: { get: () => form },
    // The preview supplies startedAt directly to progress cards and has no real session.
    uiSession: { provide() { return () => {}; } },
    effect(fn) { return fn(); },
    slots: {
      register(spec, component) {
        const key = spec.key || spec.id;
        components[`${spec.name}:${key}`] = component;
        components[key] = components[key] ?? component;
        if (spec.inject) components[`${spec.name}:${key}:props`] = spec.inject;
        if (typeof spec.label === 'function') labels[`${spec.name}:${key}`] = spec.label;
        const token = uuid();
        return () => {
          delete components[`${spec.name}:${key}`];
          if (components[key] === component) delete components[key];
          delete components[`${spec.name}:${key}:props`];
          void token;
        };
      },
      inject(_slot, callback) {
        const result = callback();
        if (result?.next) for (const _ of result) {}
        return () => {};
      },
    },
    get(name) {
      if (name === 'uiWorkspace') {
        return { startSession: (workspaceId, options) => calls.push({ action: 'startSession', workspaceId, options }) };
      }
      if (name === 'pluginNavigation') {
        return { openBundle: (bundle) => calls.push({ action: 'openBundle', bundle }) };
      }
      if (name === 'layout') {
        return { selectPanel: (id) => calls.push({ action: 'selectPanel', id }) };
      }
      return { installBundle: async () => { onUpdate(); return {}; } };
    },
  };
}
