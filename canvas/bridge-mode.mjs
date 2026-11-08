import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const SAFE_OPS = new Set(['add_node', 'update_node', 'delete_node', 'delete_connections', 'connect_nodes', 'set_viewport', 'select_nodes']);
const SAFE_TOOLS = new Set(['canvas_get_state', 'canvas_get_selection', 'canvas_export_snapshot', 'canvas_apply_ops', 'canvas_list_projects']);
export function assertCanvasRequest(name, input = {}) {
  if (!SAFE_TOOLS.has(name)) throw new Error('请回到专业助手对话，按脚本审核、费用确认和分段审核流程制作。');
  if (name === 'canvas_apply_ops') {
    if (!Array.isArray(input.ops) || input.ops.length > 100) throw new Error('每次最多提交100项画布编辑。');
    for (const op of input.ops) {
      if (!SAFE_OPS.has(op?.type)) throw new Error('画布只允许编辑节点与连线，生成须通过专业助手审核。');
      if (op.autoRun || op.patch?.autoRun || op.metadata?.autoRun) throw new Error('画布不允许自动生成。');
    }
  }
}

/** Called before upstream static/API routes. No model settings, proxy or agent runtime is exposed. */
export function installForgeMode(app, session, config) {
  const root = path.join(process.env.CANVAS_AGENT_HOME, 'forge-store');
  fs.mkdirSync(root, { recursive: true, mode: 0o700 });
  const fileFor = (kind, key) => path.join(root, kind + '-' + crypto.createHash('sha256').update(key).digest('hex'));
  function atomic(file, bytes) {
    const temp = file + '.' + crypto.randomUUID() + '.tmp';
    try { fs.writeFileSync(temp, bytes, { mode: 0o600 }); fs.renameSync(temp, file); }
    catch (error) { try { fs.unlinkSync(temp); } catch {} throw error; }
  }
  const originalCall = session.callTool.bind(session);
  session.callTool = (name, input) => { assertCanvasRequest(name, input); return originalCall(name, input); };
  app.use((req, res, next) => {
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' data: blob:; connect-src 'self' blob:; font-src 'self' data:; worker-src 'self' blob:; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'");
    const url = new URL(req.url, config.url);
    const origin = req.headers.origin;
    if (origin && origin !== config.url) return res.status(403).json({ ok: false, error: '画布仅接受同源请求。' });
    const authorized = req.headers['x-canvas-agent-token'] === config.token || url.searchParams.get('token') === config.token;
    const publicRead = ['GET', 'HEAD'].includes(req.method) && (
      ['/', '/bootstrap', '/config', '/health', '/config.js', '/forge-ui.js'].includes(url.pathname)
      || /^\/(assets|icons|models)\//.test(url.pathname)
      || /^\/canvas\/[a-zA-Z0-9_-]+$/.test(url.pathname)
      || ['/logo.png', '/benchmark-panorama.jpg'].includes(url.pathname));
    if (!publicRead && !authorized) return res.status(401).json({ ok: false, error: '画布连接尚未就绪。' });
    try {
      if (url.pathname === '/health') return res.json({ ok: true, plugin: 'metaontic-infinite-canvas', site: true });
      if (url.pathname === '/store/health') return res.json({ ok: true });
      const kv = /^\/store\/kv\/(.+)$/.exec(url.pathname);
      if (kv) {
        const file = fileFor('kv', decodeURIComponent(kv[1]));
        if (req.method === 'GET') return fs.existsSync(file) ? res.type('text/plain').send(fs.readFileSync(file)) : res.sendStatus(404);
        if (req.method === 'PUT') {
          const chunks = []; let size = 0;
          req.on('data', chunk => { size += chunk.length; if (size > 30 * 1024 * 1024) req.destroy(); else chunks.push(chunk); });
          req.on('end', () => { try { atomic(file, Buffer.concat(chunks)); res.json({ ok: true }); } catch { res.status(500).json({ ok: false, error: '保存失败，原文件已保留。' }); } });
          return;
        }
        if (req.method === 'DELETE') { if (fs.existsSync(file)) fs.unlinkSync(file); return res.json({ ok: true }); }
      }
      // Browser uploads remain in its IndexedDB; server media are registered verified local artifacts only.
      const media = /^\/media\/([a-f0-9]{64})$/.exec(url.pathname);
      if (media && ['GET', 'HEAD'].includes(req.method)) {
        const file = fileFor('media', media[1]), meta = file + '.json';
        if (!fs.existsSync(file) || !fs.existsSync(meta)) return res.sendStatus(404);
        res.setHeader('Content-Type', JSON.parse(fs.readFileSync(meta)).mime);
        return res.sendFile(file, { dotfiles: 'allow' });
      }
      if (url.pathname === '/forge/media' && req.method === 'POST') {
        const { localPath } = req.body || {};
        if (typeof localPath !== 'string' || !path.isAbsolute(localPath) || /^(?:\\\\|\/\/)/.test(localPath)) throw new Error('媒体需要本机绝对路径。');
        const mime = ({ '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.mp4': 'video/mp4', '.webm': 'video/webm', '.svg': 'image/svg+xml' })[path.extname(localPath).toLowerCase()];
        if (!mime || !fs.statSync(localPath).isFile()) throw new Error('仅支持已存在的图片或视频文件。');
        const key = crypto.createHash('sha256').update(localPath).update(String(fs.statSync(localPath).mtimeMs)).digest('hex');
        const file = fileFor('media', key);
        if (fs.existsSync(file) && fs.existsSync(file + '.json')) return res.json({ ok: true, id: key, url: '/media/' + key + '?token=' + encodeURIComponent(config.token), mime });
        // Copy via temporary file; a Windows sharing failure leaves existing media intact.
        const temp = file + '.' + crypto.randomUUID() + '.tmp';
        try { fs.copyFileSync(localPath, temp); fs.renameSync(temp, file); } catch (error) { try { fs.unlinkSync(temp); } catch {} throw error; }
        atomic(file + '.json', JSON.stringify({ mime }));
        return res.json({ ok: true, id: key, url: '/media/' + key + '?token=' + encodeURIComponent(config.token), mime });
      }
      if (url.pathname === '/api/tools' && req.method === 'POST') {
        assertCanvasRequest(req.body?.name, req.body?.input);
        const expected = req.body?.input?.expectedProjectId;
        if (req.body?.name !== 'canvas_list_projects' && (!expected || expected !== session.canvasState?.projectId)) throw new Error('当前画布与目标项目不一致，请打开对应项目后重试。');
        return next();
      }
      if (publicRead || url.pathname === '/events' || /^\/canvas\/(state|activate|result)$/.test(url.pathname)) return next();
      return res.status(403).json({ ok: false, error: '请在专业助手对话中完成脚本审核与制作确认。' });
    } catch (error) { return res.status(400).json({ ok: false, error: error.message }); }
  });
}
