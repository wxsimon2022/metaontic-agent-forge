import assert from 'node:assert/strict';
import { test, after } from 'node:test';
import { build } from 'esbuild';
import { mkdtemp,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const temp=await mkdtemp(path.join(tmpdir(),'mv-cost-'));
await build({stdin:{contents:"export * from './src/workflow/actual-cost.ts'",resolveDir:process.cwd()},bundle:true,platform:'node',format:'esm',outfile:path.join(temp,'cost.mjs')});
const api=await import(pathToFileURL(path.join(temp,'cost.mjs')));after(()=>rm(temp,{recursive:true,force:true}));
const row=(id,actual,extra={})=>({id,type:2,created_at:id,quota:123,other:JSON.stringify({task_id:'task-a',...(actual===undefined?{}:{actual_quota:actual}),pre_consumed_quota:110552}),...extra});
const config={connectionMode:'metaontic',metaonticApiKey:'video-b',imageApiKey:'image',apiKey:'video-a',baseUrl:'https://relay.example/v1'};
async function mock(fn,run){const original=globalThis.fetch;globalThis.fetch=fn;try{return await run();}finally{globalThis.fetch=original;}}
const settings={data:{quota_per_unit:500000,usd_exchange_rate:7.3}};
test('final actual_quota used once, never summed with precharge, adjustment or duplicate logs',()=>{
 const r=api.settledTaskCosts([row(1),row(2,231470),row(2,231470),row(3,999,{other:JSON.stringify({task_id:'other',actual_quota:999})})],['task-a','task-a','task-other']);
 assert.equal(r.length,2);assert.equal(r[0].quota,231470);assert.equal(r[1].status,'pending');assert.equal(r[1].quota,null);
 assert.equal(api.settledTaskCosts([row(2,0)],['task-a'])[0].quota,0);
 assert.equal(api.settledTaskCosts([row(1,null)],['task-a'])[0].status,'pending');
});
test('MetaOntic AI uses the video credential and same base; public conversion has no Key; correct amount returned',async()=>{
 for(const mode of ['metaontic']){
 const calls=[];await mock(async(url,opts)=>{calls.push([url,opts]);return Response.json(url.endsWith('/api/status')?settings:{success:true,data:[row(2,231470),row(1)]});},async()=>{
 const r=await api.fetchActualCost({...config,connectionMode:mode},['task-a']);assert.equal(r.status,'settled');assert.equal(r.amount,3.379462);assert.equal(r.currency,'CNY');
 assert.equal(calls[0][0],'https://relay.example/api/log/token');assert.equal(calls[0][1].headers.Authorization,'Bearer video-b');assert.equal(calls[1][1].headers.Authorization,undefined);assert.equal(calls[0][1].redirect,'error');
 });}
});
test('service mode reads settlement from the relay like the other relay modes',async()=>{
 const calls=[];
 const r=await mock(async(url,opts)=>{calls.push([url,opts]);return Response.json(url.endsWith('/api/status')?settings:{success:true,data:[row(2,231470)]});},async()=>api.fetchActualCost({...config,connectionMode:'service'},['task-a']));
 assert.equal(r.status,'settled');assert.equal(r.amount,3.379462);assert.ok(calls.length>=1);
});
test('missing settlement, auth failure and missing conversion never turn precharge into actual money',async()=>{
 await mock(async()=>Response.json({success:true,data:[row(1)]}),async()=>{
 const r=await api.fetchActualCost(config,['task-a']);assert.equal(r.status,'pending');assert.equal(r.amount,null);
 });
 await mock(async()=>new Response('',{status:403}),async()=>{const r=await api.fetchActualCost(config,['task-a']);assert.equal(r.status,'pending');assert.equal(r.amount,null);});
 await mock(async url=>Response.json(url.endsWith('/api/status')?{data:{}}:{success:true,data:[row(1,231470)]}),async()=>{
 const r=await api.fetchActualCost(config,['task-a']);assert.equal(r.status,'settled');assert.equal(r.amount,null);assert.equal(r.quota,231470);assert.match(api.actualCostText(r),/231470额度/);
 });
});
test('partial settlement is a subtotal and task matching is exact',async()=>{
 await mock(async url=>Response.json(url.endsWith('/api/status')?settings:{success:true,data:[row(2,231470)]}),async()=>{
 const r=await api.fetchActualCost(config,['task-a','task-aa']);assert.equal(r.status,'partial');assert.equal(r.tasks[1].amount,null);assert.match(api.actualCostText(r),/已结算小计/);assert.match(api.actualCostText(r),/task-aa：待结算/);
 });
});
test('C never queries relay billing, including status completion; stopped calls return pending promptly',async()=>{
 await mock(()=>{throw Error('must not fetch');},async()=>{
 assert.equal(await api.fetchActualCost({...config,connectionMode:'volcengine'},['task-a']),undefined);
 const c=new AbortController();c.abort();assert.equal((await api.fetchActualCost(config,['task-a'],c.signal)).status,'pending');
 const tool=api.withActualCost({output:{schema:{},render:()=>[]},execute:async()=>({status:'succeeded',taskId:'task-a'})},{...config,connectionMode:'volcengine'});
 assert.equal((await tool.execute({})).actualCost,undefined);
 });
});
test('wrapper queries completed segments once per task and retains generation and delivery errors',async()=>{
 const results={status:'succeeded',paused:true,resumeDir:'/tmp/resume',deliveryError:'download failed',segments:[{status:'succeeded',taskId:'task-a'},{status:'succeeded',taskId:'task-a'},{status:'unknown',taskId:'pending'}]};
 const live={...config};let authorization;
 const tool=api.withActualCost({output:{schema:{properties:{}},render:()=>[{type:'text',text:'video'}]},execute:async()=>{live.metaonticApiKey='changed';return results;}},live);
 await mock(async(url,opts)=>{authorization??=opts.headers.Authorization;return Response.json(url.endsWith('/api/status')?settings:{success:true,data:[row(1,231470)]});},async()=>{
 const r=await tool.execute({});assert.equal(authorization,'Bearer video-b');assert.equal(r.actualCost.tasks.length,1);assert.equal(r.deliveryError,'download failed');assert.equal(r.resumeDir,'/tmp/resume');assert.match(tool.output.render({},r)[1].text,/已生成部分实际消耗/);
 });
});
