const AGENTS = new Set(['metaontic-agent-forge-studio', 'metaontic-agent-forge-video-director', 'metaontic-agent-forge-promo-video']);
/** 只从宿主事实构建图；停止运行不代表成果已完成。 */
export function taskGraph(snapshot: any = {}, statuses: any = new Map()) {
  const summaries = snapshot.byId || {};
  const projections = snapshot.projectionsBySession || {};
  const values = (id: string) => ({ ...summaries[id]?.projectionValues, ...projections[id]?.values });
  const nodes = new Map<string, any>(), edges: any[] = [];
  const insert = (id: string, entry?: any, parent?: string) => {
    const summary = summaries[id];
    const value = values(id), live = statuses?.get?.(id);
    const pending = live?.pendingInteraction;
    const state = pending ? 'waiting' : (live?.running ?? summary?.running) === true ? 'running'
      : value.subagentTiming?.lastTurnCompleted === true ? 'turn-ended' : 'idle';
    nodes.set(id, { id, title: summary?.title || entry?.label || id, preset: value.agentPreset,
      state, pending: pending?.kind || pending?.type, parent,
      address: parent ? { parentSessionId: parent, childSessionId: id, mode: entry?.mode || 'unknown' } : id,
      external: entry?.mode === 'external', projectionState: projections[id]?.state,
    });
  };
  for (const [id] of Object.entries(summaries)) if (AGENTS.has(values(id).agentPreset)) insert(id);
  // 已识别的平台会话的委派记录，包含尚未加载摘要的历史子任务。
  const visited = new Set<string>();
  const visit = (id: string) => {
    if (visited.has(id)) return;
    visited.add(id);
    for (const entry of values(id).subagentCatalog || []) {
      if (!entry?.id || entry.id === id || visited.has(entry.id)) continue;
      insert(entry.id, entry, id);
      edges.push({ from: id, to: entry.id });
      visit(entry.id);
    }
  };
  for (const id of [...nodes.keys()]) visit(id);
  const children = new Set(edges.map(edge => edge.to));
  return { nodes: [...nodes.values()], edges, roots: [...nodes.keys()].filter(id => !children.has(id)) };
}
export function createTaskCanvas({ React, h, t }: any) {
  return function TaskCanvas({ useSessions, useSessionStatus, openTask, refreshTask }: any) {
    const snapshot = useSessions((state: any) => state);
    const statuses = useSessionStatus((state: any) => state);
    const graph = React.useMemo(() => taskGraph(snapshot, statuses), [snapshot, statuses]);
    const [chosenRoot, chooseRoot] = React.useState('');
    const [chosenNode, chooseNode] = React.useState('');
    const [zoom, setZoom] = React.useState(1);
    const root = graph.roots.includes(chosenRoot) ? chosenRoot : graph.roots[0];
    const shown = new Set<string>();
    const walk = (id: string) => { if (shown.has(id)) return; shown.add(id); for (const edge of graph.edges) if (edge.from === id) walk(edge.to); };
    if (root) walk(root);
    const nodes = graph.nodes.filter((node: any) => shown.has(node.id));
    const selected = nodes.find((node: any) => node.id === chosenNode) || nodes[0];
    React.useEffect(() => { if (root) refreshTask?.(root); }, [root, refreshTask]);
    if (!graph.roots.length) return h('section', { className: 'metaontic-agent-forge-section', 'aria-label': t('canvasTitle') }, [
      h('h2', { key: 'title' }, t('canvasTitle')),
      h('p', { key: 'empty', role: 'status' }, snapshot.state === 'error' ? t('canvasLoadError') : t('canvasEmpty')),
    ]);
    const positions = new Map<string, any>();
    const depth = (node: any, seen = new Set()) : number => {
      if (!node.parent || seen.has(node.id)) return 0;
      seen.add(node.id); const parent = nodes.find((item: any) => item.id === node.parent);
      return parent ? depth(parent, seen) + 1 : 0;
    };
    const rows = new Map<number, number>();
    for (const node of nodes) { const level = depth(node), row = rows.get(level) || 0; rows.set(level, row + 1); positions.set(node.id, { x: 24 + level * 260, y: 24 + row * 118 }); }
    const width = Math.max(520, ...[...positions.values()].map((p: any) => p.x + 246));
    const height = Math.max(200, ...[...positions.values()].map((p: any) => p.y + 110));
    const stateLabel = (node: any) => t(`canvasState_${node.state}`);
    const controls = h('div', { key: 'controls', style: { display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' } }, [
      h('select', { key: 'tasks', 'aria-label': t('canvasChoose'), value: root, onChange: (event: any) => { chooseRoot(event.target.value); chooseNode(''); }, style: { maxWidth: '100%' } }, graph.roots.map((id: string) => h('option', { key: id, value: id }, graph.nodes.find((node: any) => node.id === id)?.title))),
      h('button', { key: 'refresh', type: 'button', onClick: () => { for (const node of nodes) refreshTask?.(node.id); } }, t('canvasRefresh')),
      h('button', { key: 'out', type: 'button', 'aria-label': t('canvasZoomOut'), disabled: zoom <= .5, onClick: () => setZoom((value: number) => Math.max(.5, value - .25)) }, '−'),
      h('button', { key: 'reset', type: 'button', onClick: () => setZoom(1) }, `${Math.round(zoom * 100)}%`),
      h('button', { key: 'in', type: 'button', 'aria-label': t('canvasZoomIn'), disabled: zoom >= 1.5, onClick: () => setZoom((value: number) => Math.min(1.5, value + .25)) }, '+'),
    ]);
    return h('section', { className: 'metaontic-agent-forge-section', 'aria-label': t('canvasTitle') }, [
      h('h2', { key: 'title', style: { margin: '0 0 8px', fontSize: 15 } }, t('canvasTitle')),
      h('p', { key: 'hint', style: { fontSize: 12, opacity: .75 } }, t('canvasHint')),
      controls,
      h('div', { key: 'viewport', tabIndex: 0, 'aria-label': t('canvasTitle'), style: { overflow: 'auto', maxHeight: 480, marginTop: 12, border: '1px solid currentColor', borderRadius: 12 } },
        h('div', { style: { width: width * zoom, height: height * zoom } },
          h('div', { style: { position: 'relative', width, height, transform: `scale(${zoom})`, transformOrigin: 'top left' } }, [
            h('svg', { key: 'edges', width, height, 'aria-hidden': true, style: { position: 'absolute', inset: 0, pointerEvents: 'none' } }, graph.edges.filter((edge: any) => shown.has(edge.from) && shown.has(edge.to)).map((edge: any) => {
              const a = positions.get(edge.from), b = positions.get(edge.to);
              return h('path', { key: `${edge.from}:${edge.to}`, d: `M${a.x + 220},${a.y + 40} C${a.x + 240},${a.y + 40} ${b.x - 20},${b.y + 40} ${b.x},${b.y + 40}`, fill: 'none', stroke: 'currentColor', strokeWidth: 2, opacity: .35 });
            })),
            ...nodes.map((node: any) => { const p = positions.get(node.id); return h('button', {
              key: node.id, type: 'button', 'aria-pressed': node.id === selected?.id, onClick: () => chooseNode(node.id),
              style: { position: 'absolute', left: p.x, top: p.y, width: 220, minHeight: 82, padding: 12, textAlign: 'left', borderRadius: 10, border: `2px solid ${node.id === selected?.id ? '#5584eb' : '#8492a640'}`, background: 'var(--dsw-alias-background-primary,Canvas)', color: 'inherit', cursor: 'pointer' },
            }, [h('strong', { key: 'title', style: { display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, node.title), h('span', { key: 'state', role: 'status', style: { display: 'block', marginTop: 8, fontSize: 12 } }, stateLabel(node))]); }),
          ]))),
      selected && h('div', { key: 'detail', style: { marginTop: 12, overflowWrap: 'anywhere' } }, [
        h('strong', { key: 'name' }, selected.title),
        h('p', { key: 'state', role: 'status' }, stateLabel(selected)),
        h('p', { key: 'id', style: { fontSize: 12, opacity: .65 } }, selected.id),
        selected.projectionState === 'error' && h('p', { key: 'error', role: 'status' }, t('canvasLoadError')),
        h('button', { key: 'open', type: 'button', disabled: selected.external || typeof openTask !== 'function', onClick: () => openTask?.(selected.address) }, t(selected.state === 'waiting' ? 'canvasReview' : 'canvasOpen')),
      ]),
    ]);
  };
}
