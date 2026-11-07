/** Portable build entry: no POSIX command substitution or shell quoting. */
import { build } from 'esbuild';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
const version = JSON.parse(await readFile('package.json', 'utf8')).version;
const target = process.argv[2] || 'all';
if (!['all','locale','host','client'].includes(target)) throw Error('Unknown build target');
if (target === 'all' || target === 'locale') {
  await mkdir('locale', { recursive: true });
  for (const lang of ['zh','en']) {
    const result = await build({entryPoints:[`src/locale/${lang}.ts`],bundle:true,format:'esm',platform:'node',write:false});
    const module = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
    const value = module.default ?? module.locale;
    if (!value) throw Error(`Missing ${lang} locale`);
    await writeFile(`locale/${lang}.json`, JSON.stringify(value,null,2)+'\n');
  }
}
if (target === 'all' || target === 'host') await build({entryPoints:['src/index.ts'],bundle:true,format:'esm',platform:'node',target:'node20',define:{__PLUGIN_VERSION__:JSON.stringify(version)},outfile:'index.js'});
if (target === 'all' || target === 'client') await build({entryPoints:['src/client.ts'],bundle:true,format:'iife',platform:'browser',target:'es2022',loader:{'.svg':'text'},define:{__PLUGIN_VERSION__:JSON.stringify(version)},outfile:'client.js'});
