export const FORGE_CANVAS_KIND = 'metaontic-infinite-canvas';
export function registerInfiniteCanvas(ctx: any, React: any) {
  if (typeof ctx.inject !== 'function') return;
  const h = React.createElement;
  const statusUrl = '/api/metaontic-agent-forge.canvas';
  const start = () => fetch('/api/metaontic-agent-forge.canvas-start', { method: 'POST' }).then(response => response.json());
  const get = () => fetch(statusUrl).then(response => {
    if (!response.ok) throw new Error('画布连接暂时不可用。');
    return response.json();
  });
  function CanvasFrame() {
    const [info, setInfo] = React.useState(null), [error, setError] = React.useState('');
    React.useEffect(() => {
      let active = true;
      const update = () => get().then(value => { if (active) setInfo(value); }).catch(() => { if (active) setError('画布连接暂时不可用，请重试。'); });
      start().then(update).catch(() => { if (active) setError('画布启动失败，请重试。'); });
      const timer = setInterval(update, 1500);
      return () => { active = false; clearInterval(timer); };
    }, []);
    const requested = info?.requested;
    const src = info?.ready ? info.origin + (requested ? '/canvas/' + requested.id + '?title=' + encodeURIComponent(requested.title) : '/') : '';
    return h('div', { style: { display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 } }, [
      h('div', { key: 'bar', style: { display: 'flex', gap: 8, alignItems: 'center', padding: 8, fontSize: 12 } }, [
        h('strong', { key: 'title' }, '创作画布'),
        h('span', { key: 'state' }, info?.ready ? '已连接 · Haitang-Hub' : '正在连接'),
        h('button', { key: 'retry', type: 'button', onClick: () => { setError(''); start().then(setInfo).catch(() => setError('画布启动失败，请重试。')); } }, '重新连接'),
      ]),
      src ? h('iframe', { key: src, src, title: '云智工坊无限画布', sandbox: 'allow-scripts allow-same-origin allow-downloads', style: { flex: 1, width: '100%', border: 0, minHeight: 0 }, 'data-dsh-no-drag': '' })
        : h('p', { key: 'empty', role: 'status', style: { padding: 16 } }, info?.error || error || '正在启动本地画布服务，项目数据会保留。'),
    ]);
  }
  ctx.effect(() => ctx.inject(['sidebarRightTabs', 'sidebarRight'], (right: any) => {
    const disposers = [right.sidebarRightTabs.register({ id: FORGE_CANVAS_KIND, kind: FORGE_CANVAS_KIND, title: () => '创作画布', guide: [{ order: 31, title: () => '云智工坊画布', description: () => '编排创意、分镜和已有素材，与任务对话并排使用。' }] }),
      right.slots.inject('sidebar.right.pane.tab', () => right.slots.register({ name: 'sidebar.right.pane.tab', key: FORGE_CANVAS_KIND }, CanvasFrame))];
    let disposed = false, last = '';
    const timer = setInterval(() => {
      get().then(value => {
        if (disposed || !value.ready || !value.requested || last === value.requested.id + ':' + value.requested.sequence) return;
        right.sidebarRight.openTab(FORGE_CANVAS_KIND);
        last = value.requested.id + ':' + value.requested.sequence;
      }).catch(() => {});
    }, 1500);
    return () => { disposed = true; clearInterval(timer); disposers.forEach(dispose => { if (typeof dispose === 'function') dispose(); }); };
  }), 'forge: infinite canvas');
}
