/** 通用表单订阅与原子保存，业务不参与宿主修订冲突处理。 */
export function createFormState({ React }: any) {
/** 订阅表单快照：宿主每次推送新值都会重渲染。 */
    function useSnapshot(form) {
      const subscribe = React.useCallback((listener) => form.subscribe(listener), [form]);
      const getSnapshot = React.useCallback(() => form.getSnapshot(), [form]);
      return React.useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
    }

    function same(a, b) {
      return a === b || (a === undefined && b === '') || (a === '' && b === undefined);
    }

    async function persistBatch(form, ops) {
      if (typeof form.mutate !== 'function') throw new Error('atomicUnsupported');
      // 宿主遇到修订冲突会先恢复快照再返回 false。仅在待写字段未变化时重试一次。
      function checkpoint() {
        try {
          const snapshot = form.getSnapshot?.();
          if (!snapshot || snapshot.status !== 'ready' || snapshot.writable === false || snapshot.revision == null) return null;
          const fields = ops.map(({ path }) => ['value', 'user', 'base', 'secrets'].map((source) => {
            let current = snapshot[source];
            for (const key of path) current = current?.[key];
            return current;
          }));
          return { revision: snapshot.revision, fields: JSON.stringify(fields) };
        } catch { return null; }
      }
      // 只记录固定分类及修订号；不记录操作、字段值或宿主原始错误。
      function fail(code, before, after) {
        globalThis.console?.warn?.('[MetaOntic Agent Forge] settings-save', {
          code, beforeRevision: before?.revision ?? null, afterRevision: after?.revision ?? null,
        });
        throw new Error(code);
      }
      function readiness() {
        let snapshot;
        try { snapshot = form.getSnapshot?.(); } catch { return 'settingsUnavailable'; }
        if (!snapshot) return null;
        if (snapshot.writable === false) return 'readOnly';
        if (snapshot.status && snapshot.status !== 'ready') return 'settingsUnavailable';
        return null;
      }
      const initialProblem = readiness();
      if (initialProblem) fail(initialProblem, null, null);
      const before = checkpoint();
      let accepted;
      try { accepted = await form.mutate(ops, before?.revision); }
      catch { fail('settingsTransport', before, null); }
      if (accepted) return;
      const after = checkpoint();
      const problem = readiness();
      if (problem) fail(problem, before, after);
      if (before && after && before.revision !== after.revision) {
        if (before.fields !== after.fields) fail('settingsConflict', before, after);
        // 固定恢复时的 revision，防止排队期间又发生修改后覆盖其他页面。
        try { accepted = await form.mutate(ops, after.revision); }
        catch { fail('settingsTransport', after, null); }
        if (accepted) return;
        const latest = checkpoint();
        fail(readiness() || (latest && latest.revision !== after.revision ? 'settingsConflict' : 'atomicRejected'), after, latest);
      }
      fail('atomicRejected', before, after);
    }

  return { useSnapshot, same, persistBatch };
}
