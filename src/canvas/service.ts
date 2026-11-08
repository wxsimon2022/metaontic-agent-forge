import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

export function createCanvasService(options: any = {}) {
  const root = options.root || path.join(process.env.DSH_HOME || path.join(os.homedir(), '.dsh'), 'metaontic-agent-forge', 'canvas');
  const port = options.port || Number(process.env.METAONTIC_AGENT_FORGE_CANVAS_PORT || 17379);
  if (!Number.isSafeInteger(port) || port < 1024 || port > 65535) throw new Error('画布端口无效。');
  const origin = `http://127.0.0.1:${port}`;
  const vendor = options.vendor || fileURLToPath(new URL('./vendor/infinite-canvas/', import.meta.url));
  let child: any, ready = false, starting: Promise<void>, disposed = false, token = '', error = '';
  let requested: any = null;
  let requestSequence = 0;
  const shutdown = new AbortController();
  async function request(route: string, body?: any, signal?: AbortSignal) {
    const response = await fetch(origin + route, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { 'content-type': 'application/json', 'x-canvas-agent-token': token },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.any([shutdown.signal, AbortSignal.timeout(35000), ...(signal ? [signal] : [])]),
    });
    const value: any = await response.json();
    if (!response.ok || value.ok === false) throw new Error(value.error || '画布请求失败。');
    return value;
  }
  async function ensure() {
    if (disposed) throw new Error('画布已停用。');
    if (ready && child && child.exitCode === null) return;
    if (starting) return starting;
    starting = (async () => {
      error = '';
      // Never reuse an independently installed canvas or terminate an unknown port owner.
      try {
        await fetch(origin + '/health', { signal: AbortSignal.timeout(600) });
        throw new Error('画布端口已被其他服务占用，请关闭冲突服务或配置其他画布端口。');
      } catch (failure) { if (!String(failure?.cause?.code || failure?.name).match(/ECONNREFUSED|TimeoutError|TypeError/)) throw failure; }
      await mkdir(root, { recursive: true, mode: 0o700 });
      if (disposed) throw new Error('画布已停用。');
      const env: any = { ...process.env };
      for (const key of Object.keys(env)) if (/KEY|PASSWORD|SECRET|TOKEN/i.test(key) || key.startsWith('DSH_')) delete env[key];
      Object.assign(env, { CANVAS_AGENT_HOME: root, CANVAS_SITE_DIR: path.join(vendor, 'site'), PORT: String(port) });
      if (process.versions.electron) env.ELECTRON_RUN_AS_NODE = '1';
      child = (options.spawn || spawn)(process.execPath, [path.join(vendor, 'bridge', 'index.js')], {
        env, stdio: 'ignore', windowsHide: true, shell: false,
      });
      let failed = false;
      child.once('error', () => { failed = true; ready = false; error = '画布进程启动失败。'; });
      child.once('exit', () => { failed = true; ready = false; if (!disposed) error = '画布进程已退出，可重新打开画布恢复。'; });
      const deadline = Date.now() + 15000;
      while (Date.now() < deadline && !disposed && !failed) {
        try {
          const health = await request('/health');
          if (health.plugin === 'metaontic-infinite-canvas') {
            const bootstrap = await request('/bootstrap');
            token = bootstrap.token;
            ready = true;
            return;
          }
        } catch { /* The owned child needs a moment to bind its socket. */ }
        await new Promise(resolve => setTimeout(resolve, 150));
      }
      child?.kill();
      throw new Error('画布启动未完成，请重新打开画布；项目数据已保留。');
    })().catch(failure => { error = failure.message; throw failure; }).finally(() => { starting = undefined; });
    return starting;
  }
  return {
    ensure,
    snapshot: () => ({ ready, origin: ready ? origin : '', requested, error }),
    async open(id: string, title: string) { await ensure(); requested = { id, title, sequence: ++requestSequence }; return { canvasId: id, opening: true, nextAction: '右侧画布连接后再读取state或编辑。' }; },
    async call(name: string, input: any, signal?: AbortSignal) { await ensure(); return (await request('/api/tools', { name, input }, signal)).result; },
    async media(localPath: string, signal?: AbortSignal) { await ensure(); return request('/forge/media', { localPath }, signal); },
    dispose() { disposed = true; ready = false; shutdown.abort(); child?.kill(); },
  };
}
