/** 使用宿主已鉴权api/file路由，不能直接给WebView传本机file://地址。 */
export function localMediaUrl(file, base) {
  if (typeof file !== 'string' || /[\u0000-\u001f\u007f]/.test(file) || !/^(?:\/(?!\/)|[a-z]:[/\\])/i.test(file)) return '';
  if (typeof base !== 'string' || (!/^https?:/i.test(base) && !base.startsWith('dsh-app://app/'))) return '';
  try { return new URL(`api/file?path=${encodeURIComponent(file)}`, base).href; } catch { return ''; }
}
export function remoteMediaUrl(value) {
  try { const url = new URL(String(value || '')); return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.href : ''; } catch { return ''; }
}
export function previewMediaFromBlock(block, toolName) {
  if (!block || !('kind' in block) || block.isError) return [];
  const projected = block.meta?.metaonticMedia;
  if (projected?.version === 1 && Array.isArray(projected.media)) return projected.media.filter(item => item && ['video', 'image'].includes(item.kind)).slice(0, 40);
  // 旧会话没有结构化展示元信息时，只解析已有结果里的真实Markdown媒体链接。
  const text = (Array.isArray(block.content) ? block.content : []).filter(p => p.type === 'text').map(p => p.text || '').join('\n');
  const media = [], seen = new Set();
  for (const match of text.matchAll(/\[([^\]]*)\]\(\s*(?:<([^>]+)>|([^\s)]+))\s*\)/g)) {
    const source = match[2] || match[3];
    if (seen.has(source)) continue;
    let kind = /\.(png|jpe?g|webp|gif|svg)(?:[?#]|$)/i.test(source) || /图片|参考图/.test(match[1]) || toolName === 'video_prepare_image' ? 'image'
      : /\.(mp4|webm|mov|m4v)(?:[?#]|$)/i.test(source) || /视频|第.*段/.test(match[1]) ? 'video' : '';
    if (!kind) continue;
    seen.add(source);
    let url = remoteMediaUrl(source);
    let file = '';
    if (!url) { try { file = decodeURI(source); } catch { continue; } }
    media.push({ kind, label: match[1] || (kind === 'image' ? '图片' : '视频'), ...(url ? { url } : { localPath: file }) });
    if (media.length >= 40) break;
  }
  return media;
}
export function createMediaPreview({ React, h }: any) {
  function MediaItem({ item }) {
    const sources = [...new Set([localMediaUrl(item.localPath, document.baseURI), remoteMediaUrl(item.url)].filter(Boolean))];
    const signature = sources.join('\n');
    const [index, setIndex] = React.useState(0);
    const [failed, setFailed] = React.useState(false);
    const [zoom, setZoom] = React.useState(false);
    const dialog = React.useRef(null);
    React.useEffect(() => { setIndex(0); setFailed(false); setZoom(false); }, [signature]);
    React.useEffect(() => { if (zoom && dialog.current && !dialog.current.open) dialog.current.showModal(); }, [zoom]);
    const source = sources[index] || '';
    const error = () => { if (index + 1 < sources.length) setIndex(index + 1); else setFailed(true); };
    const label = String(item.label || (item.kind === 'image' ? '图片' : '视频'));
    const media = !source || failed ? h('p', { role: 'status', className: 'mov-media-error' }, item.kind === 'image'
      ? '图片预览无法加载，文件可能已移动或链接已过期。请尝试打开原图。'
      : '视频预览无法播放，可能是文件已移动、链接已过期或编码不受支持。请尝试打开原视频或下载后播放。')
      : item.kind === 'image' ? h('button', { type: 'button', className: 'mov-media-image-button', onClick: () => setZoom(true), 'aria-label': `放大${label}` }, h('img', { src: source, alt: label, loading: 'lazy', onError: error, className: 'mov-media-image', referrerPolicy: 'no-referrer' }))
      : h('video', { key: source, src: source, controls: true, playsInline: true, preload: 'metadata', onError: error, className: 'mov-media-video', 'aria-label': label, referrerPolicy: 'no-referrer' });
    return h('figure', { className: 'mov-media-item', 'data-media-kind': item.kind }, [
      h('figcaption', { key: 'caption', className: 'mov-media-caption' }, label),
      h('div', { key: 'body', className: 'mov-media-surface' }, media),
      sources.length ? h('div', { key: 'links', className: 'mov-media-links' }, [
        h('a', { key: 'open', href: source || sources[0], target: '_blank', rel: 'noopener noreferrer', referrerPolicy: 'no-referrer' }, item.kind === 'image' ? '打开原图' : '打开原视频'),
        item.localPath && remoteMediaUrl(item.url) ? h('a', { key: 'remote', href: remoteMediaUrl(item.url), target: '_blank', rel: 'noopener noreferrer', referrerPolicy: 'no-referrer' }, '上游链接') : null,
      ]) : null,
      zoom && item.kind === 'image' ? h('dialog', { key: 'zoom', ref: dialog, className: 'mov-media-dialog', 'aria-label': label, onCancel: () => setZoom(false), onClose: () => setZoom(false), onClick: e => { if (e.target === e.currentTarget) setZoom(false); } }, [
        h('button', { key: 'close', type: 'button', className: 'mov-media-close', onClick: () => { dialog.current?.close(); setZoom(false); }, 'aria-label': '关闭图片预览' }, '关闭'),
        h('img', { key: 'image', src: source, alt: label, className: 'mov-media-zoom', referrerPolicy: 'no-referrer', onError: error }),
      ]) : null,
    ]);
  }
  function MediaPreview({ block, toolName }) {
    const items = previewMediaFromBlock(block, toolName);
    const [expanded, setExpanded] = React.useState(false);
    if (!items.length) return null;
    const visible = expanded ? items : items.slice(0, 2);
    return h('section', { className: 'mov-media-preview', 'aria-label': '生成结果预览', 'data-field': 'media-preview' }, [
      h('style', { key: 'styles' }, `
        .mov-media-preview{margin-top:12px;min-width:0;color:var(--dsw-alias-label-primary,inherit)}
        .mov-media-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,300px),1fr));gap:12px;min-width:0}
        .mov-media-item{margin:0;min-width:0;border:1px solid var(--dsw-alias-border-l2,#dfe3eb);border-radius:10px;overflow:hidden}
        .mov-media-caption{padding:8px 12px;font-size:13px;font-weight:600;overflow-wrap:anywhere}
        .mov-media-surface{min-width:0;background:var(--dsw-specific-input-major,#f5f6f8)}
        .mov-media-image-button{display:block;width:100%;padding:0;border:0;background:transparent;cursor:zoom-in}
        .mov-media-image{display:block;width:100%;max-height:320px;object-fit:contain}
        .mov-media-video{display:block;width:100%;max-height:420px;background:#10131a;object-fit:contain}
        .mov-media-links{display:flex;gap:16px;flex-wrap:wrap;padding:8px 12px;font-size:12px}
        .mov-media-links a{color:var(--dsw-alias-link,#247bbf);text-decoration:underline;overflow-wrap:anywhere}
        .mov-media-error{margin:0;padding:18px 12px;font-size:12px;line-height:1.6;color:var(--dsw-alias-label-caption,#737b8b)}
        .mov-media-more{margin-top:10px;border:1px solid var(--dsw-alias-border-l2,#dfe3eb);border-radius:6px;padding:6px 10px;background:transparent;color:inherit;cursor:pointer}
        .mov-media-dialog{box-sizing:border-box;max-width:94vw;max-height:94vh;padding:42px 12px 12px;border:0;border-radius:12px;background:var(--dsw-alias-settings-card-fill,#fff);color:inherit}
        .mov-media-dialog::backdrop{background:rgba(0,0,0,.7)}
        .mov-media-zoom{display:block;max-width:calc(94vw - 24px);max-height:calc(94vh - 70px);object-fit:contain}
        .mov-media-close{position:absolute;top:8px;right:10px;background:transparent;color:inherit;border:1px solid var(--dsw-alias-border-l2,#dfe3eb);border-radius:6px;padding:4px 10px;cursor:pointer}
        .mov-media-image-button:focus-visible,.mov-media-more:focus-visible,.mov-media-close:focus-visible{outline:2px solid #247bbf;outline-offset:-2px}
      `),
      h('div', { key: 'grid', className: 'mov-media-grid' }, visible.map(item => h(MediaItem, { key: `${item.kind}:${item.localPath || item.url}`, item }))),
      items.length > 2 ? h('button', { key: 'more', type: 'button', className: 'mov-media-more', onClick: () => setExpanded(!expanded), 'aria-expanded': expanded }, expanded ? '收起其他成果' : `展开其他成果（${items.length - 2}）`) : null,
    ]);
  }
  return { MediaPreview };
}
