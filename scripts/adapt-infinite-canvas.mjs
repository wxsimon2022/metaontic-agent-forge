/** Apply reviewed integration points to Haitang-Hub 0a8a8dc. Fails on upstream drift. */
import fs from 'node:fs';
import crypto from 'node:crypto';
const root = new URL('../vendor/infinite-canvas/', import.meta.url);
function patch(file, replacements) {
  const url = new URL(file, root);
  let text = fs.readFileSync(url, 'utf8');
  for (const [before, after] of replacements) {
    if (text.includes(after)) continue;
    if (text.split(before).length !== 2) throw new Error('Upstream integration point drifted: ' + file + ' ' + before.slice(0, 60));
    text = text.replace(before, after);
  }
  fs.writeFileSync(url, text);
}
patch('bridge/index.js', [
  ['// src/server/http.ts\nfunction startHttpServer()', 'import { installForgeMode } from "../../../canvas/bridge-mode.mjs";\n// src/server/http.ts\nfunction startHttpServer()'],
  ['app.use(import_express.default.json({ limit: "30mb" }));', 'app.use(import_express.default.json({ limit: "30mb" }));\n  installForgeMode(app, session, config2);'],
  ['canvas_apply_ops: external_exports.object({ ops: arraySchema(canvasOpSchema) }),', 'canvas_apply_ops: external_exports.object({ ops: arraySchema(canvasOpSchema), expectedProjectId: external_exports.string().optional() }),'],
]);
const asset = fs.readdirSync(new URL('site/assets/', root)).find(name => /^index-.*\.js$/.test(name));
patch('site/assets/' + asset, [
  ['function Kke(e,t)', 'import{connectForgeCanvas,prepareForgeCanvas}from"/forge-ui.js";await connectForgeCanvas();\nfunction Kke(e,t)'],
  ['FKe();document.body.style.font', 'await prepareForgeCanvas(yo);FKe();document.body.style.font'],
  ['nt=wt.applyOps(Xe),Oy(re,Be,de.current,nt)', 'if(lt.expectedProjectId!==wt.snapshot.projectId)throw new Error("目标画布已切换，未执行编辑。");nt=wt.applyOps(Xe),Oy(re,Be,de.current,nt)'],
  ['function CLt({iconStyle:e}){', 'function CLt({iconStyle:e}){return null;'],
  ['style:{...B,pointerEvents:R?void 0:"none"', 'style:{...B,display:"none",pointerEvents:R?void 0:"none"'],
  ['const p=fr[nr(b=>b.theme)];return y.jsx(Dt,{type:"text","aria-label":t,', 'const p=fr[nr(b=>b.theme)];if(["tool-config","tool-director","tool-extensions"].includes(e))return null;return y.jsx(Dt,{type:"text","aria-label":t,'],
]);
fs.copyFileSync(new URL('../canvas/forge-ui.js', import.meta.url), new URL('site/forge-ui.js', root));
fs.writeFileSync(new URL('site/config.js', root), 'window.__INFINITE_CANVAS_CONFIG__ = { autoProxyEnabled: false };\n');
const manifest = {
  repository: 'https://github.com/Haitang-Hub/dsh-infinite-canvas',
  commit: '0a8a8dccc8e8d4fcaa0d792750a8d45be8e5def8', version: '0.2.9', license: 'MIT',
  modifications: 'Platform-only editing, disk persistence, project targeting, native workflow for generation. See scripts/adapt-infinite-canvas.mjs and canvas/.',
  sha256: Object.fromEntries(['bridge/index.js', 'site/assets/' + asset, 'site/forge-ui.js'].map(file => [file, crypto.createHash('sha256').update(fs.readFileSync(new URL(file, root))).digest('hex')])),
};
fs.writeFileSync(new URL('UPSTREAM.json', root), JSON.stringify(manifest, null, 2) + '\n');
