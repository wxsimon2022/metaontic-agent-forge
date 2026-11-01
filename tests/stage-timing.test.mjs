import {sourceOf} from './source.mjs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {AsyncLocalStorage} from 'node:async_hooks';
import {randomUUID} from 'node:crypto';
import {performance} from 'node:perf_hooks';
function harness(){
 const logs=[];const ctx=vm.createContext({randomUUID,performance,appendRequestLog:async record=>logs.push(record),requestLogContext:new AsyncLocalStorage()});
 vm.runInContext(sourceOf('utils/timing','tools/video-stage'),ctx);return {ctx,logs};
}
test('automatic timing records paired spans and elapsed time without sensitive data',async()=>{
 const {ctx,logs}=harness();const result={status:'succeeded',secret:'private-output'};
 const wrapped=ctx.withStageTiming({name:'video_estimate',execute:async()=>result});
 assert.equal(await wrapped.execute({apiKey:'secret-key',prompt:'secret-prompt'},{callId:'call-1'}),result);
 assert.equal(logs.length,2);assert.equal(logs[0].spanId,logs[1].spanId);assert.ok(logs[1].elapsedMs>=0);
 assert.equal(logs[1].outcome,'success');assert.ok(!JSON.stringify(logs).includes('secret'));assert.ok(!JSON.stringify(logs).includes('private-output'));
});
test('errors and cancellations preserve original exception and close timing span',async()=>{
 for(const cancelled of [false,true]){
 const {ctx,logs}=harness();const error=Object.assign(Error('private'),{code:cancelled?'ABORTED':'failure'});
 await assert.rejects(ctx.timedStage('video_poll_wait',async()=>{throw error;}),x=>x===error);
 assert.equal(logs[1].outcome,cancelled?'cancelled':'error');assert.ok(!JSON.stringify(logs).includes('private'));
 }
});
test('concurrent stage spans remain distinct and failed status is not logged as success',async()=>{
 const {ctx,logs}=harness();await Promise.all([ctx.timedStage('a',async()=>({status:'failed'})),ctx.timedStage('b',async()=>({status:'timeout'}))]);
 const ends=logs.filter(x=>x.event==='stage_finished');assert.equal(new Set(ends.map(x=>x.spanId)).size,2);assert.deepEqual(ends.map(x=>x.outcome).sort(),['failed','timeout']);
});
test('script design and user wait are separate marker spans with no duplicate finish',async()=>{
 const {ctx,logs}=harness();const tool=ctx.stageTool();
 const a=await tool.execute({action:'start',stage:'script_design'});
 assert.equal((await tool.execute({action:'finish',stage:'script_design',spanId:a.spanId})).status,'finished');
 const b=await tool.execute({action:'start',stage:'script_review_wait'});
 assert.equal((await tool.execute({action:'finish',stage:'script_review_wait',spanId:b.spanId,outcome:'cancelled'})).status,'finished');
 assert.equal((await tool.execute({action:'finish',stage:'script_review_wait',spanId:b.spanId})).status,'unavailable');
 assert.equal(logs.length,4);assert.equal(logs[3].outcome,'cancelled');
});
test('unknown or mismatched marker never fabricates an elapsed duration',async()=>{
 const {ctx,logs}=harness();const tool=ctx.stageTool();
 await assert.rejects(tool.execute({action:'start',stage:'api-key-secret'}),/未知/);
 const a=await tool.execute({action:'start',stage:'storyboard_design'});
 const missing=await tool.execute({action:'finish',stage:'script_design',spanId:a.spanId});
 assert.equal(missing.status,'unavailable');assert.equal(missing.elapsedMs,undefined);assert.equal(logs.length,1);
});
