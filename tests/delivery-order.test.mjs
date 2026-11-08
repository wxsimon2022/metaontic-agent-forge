import {sourceOf} from './source.mjs';
import vm from 'node:vm';
import path from 'node:path';
import assert from 'node:assert/strict';
import {test} from 'node:test';
// 交付副本可能被改名，守卫要靠文件大小认领，所以用一张可控的大小表替掉真实文件系统。
const sizes=new Map();
const stat=async target=>{
 if(!sizes.has(target)){const error=new Error(`ENOENT ${target}`);error.code='ENOENT';throw error;}
 return {isFile:()=>true,size:sizes.get(target)};
};
const ctx=vm.createContext({path,process,stat,appendRequestLog:async()=>{}});
vm.runInContext(sourceOf('businesses/video/workflow/result-state','businesses/video/workflow/delivery-order')+'\nObject.assign(globalThis,{createDeliveryOrderGuard});',ctx);

const merged='/w/merged-30s.mp4';
const segments=['/w/01-generate.mp4','/w/02-extend.mp4'];
const runDir='/w/segments/20261102-201600';
const dir=runDir.split('/').slice(0,-1).join('/');
async function setup(){
 const guard=ctx.createDeliveryOrderGuard();
 const session={header:{cwd:'/w'}};
 await guard.remember(session,{status:'succeeded',merged:true,videoPath:merged,segmentsDir:runDir,segments:[
  {index:1,status:'succeeded',localPath:segments[0]},{index:2,status:'succeeded',localPath:segments[1]}]});
 const present=(...paths)=>({name:'present',callId:'c1',agent:{session},arguments:{files:paths.map(p=>({path:p}))}});
 const shown=(files,turn=1)=>guard.observe(session,{type:'deliverables/presented',data:{turn,files:files.map(p=>({path:p}))}});
 return {guard,session,present,shown};
}

test('成片排在分段之后会被拦下并要求重发（真实事故顺序）',async()=>{
 const h=await setup();
 const decision=await h.guard.gate(h.present(segments[0],segments[1],merged));
 assert.equal(decision.kind,'deny');
 assert.match(decision.reason,/合并成片必须排在所有分段之前/);
 assert.ok(decision.reason.includes(merged));
});

test('成片在第一个位置时放行',async()=>{
 const h=await setup();
 assert.equal(await h.guard.gate(h.present(merged,segments[0],segments[1])),null);
});

test('只展示分段、成片还没展示时会被拦下',async()=>{
 const h=await setup();
 const decision=await h.guard.gate(h.present(segments[0],segments[1]));
 assert.equal(decision.kind,'deny');
 assert.match(decision.reason,/成片必须排在第一个位置/);
});

test('本轮已经展示过成片时，再单独展示分段放行',async()=>{
 const h=await setup();
 h.shown([merged]);
 assert.equal(await h.guard.gate(h.present(segments[0],segments[1])),null);
});

test('上一轮的成片不能给本轮的分段展示放行',async()=>{
 const h=await setup();
 h.shown([merged],1);
 h.shown([segments[0]],2);
 assert.equal((await h.guard.gate(h.present(segments[0],segments[1]))).kind,'deny');
});

test('只展示成片或与视频无关的文件都不受影响',async()=>{
 const h=await setup();
 assert.equal(await h.guard.gate(h.present(merged)),null);
 assert.equal(await h.guard.gate(h.present('/w/storyboard-v1.png','/w/script.md')),null);
 assert.equal(await h.guard.gate({name:'video_generate',agent:{session:h.session},arguments:{}}),null);
});

test('相对路径按会话工作目录解析，同样能识别顺序',async()=>{
 const h=await setup();
 assert.equal((await h.guard.gate(h.present('01-generate.mp4','merged-30s.mp4'))).kind,'deny');
 assert.equal(await h.guard.gate(h.present('merged-30s.mp4','01-generate.mp4')),null);
});

test('成片与分段被改名到交付目录后，按文件字节数认领并照样拦顺序',async()=>{
 // 真实现场：成片另存为 final/naiman-60s.mp4，分段换成交付目录里的 15s 副本，路径与记录的完全不同，只有大小对得上。
 sizes.set(merged,900);sizes.set(segments[0],300);sizes.set(segments[1],301);
 const h=await setup();
 sizes.set('/w/final/naiman-60s.mp4',900);
 sizes.set('/w/20261102-200111-15s.mp4',300);
 sizes.set('/w/20261102-200830-15s.mp4',301);
 const copies=['/w/20261102-200111-15s.mp4','/w/20261102-200830-15s.mp4'];
 const decision=await h.guard.gate(h.present(...copies,'/w/final/naiman-60s.mp4'));
 assert.equal(decision.kind,'deny');
 assert.ok(decision.reason.includes(merged));
 assert.equal(await h.guard.gate(h.present('/w/final/naiman-60s.mp4',...copies)),null);
});

test('暂停时只有部分合并也不能登记卡片，改用正文交付',async()=>{
 const earlier='/w/20261102-201600-30s.mp4';
 sizes.set(earlier,700);sizes.set(merged,900);sizes.set(segments[0],300);sizes.set(segments[1],301);
 const guard=ctx.createDeliveryOrderGuard();
 const session={header:{cwd:'/w'}};
 const present=(...paths)=>({name:'present',agent:{session},arguments:{files:paths.map(p=>({path:p}))}});
 const parts=[{index:1,status:'succeeded',localPath:segments[0]},{index:2,status:'succeeded',localPath:segments[1]}];
 await guard.remember(session,{status:'succeeded',paused:true,merged:true,videoPath:earlier,segmentsDir:'/w/segments/20261102-201600',segments:parts});
 const paused=await guard.gate(present(earlier,segments[0]));
 assert.equal(paused.kind,'deny');
 assert.match(paused.reason,/还不是最终交付/);
});

