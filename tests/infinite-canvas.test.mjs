import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { assertCanvasRequest } from '../canvas/bridge-mode.mjs';
import { api } from './module-test-api.mjs';

test('canvas adapter blocks every generation route and keeps ordinary node edits', () => {
  for (const name of ['canvas_run_generation', 'canvas_generate_image', 'workbench_video_generate', 'site_navigate']) assert.throws(() => assertCanvasRequest(name, {}));
  for (const type of ['run_generation', 'unknown']) assert.throws(() => assertCanvasRequest('canvas_apply_ops', {ops:[{type}]}));
  assert.throws(() => assertCanvasRequest('canvas_apply_ops', {ops:[{type:'update_node',patch:{autoRun:true}}]}));
  assert.doesNotThrow(() => assertCanvasRequest('canvas_apply_ops', {ops:[{type:'add_node',nodeType:'text',metadata:{content:'分镜'}},{type:'connect_nodes',fromNodeId:'a',toNodeId:'b'}]}));
});

test('canvas identity separates sessions/projects and delegated tasks reuse explicit destination', async () => {
  const a=api.canvasIdentity('root','video-a');
  assert.notEqual(a,api.canvasIdentity('root','video-b'));
  assert.notEqual(a,api.canvasIdentity('child','video-a'));
  const opened=[], calls=[];
  const tool=api.canvasTool({open:async(...args)=>{opened.push(args);return{canvasId:args[0]};},call:async(...args)=>{calls.push(args);return{nodes:[]};}});
  const root={agent:{session:{id:'root'}}}, child={agent:{session:{id:'child'}}};
  assert.equal((await tool.execute({action:'open',projectId:'video-a'},root)).canvasId,a);
  await tool.execute({action:'state',canvasId:a},child);
  assert.equal(calls[0][1].expectedProjectId,a);
  await assert.rejects(tool.execute({action:'apply',ops:[]},child),/canvasId/);
  assert.equal(opened.length,1);
});

test('media import verifies project before file access and returns reusable node identity', async () => {
  const calls=[];
  const tool=api.canvasTool({call:async(name,input)=>{calls.push([name,input]);return{nodes:[]};},media:async(file)=>{calls.push(['media',file]);return{id:'abc',mime:'image/png',url:'/media/abc'};}});
  const result=await tool.execute({action:'import_media',canvasId:api.canvasIdentity('root'),localPath:'/workspace/角色.png'},{});
  assert.deepEqual(calls.map(row=>row[0]),['canvas_get_state','media','canvas_apply_ops']);
  assert.equal(calls[2][1].ops[0].metadata.content,'/media/abc');
  assert.equal(result.nodeId,'media-abc');
  let copied=false;
  const rejected=api.canvasTool({call:async()=>{throw Error('项目不一致');},media:async()=>{copied=true;}});
  await assert.rejects(rejected.execute({action:'import_media',canvasId:api.canvasIdentity('root'),localPath:'C:\\素材\\角色.png'},{}),/项目不一致/);
  assert.equal(copied,false);
});

test('vendored upstream identity, license and adapted runtime hashes are pinned', async () => {
  const base=new URL('../vendor/infinite-canvas/',import.meta.url);
  const pin=JSON.parse(await readFile(new URL('UPSTREAM.json',base)));
  assert.equal(pin.repository,'https://github.com/Haitang-Hub/dsh-infinite-canvas');
  assert.equal(pin.commit,'0a8a8dccc8e8d4fcaa0d792750a8d45be8e5def8');
  assert.match(await readFile(new URL('LICENSE',base),'utf8'),/MIT License/);
  for(const[file,hash]of Object.entries(pin.sha256))assert.equal(createHash('sha256').update(await readFile(new URL(file,base))).digest('hex'),hash,file);
});
