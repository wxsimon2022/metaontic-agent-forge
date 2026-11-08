import { createFormState } from '../../../core/settings/state.js';
import { connectionDefaults } from '../connection-defaults.js';
/** 浏览器端 state：由入口注入宿主 React 与共享依赖。 */
export function createSettingsState({ React }: any) {
  const { useSnapshot, same, persistBatch } = createFormState({ React });

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

    // 先写当前 API密钥、清空其他渠道凭据，最后提交模式。空值覆盖继承配置，避免 unset 后旧 API密钥回流。
    async function persistConnection(form, pending, nextMode) {
      if (!['metaontic', 'volcengine'].includes(nextMode)) throw new Error('unknownConnection');
      const inactiveKeys = nextMode === 'volcengine'
        ? ['metaonticApiKey', 'baseUrl', 'submitPath', 'queryPath']
        : ['volcengineApiKey'];
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
