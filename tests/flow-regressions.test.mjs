import './no-network-analytics.mjs';
import assert from 'node:assert/strict';
import {test,after} from 'node:test';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {build} from 'esbuild';
import {apply} from '../index.js';
import {workflowApi} from './workflow-test-api.mjs';
const dir=await mkdtemp(path.join(os.tmpdir(),'流程回归 '));
after(()=>rm(dir,{recursive:true,force:true}));
await build({stdin:{contents:"export {mergeClips} from './src/businesses/video/media/merge.ts'; export {estimatePlan} from './src/businesses/video/workflow/costs.ts';",resolveDir:process.cwd()},bundle:true,platform:'node',format:'esm',outfile:path.join(dir,'api.mjs'),plugins:[{name:'offline-ffmpeg',setup(b){b.onLoad({filter:/media\/ffmpeg\.ts$/},()=>({loader:'js',contents:`
import {writeFile} from 'node:fs/promises';
export const resolveBinary=()=> 'offline-ffmpeg';
export const probeMedia=async()=>({width:1280,height:720,fps:24,hasAudio:false});
export const hasFfmpeg=async()=>true;
export const ffmpegInstallHint=()=>({hint:'offline'});
export async function runProcess(binary,args){await writeFile(args.at(-1),'new movie');return {code:globalThis.__mergeFails?1:0,stderr:'simulated failure'};}
`}))}}]});
const api=await import(pathToFileURL(path.join(dir,'api.mjs')));
test('failed replacement merge preserves previous movie, successful retry replaces it',async()=>{
 const out=path.join(dir,'已有成片.mp4');await writeFile(out,'previous movie');
 globalThis.__mergeFails=true;
 await assert.rejects(api.mergeClips({mergeMode:'reencode'},['first','second'],out),/合并失败/);
 assert.equal(await readFile(out,'utf8'),'previous movie');
 globalThis.__mergeFails=false;
 await api.mergeClips({mergeMode:'reencode'},['first','second'],out);
 assert.equal(await readFile(out,'utf8'),'new movie');delete globalThis.__mergeFails;
});
test('extension duration rejects silent shortening in the shared estimation plan',()=>{
 const c={connectionMode:'metaontic',model:'seedance-2.5'};
 assert.throws(()=>api.estimatePlan(c,'metaontic_agent_forge_video_extend',{duration:45,segments:1}),/不会自动缩短/);
 assert.deepEqual(api.estimatePlan(c,'metaontic_agent_forge_video_extend',{duration:15,segments:3}).map(s=>s.seconds),[15,15,15]);
 assert.throws(()=>api.estimatePlan(c,'metaontic_agent_forge_video_extend',{duration:15,segments:1.5}),/segments/);
});
test('failed confirmation hook blocks paid tools even when directly executed',async()=>{
 const registered=new Map();let warnings=0;
 const dispose=apply({tools:{register(t){registered.set(t.name,t);return()=>{};}},inject(){},on(name){if(name==='tools/pre-execute')throw Error('unavailable');return()=>{};},logger:{warn(){warnings++;}}},{connectionMode:'metaontic'});
 try{
  assert.equal(warnings,1);
  for(const name of ['metaontic_agent_forge_video_generate','metaontic_agent_forge_video_extend','metaontic_agent_forge_video_prepare_image','metaontic_agent_forge_video_setup','metaontic_agent_forge_media_submission'])
   await assert.rejects(registered.get(name).execute({},{}),/人工确认服务未就绪/);
 }finally{dispose();}
});
test('a definitively failed segment rebuilds its request with the revised prompt',async()=>{
 const home=await mkdtemp(path.join(dir,'failed '));const priorHome=process.env.DSH_HOME,priorFetch=globalThis.fetch;
 process.env.DSH_HOME=home;const bodies=[];let first=true;
 globalThis.fetch=async(url,options={})=>{
  if(options.method==='POST'){bodies.push(JSON.parse(options.body));return Response.json({id:'task-'+bodies.length});}
  if(first){first=false;return Response.json({status:'failed',error:{message:'invalid old prompt'}});}
  return Response.json({status:'succeeded',content:{video_url:'https://mock.invalid/movie.mp4'}});
 };
 try{
  const c={connectionMode:'metaontic',metaonticApiKey:'offline',baseUrl:'https://mock.invalid',model:'doubao-seedance-2-0-mini-260615',outputDir:home};
  const tool=workflowApi.lowLevelVideo('metaontic_agent_forge_video_generate',c,{});
  const result=await tool.execute({prompt:'旧的构思',duration:5,ratio:'16:9',resolution:'480p',merge:false},{});
  assert.equal(result.status,'failed');
  const next=await tool.execute({resume:result.resumeDir,prompt:'修改后已审核的新构思'},{});
  assert.equal(next.status,'succeeded');assert.equal(bodies.length,2);
  assert.match(bodies[1].content[0].text,/修改后已审核的新构思/);assert.doesNotMatch(bodies[1].content[0].text,/旧的构思/);
 }finally{globalThis.fetch=priorFetch;if(priorHome===undefined)delete process.env.DSH_HOME;else process.env.DSH_HOME=priorHome;}
});
