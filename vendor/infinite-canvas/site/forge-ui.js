// Integration shim for the pinned upstream project store. Runs before its React mount.
export async function connectForgeCanvas() {
  const response = await fetch('/bootstrap');
  const boot = await response.json();
  localStorage.setItem('canvas-agent-url', location.origin);
  localStorage.setItem('canvas-agent-token', boot.token);
  const originalFetch = window.fetch.bind(window);
  window.fetch = (input, options = {}) => {
    const url = new URL(typeof input === 'string' ? input : input.url, location.href);
    if (url.origin !== location.origin && url.protocol !== 'blob:' && url.protocol !== 'data:') return Promise.reject(new Error('请在专业助手对话中制作，画布不连接额外模型。'));
    if (url.origin === location.origin) {
      const headers = new Headers(input instanceof Request ? input.headers : undefined);
      new Headers(options.headers).forEach((value, key) => headers.set(key, value));
      headers.set('x-canvas-agent-token', boot.token);
      return originalFetch(input, { ...options, headers });
    }
    return originalFetch(input, options);
  };
}
export async function prepareForgeCanvas(store) {
  // Wait for disk-backed project-store hydration before inserting the requested canvas.
  await store.persist.rehydrate();
  const id = /^\/canvas\/([a-zA-Z0-9_-]+)$/.exec(location.pathname)?.[1];
  if (id && !store.getState().projects.some(project => project.id === id)) {
    const created = store.getState().createProject(new URLSearchParams(location.search).get('title') || '云智工坊项目');
    store.setState(state => ({ projects: state.projects.map(project => project.id === created ? { ...project, id } : project) }));
  }
  const note = document.createElement('div');
  note.textContent = '云智工坊画布 · 编辑节点和素材；制作、费用与结果审核请回到专业助手对话。';
  note.style.cssText = 'position:fixed;bottom:8px;left:8px;max-width:80%;z-index:9999;background:#172033;color:#fff;padding:6px 10px;border-radius:6px;font:12px sans-serif;pointer-events:none';
  document.body.append(note);
}
