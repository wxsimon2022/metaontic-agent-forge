import { sourceOf } from './source.mjs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { test } from 'node:test';

const source = sourceOf('client/settings');

function rechargeEntryVisible() {
  const context = vm.createContext({});
  vm.runInContext(source, context);
  return context.rechargeEntryVisible;
}

test('the top-up button follows the server-side runtime switch', () => {
  const visible = rechargeEntryVisible();
  // 服务端开着充值（或老版本服务端不回这个字段）：照常显示入口
  assert.equal(visible(true, { enabled: true, recharge_enabled: true }), true);
  assert.equal(visible(true, { enabled: true }), true);
  // 控制台关掉在线充值：只剩余额与刷新，不再显示「充值」
  assert.equal(visible(true, { enabled: true, recharge_enabled: false }), false);
  // 钱包整体没开（404）或没读到状态：整块都不显示，更不会有充值入口
  assert.equal(visible(false, null), false);
  assert.equal(visible(true, null), false);
});
