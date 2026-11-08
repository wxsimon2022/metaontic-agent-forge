import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
for(const [id,title] of [['video-director','视频创作助手'],['promo-video','宣传视频助手'],['cloud-studio','云智工坊 · 智能体平台']]){
 test(`${id}: component metadata resolves through the full preset module name`,async()=>{
  const spec=`metaontic-video/presets/${id}`;
  const english=JSON.parse(await readFile(fileURLToPath(import.meta.resolve(`${spec}/locale/en.json`)),'utf8'));
  const chinese=JSON.parse(await readFile(fileURLToPath(import.meta.resolve(`${spec}/locale/zh.json`)),'utf8'));
  assert.equal(chinese.meta.title,title);assert.ok(english.meta.title);
  const entry=await readFile(fileURLToPath(import.meta.resolve(spec)),'utf8');
  assert.match(entry,/export \{ default \} from '@deepseek-ai\/dsh-agent-preset'/);
 });
}