test('部分交付（有分段失败）时不许登记卡片',async()=>{
 sizes.set(merged,900);sizes.set(segments[0],300);
 const guard=ctx.createDeliveryOrderGuard();
 const session={header:{cwd:'/w'}};
 await guard.remember(session,{status:'succeeded',partial:true,merged:true,videoPath:merged,segmentsDir:'/w/segments/20261102-201600',segments:[{index:1,status:'succeeded',localPath:segments[0]}]});
 const decision=await guard.gate({name:'present',agent:{session},arguments:{files:[{path:merged},{path:segments[0]}]}});
 assert.equal(decision.kind,'deny');
 assert.match(decision.reason,/还不是最终交付/);
});

test('待查询（pendingTaskId）时不许登记卡片',async()=>{
 sizes.set(merged,900);sizes.set(segments[0],300);
 const guard=ctx.createDeliveryOrderGuard();
 const session={header:{cwd:'/w'}};
 await guard.remember(session,{status:'succeeded',merged:true,pendingTaskId:'task-x',videoPath:merged,segmentsDir:'/w/segments/20261102-201600',segments:[{index:1,status:'succeeded',localPath:segments[0]}]});
 assert.match((await guard.gate({name:'present',agent:{session},arguments:{files:[{path:merged},{path:segments[0]}]}})).reason,/还不是最终交付/);
});

test('登记里带中间版本的成片会被拦下',async()=>{
 const earlier='/w/20261102-201600-30s.mp4';
 sizes.set(earlier,700);sizes.set(merged,900);sizes.set(segments[0],300);sizes.set(segments[1],301);
 const guard=ctx.createDeliveryOrderGuard();
 const session={header:{cwd:'/w'}};
 const present=(...paths)=>({name:'present',agent:{session},arguments:{files:paths.map(p=>({path:p}))}});
 const parts=[{index:1,status:'succeeded',localPath:segments[0]},{index:2,status:'succeeded',localPath:segments[1]}];
 await guard.remember(session,{status:'succeeded',paused:true,merged:true,videoPath:earlier,segmentsDir:'/w/segments/20261102-201600',segments:parts});
 await guard.remember(session,{status:'succeeded',merged:true,videoPath:merged,segmentsDir:'/w/segments/20261102-201600',segments:parts});
 const decision=await guard.gate(present(merged,segments[0],segments[1],earlier));
 assert.equal(decision.kind,'deny');
 assert.match(decision.reason,/中间版本/);
 assert.ok(decision.reason.includes(merged));
});

test('没有合并成片（合并失败）时不拦分段交付',async()=>{
 const guard=ctx.createDeliveryOrderGuard();
 const session={header:{cwd:'/w'}};
 await guard.remember(session,{status:'succeeded',merged:false,segments:[
  {index:1,status:'succeeded',localPath:segments[0]},{index:2,status:'succeeded',localPath:segments[1]}]});
 const exec={name:'present',agent:{session},arguments:{files:segments.map(p=>({path:p}))}};
 assert.equal(await guard.gate(exec),null);
});

test('单段暂停时成片就是这一段本身，只有一条记录不涉及顺序；其他会话互不影响',async()=>{
 const guard=ctx.createDeliveryOrderGuard();
 const paused={header:{cwd:'/w'}};
 await guard.remember(paused,{status:'succeeded',paused:true,merged:true,videoPath:'/w/pause/01.mp4',segments:[{index:1,status:'succeeded',localPath:'/w/pause/01.mp4'}]});
 const one=async paths=>guard.gate({name:'present',agent:{session:paused},arguments:{files:paths.map(p=>({path:p}))}});
 assert.equal(await one(['/w/pause/01.mp4']),null);
 const other={header:{cwd:'/w'}};
 assert.equal(await guard.gate({name:'present',agent:{session:other},arguments:{files:[{path:merged},{path:segments[0]}]}}),null);
});

const wiring=vm.createContext({path,process,stat,appendRequestLog:async()=>{}});
vm.runInContext(sourceOf('businesses/video/workflow/result-state','businesses/video/workflow/delivery-order','businesses/video/workflow/execution').replaceAll('import.meta.url',"'file:///tmp/metaontic-video.js'")
 +'\nObject.assign(globalThis,{createDeliveryOrderGuard,withVideoExecution});',wiring);

test('withVideoExecution 把真实工具结果交给顺序守卫，记录失败不影响交付',async()=>{
 const guard=wiring.createDeliveryOrderGuard();
 const session={header:{cwd:'/w'}};
 const result={status:'succeeded',merged:true,videoPath:merged,segmentsDir:runDir,segments:[
  {index:1,status:'succeeded',localPath:segments[0]},{index:2,status:'succeeded',localPath:segments[1]}]};
 const exec={callId:'c1',agent:{session}};
 const tool={name:'video_generate',execute:async()=>result};
 const wrapped=wiring.withVideoExecution(tool,guard.remember);
 assert.equal(await wrapped.execute({},exec),result);
 assert.equal((await guard.gate({name:'present',agent:{session},arguments:{files:[{path:segments[0]},{path:merged}]}})).kind,'deny');
 assert.equal(await guard.gate({name:'present',agent:{session},arguments:{files:[{path:merged},{path:segments[0]}]}}),null);
 const broken=wiring.withVideoExecution(tool,()=>{throw new Error('record failed')});
 assert.equal((await broken.execute({},exec)).status,'succeeded');
 const rejected=wiring.withVideoExecution(tool,async()=>{throw new Error('record failed later')});
 assert.equal((await rejected.execute({},exec)).status,'succeeded');
});
