import { context } from 'esbuild';
import { readFileSync } from 'node:fs';
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url)));
process.chdir(new URL('..', import.meta.url).pathname);
const ctx = await context({
  entryPoints: ['preview/main.jsx'], bundle: true, format: 'esm', platform: 'browser',
  loader: { '.svg': 'text' },
  outdir: 'preview/.build', sourcemap: true, define: { __PLUGIN_VERSION__: JSON.stringify(pkg.version) },
});
await ctx.watch();
const server = await ctx.serve({ servedir: 'preview', host: '127.0.0.1', port: Number(process.env.PREVIEW_PORT || 4174) });
console.log(`独立预览：http://127.0.0.1:${server.port} — 修改 src/client.ts 自动刷新；Ctrl+C 停止。`);
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, async () => { await ctx.dispose(); process.exit(); });
