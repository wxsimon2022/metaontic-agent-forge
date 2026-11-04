import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import pkg from '../package.json';
import { createPreviewHost } from './host.mjs';

const h = React.createElement;
const listeners = new Set(), components = {}, dictionaries = {};
let locale = 'zh', scenario = 'service', reject = false, value = {}, user = {}, revision = 0;
const secretFields = ['apiKey', 'metaonticApiKey', 'volcengineApiKey', 'deviceSecret', 'registerToken'];
const emit = () => { revision++; for (const listener of listeners) listener(); };
function preset(mode) {
  scenario = mode;
  value = { connectionMode: ['empty', 'error'].includes(mode) ? 'service' : mode, model: 'doubao-seedance-2-0-mini-260615', ratio: '9:16', mode: 'continuous', generateAudio: true, watermark: false, duration: 15 };
  if (mode === 'service' || mode === 'error') Object.assign(value, { apiKey: 'preview-service-key', keyOrigin: 'register', registerEmail: 'preview@example.com', deviceId: 'preview-device', deviceSecret: 'preview-device-secret' });
  if (mode === 'metaontic') value.metaonticApiKey = 'preview-metaontic-key';
  if (mode === 'volcengine') value.volcengineApiKey = 'preview-volcano-key';
  localStorage.removeItem('metaontic-video.update-check-v2');
  if (mode === 'empty') localStorage.setItem('metaontic-video.logged-out', '1');
  else localStorage.removeItem('metaontic-video.logged-out');
  user = { ...value }; emit();
}
let cachedSnapshot;
const form = {
  getSnapshot() {
    if (!cachedSnapshot || cachedSnapshot.revision !== revision) cachedSnapshot = { status: 'ready', value: { ...value }, user: { ...user }, writable: true, revision };
    return cachedSnapshot;
  },
  subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
  async mutate(ops) {
    if (reject) return false;
    const staged = { ...user };
    for (const op of ops) { if (op.op === 'unset') delete staged[op.path[0]]; else staged[op.path[0]] = op.value; }
    user = staged; value = { ...staged }; emit(); return true;
  },
  set(key, next) { return this.mutate([{ op: 'set', path: [key], value: next }]); },
  unset(key) { return this.mutate([{ op: 'unset', path: [key] }]); },
};
// 预览完全拦截 fetch；不连接服务端、不使用真实 Key、不写宿主配置。
window.fetch = async (input) => {
  const url = String(input);
  let data;
  if (url.includes('/api/v1/')) {
    if (scenario === 'error' && /quota|usage/.test(url)) return new Response(JSON.stringify({ message: '预览：模拟服务暂时不可用' }), { status: 503 });
    if (url.includes('/register/status')) data = { enabled: true, base_url: 'https://preview.invalid' };
    else if (url.includes('/register/quota')) data = { currency_symbol: '¥', remain_amount: 86.5, used_amount: 13.5, total_amount: 100 };
    else if (url.includes('/wallet/status')) data = { enabled: true, balance: 26.4, currency_symbol: '¥', price: 0.01, recharge_min: 1, recharge_max: 1000 };
    else if (url.includes('/usage/list')) data = { window_days: 7, currency_symbol: '¥', count: 3, amount_sum: 13.5, items: ['succeeded', 'succeeded', 'failed'].map((status, i) => ({ id: i, created_at: new Date(Date.now()-i*3600000).toISOString(), kind_label: i ? '视频延长' : '视频生成', model: value.model, amount: i === 2 ? 0 : 6.75, status })) };
    else data = { api_key: 'preview-service-key', email: 'preview@example.com', base_url: 'https://preview.invalid', model: value.model };
    return new Response(JSON.stringify({ code: 0, data }), { status: 200 });
  }
  if (url.includes('/releases')) return new Response(JSON.stringify([{tag_name:'v3.10.0'},{tag_name:'v3.9.0'},{tag_name:'v3.8.2'},{tag_name:'v3.11.0-beta.1',prerelease:true}]));
  if (url.includes('package.json')) return new Response(JSON.stringify(pkg));
  if (/commits|refs|tags|jsdelivr/.test(url)) return new Response(JSON.stringify([]));
  throw new Error(`预览已拦截请求：${url}`);
};
let plugin;
window.__ModuleLoader__ = { load(entry) { plugin = entry.factory(name => { if (name === 'react') return React; throw new Error(name); }); } };
await import('../src/client.ts');
plugin.apply(createPreviewHost({
  form, components, dictionaries, getLocale: () => locale,
  onUpdate: () => alert('预览：已模拟更新，不会安装插件。'),
}));
preset('service');
function App() {
  const [epoch, bump] = useState(0), [tab, setTab] = useState('settings'), [theme, setTheme] = useState('light'), [narrow, setNarrow] = useState(false), [failure, setFailure] = useState(false), [task, setTask] = useState('waiting');
  const [taskStartedAt, setTaskStartedAt] = useState(Date.now);
  const [, render] = useState(0);
  React.useEffect(() => form.subscribe(() => render(n => n + 1)), []);
  const Page = components['metaontic-video'], Progress = components[task === 'extend' ? 'video_extend' : 'video_generate'];
  const block = task === 'success' ? { kind: 'result', content: [{ type: 'text', text: '视频生成成功 · succeeded\n示例路径：/preview/video.mp4' }] } : task === 'failed' ? { kind: 'result', isError: true, content: [{ type: 'text', text: '预览：模拟生成失败，请检查错误详情。' }] } : { phase: 'start', args: { duration: 15 } };
  const masked = Object.fromEntries(Object.entries(value).map(([k, v]) => [k, secretFields.includes(k) && v ? '（模拟 Key 已隐藏）' : v]));
  return <>
    <header className="preview-bar"><strong>MetaOnticVideo · 样式预览</strong>
      <select aria-label="预览场景" value={scenario} onChange={e => { preset(e.target.value); bump(epoch + 1); }}>
        <option value="service">服务端 · 已登录</option><option value="empty">服务端 · 未登录</option><option value="metaontic">MetaOntic AI</option><option value="volcengine">火山直连</option><option value="error">服务请求失败</option>
      </select>
      <button onClick={() => { const next = theme === 'light' ? 'dark' : 'light'; document.documentElement.dataset.theme = next; setTheme(next); }}>{theme === 'light' ? '深色' : '浅色'}</button>
      <button onClick={() => setNarrow(!narrow)}>{narrow ? '宽屏' : '窄屏'}</button>
      <button onClick={() => { locale = locale === 'zh' ? 'en' : 'zh'; bump(epoch + 1); }}>{locale === 'zh' ? 'English' : '中文'}</button>
      <label><input type="checkbox" checked={failure} onChange={e => { reject = e.target.checked; setFailure(reject); }} />模拟保存失败</label>
    </header>
    <p className="preview-note">复用 src/client.ts 的真实界面 · 数据与 Key 均为模拟 · 保存仅在当前页面内生效 · 修改源码自动刷新</p>
    <main className={`preview-content ${narrow ? 'narrow' : ''}`}>
      <nav className="preview-tabs"><button aria-pressed={tab === 'settings'} onClick={() => setTab('settings')}>插件设置</button><button aria-pressed={tab === 'progress'} onClick={() => setTab('progress')}>生成进度卡片</button></nav>
      {tab === 'settings' ? <Page key={epoch} /> : <><select aria-label="任务状态" value={task} onChange={e => { setTask(e.target.value); setTaskStartedAt(Date.now()); }}><option value="waiting">生成等待</option><option value="extend">延长等待</option><option value="success">生成成功</option><option value="failed">失败</option></select><Progress key={`${epoch}-${task}`} toolName={task === 'extend' ? 'video_extend' : 'video_generate'} block={block} callId={task} startedAt={taskStartedAt} /></>}
      <details className="preview-inspect"><summary>模拟配置快照</summary><pre>{JSON.stringify(masked, null, 2)}</pre></details>
    </main>
  </>;
}
createRoot(document.getElementById('root')).render(<App />);
new EventSource('/esbuild').addEventListener('change', () => location.reload());
