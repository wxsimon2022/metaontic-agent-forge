import { connectionDefaults } from '../connection-defaults.js';
/** 浏览器端 state：由入口注入宿主 React 与共享依赖。 */
export function createSettingsState({ React }: any) {
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
        globalThis.console?.warn?.('[MetaOnticVideo] settings-save', {
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

    function validateSettings(values) {
      const interval = Number(values.pollIntervalMs ?? 5000);
      const wait = Number(values.maxWaitMs ?? 600000);
      if (![interval, wait].every((n) => Number.isSafeInteger(n) && n >= 1000) || wait < interval) {
        throw new Error('invalidWait');
      }
      const trim = String(values.seamTrimSeconds ?? '').trim();
      if (trim && !trim.split(',').every((part) => part.trim() !== '' && Number.isFinite(Number(part)) && Number(part) >= 0 && Number(part) <= 3)) {
        throw new Error('invalidSeam');
      }
    }

    // 先写当前 Key、清空其他渠道凭据，最后提交模式。空值覆盖继承配置，避免 unset 后旧 Key 回流。
    async function persistConnection(form, pending, nextMode) {
      if (!['service', 'metaontic', 'volcengine'].includes(nextMode)) throw new Error('unknownConnection');
      const inactiveKeys = nextMode === 'volcengine'
        ? ['metaonticApiKey', 'apiKey', 'keyOrigin', 'baseUrl', 'submitPath', 'queryPath',
          'registerEmail', 'deviceId', 'deviceSecret', 'registerApi', 'registerToken']
        : nextMode === 'metaontic'
          ? ['volcengineApiKey', 'apiKey', 'keyOrigin', 'registerEmail', 'deviceId', 'deviceSecret', 'registerApi', 'registerToken']
          : ['volcengineApiKey', 'metaonticApiKey'];
      const ops = pending.filter(([key]) => key !== 'connectionMode' && !inactiveKeys.includes(key))
        .map(([key, next]) => ({ op: 'set', path: [key], value: next }));
      for (const key of inactiveKeys) ops.push({ op: 'set', path: [key], value: '' });
      const saved = form.getSnapshot?.()?.value || {};
      const values = { ...saved, ...Object.fromEntries(pending), connectionMode: nextMode };
      if (saved.connectionMode === 'volcengine' && nextMode !== 'volcengine') {
        for (const key of ['baseUrl', 'submitPath', 'queryPath']) {
          if (!pending.some(([field]) => field === key)) values[key] = '';
        }
      }
      for (const key of inactiveKeys) values[key] = '';
      for (const [key, next] of Object.entries(connectionDefaults(values))) {
        const existing = ops.findIndex((op) => op.path[0] === key);
        if (existing >= 0) ops.splice(existing, 1);
        ops.push({ op: 'set', path: [key], value: next });
      }
      ops.push({ op: 'set', path: ['connectionMode'], value: nextMode });
      // 成功响应代表宿主已接受整批写入；插件可能已重载，旧控制器的快照不再更新。
      await persistBatch(form, ops);
    }
  return { useSnapshot, same, validateSettings, persistConnection, persistBatch };
}
