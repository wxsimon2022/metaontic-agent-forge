import { sourceOf } from './source.mjs';
import vm from 'node:vm';
import path from 'node:path';
import os from 'node:os';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { test } from 'node:test';

// 收款开关的本地记录：成功问到结论时落一份，连不上服务端时按它兜底。
const source = sourceOf('payment/webpay-state');

function harness(home) {
  const context = vm.createContext({ path, mkdir, readFile, writeFile, dshHome: () => home, Date });
  vm.runInContext(source, context);
  return context;
}

test('记下「这里收钱」之后，连不上时能兜底拦住生成', async () => {
  const home = await mkdirHome();
  const c = harness(home);
  assert.equal(await c.lastWebpayEnabled('https://video.mybfs.cn'), false);
  await c.rememberWebpayStatus('https://video.mybfs.cn/', { enabled: true });
  assert.equal(await c.lastWebpayEnabled('https://video.mybfs.cn'), true);
  // 服务端换成不收钱：记录跟着更新
  await c.rememberWebpayStatus('https://video.mybfs.cn', { enabled: false });
  assert.equal(await c.lastWebpayEnabled('https://video.mybfs.cn'), false);
});

test('结论只对自己那个服务端有效，太旧的记录不再用来拦生成', async () => {
  const home = await mkdirHome();
  const c = harness(home);
  await c.rememberWebpayStatus('https://video.mybfs.cn', { enabled: true });
  assert.equal(await c.lastWebpayEnabled('https://other.example.com'), false);
  const farFuture = Date.now() + 40 * 24 * 60 * 60 * 1000;
  assert.equal(await c.lastWebpayEnabled('https://video.mybfs.cn', farFuture), false);
});

test('记录文件损坏时按「不知道」处理，不影响生成', async () => {
  const home = await mkdirHome();
  const c = harness(home);
  await mkdir(path.join(home, 'metaontic-video'), { recursive: true });
  await writeFile(path.join(home, 'metaontic-video', 'webpay-state.json'), '{坏掉的');
  assert.equal(await c.lastWebpayEnabled('https://video.mybfs.cn'), false);
  await c.rememberWebpayStatus('https://video.mybfs.cn', { enabled: true });
  assert.equal(await c.lastWebpayEnabled('https://video.mybfs.cn'), true);
});

async function mkdirHome() {
  const home = path.join(os.tmpdir(), `webpay-state-${process.pid}-${Math.random().toString(36).slice(2)}`);
  await mkdir(home, { recursive: true });
  return home;
}
