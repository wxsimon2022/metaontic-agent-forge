import {sourceOf} from './source.mjs';
import vm from 'node:vm';
import path from 'node:path';
import assert from 'node:assert/strict';
import {test} from 'node:test';
const ctx=vm.createContext({path,process,appendRequestLog:async()=>{}});
vm.runInContext(sourceOf('workflow/delivery-order')+'\nObject.assign(globalThis,{createDeliveryOrderGuard});',ctx);

const merged='/w/merged-30s.mp4';
const segments=['','/w/01-generate.mp4','/w/02-extend.mp4'].slice(1);
function setup(){
 const guard=ctx.createDeliveryOrderGuard();
 const session={header:{cwd:'/w'}};
 guard.remember(session,{status:'succeeded',merged:true,videoPath:merged,segments:[
  {index:1,status:'succeeded',localPath:segments[0]},{index:2,status:'succeeded',localPath:segments[1]}]});
 const present=(...paths)=>({name:'present',callId:'c1',agent:{session},arguments:{files:paths.map(p=>({path:p}))}});
 const shown=(files,turn=1)=>guard.observe(session,{type:'deliverables/presented',data:{turn,files:files.map(p=>({path:p}))}});
 return {guard,session,present,shown};
}

test('成片排在分段之后会被拦下并要求重发（真实事故顺序）',async()=>{
 const h=setup();
 const decision=await h.guard.gate(h.present(segments[0],segments[1],merged));
 assert.equal(decision.kind,'deny');
 assert.match(decision.reason,/合并成片必须排在所有分段之前/);
 assert.ok(decision.reason.includes(merged));
});

test('成片在第一个位置时放行',async()=>{
 const h=setup();
 assert.equal(await h.guard.gate(h.present(merged,segments[0],segments[1])),null);
});

test('只展示分段、成片还没展示时会被拦下',async()=>{
 const h=setup();
 const decision=await h.guard.gate(h.present(segments[0],segments[1]));
 assert.equal(decision.kind,'deny');
 assert.match(decision.reason,/成片要排在第一个位置/);
});

test('本轮已经展示过成片时，再单独展示分段放行',async()=>{
 const h=setup();
 h.shown([merged]);
 assert.equal(await h.guard.gate(h.present(segments[0],segments[1])),null);
});

test('上一轮的成片不能给本轮的分段展示放行',async()=>{
 const h=setup();
 h.shown([merged],1);
 h.shown([segments[0]],2);
 assert.equal((await h.guard.gate(h.present(segments[0],segments[1]))).kind,'deny');
});

test('只展示成片或与视频无关的文件都不受影响',async()=>{
 const h=setup();
 assert.equal(await h.guard.gate(h.present(merged)),null);
 assert.equal(await h.guard.gate(h.present('/w/storyboard-v1.png','/w/script.md')),null);
 assert.equal(await h.guard.gate({name:'video_generate',agent:{session:h.session},arguments:{}}),null);
});

test('相对路径按会话工作目录解析，同样能识别顺序',async()=>{
 const h=setup();
 assert.equal((await h.guard.gate(h.present('01-generate.mp4','merged-30s.mp4'))).kind,'deny');
 assert.equal(await h.guard.gate(h.present('merged-30s.mp4','01-generate.mp4')),null);
});

test('没有合并成片（合并失败）时不拦分段交付',async()=>{
 const guard=ctx.createDeliveryOrderGuard();
 const session={header:{cwd:'/w'}};
 guard.remember(session,{status:'succeeded',merged:false,segments:[
  {index:1,status:'succeeded',localPath:segments[0]},{index:2,status:'succeeded',localPath:segments[1]}]});
 const exec={name:'present',agent:{session},arguments:{files:segments.map(p=>({path:p}))}};
 assert.equal(await guard.gate(exec),null);
});

test('暂停时只有一段预览不会被误拦，其他会话互不影响',async()=>{
 const guard=ctx.createDeliveryOrderGuard();
 const paused={header:{cwd:'/w'}};
 guard.remember(paused,{status:'succeeded',paused:true,merged:true,videoPath:'/w/pause/01.mp4',segments:[{index:1,status:'succeeded',localPath:'/w/pause/01.mp4'}]});
 const one=async paths=>guard.gate({name:'present',agent:{session:paused},arguments:{files:paths.map(p=>({path:p}))}});
 assert.equal(await one(['/w/pause/01.mp4']),null);
 assert.equal(await one(['/w/pause/01.mp4','/w/pause/02.mp4']),null);
 const other={header:{cwd:'/w'}};
 assert.equal(await guard.gate({name:'present',agent:{session:other},arguments:{files:[{path:merged},{path:segments[0]}]}}),null);
});

const wiring=vm.createContext({path,process,appendRequestLog:async()=>{}});
vm.runInContext(sourceOf('workflow/delivery-order','workflow/execution').replaceAll('import.meta.url',"'file:///tmp/metaontic-video.js'")
 +'\nObject.assign(globalThis,{createDeliveryOrderGuard,withVideoExecution});',wiring);

test('withVideoExecution 把真实工具结果交给顺序守卫，记录失败不影响交付',async()=>{
 const guard=wiring.createDeliveryOrderGuard();
 const session={header:{cwd:'/w'}};
 const result={status:'succeeded',merged:true,videoPath:merged,segments:[
  {index:1,status:'succeeded',localPath:segments[0]},{index:2,status:'succeeded',localPath:segments[1]}]};
 const exec={callId:'c1',agent:{session}};
 const tool={name:'video_generate',execute:async()=>result};
 const wrapped=wiring.withVideoExecution(tool,guard.remember);
 assert.equal(await wrapped.execute({},exec),result);
 assert.equal((await guard.gate({name:'present',agent:{session},arguments:{files:[{path:segments[0]},{path:merged}]}})).kind,'deny');
 assert.equal(await guard.gate({name:'present',agent:{session},arguments:{files:[{path:merged},{path:segments[0]}]}}),null);
 const broken=wiring.withVideoExecution(tool,()=>{throw new Error('record failed')});
 assert.equal((await broken.execute({},exec)).status,'succeeded');
});
