import {api} from './module-test-api.mjs';
import assert from 'node:assert/strict';
import {test} from 'node:test';
function fixture(answers=[]){
 const asks=[],saved=[],project={approved:null};const exec={agent:{},callId:'duration'};
 const ctx={get:()=>({ask:async request=>{asks.push(request);const answer=answers.shift();return {answers:answer?[{id:request.questions[0].id,...answer}]:[]};}})};
 return {project,asks,saved,answers,exec,ctx,run:duration=>api.ensureProjectDuration(ctx,exec,project,duration,async data=>saved.push(structuredClone(data)))};
}
test('missing duration asks all four suggestions and an explicit custom choice; confirmed answer persists',async()=>{
 const h=fixture([{selected:['30 秒']}]);assert.deepEqual(await h.run(),{status:'confirmed',duration:30});
 assert.deepEqual(h.asks[0].questions[0].options.map(x=>x.label),['15 秒','30 秒','45 秒','60 秒','自定义时长']);
 assert.equal(h.project.duration,30);await h.run();assert.equal(h.asks.length,1);
});
test('custom choice opens a free input question and accepts an integer number of seconds',async()=>{
 const h=fixture([{selected:['自定义时长']},{custom:'23秒'}]);assert.equal((await h.run()).duration,23);
 assert.equal(h.asks.length,2);assert.equal(h.asks[1].questions[0].options,undefined);
 assert.equal(h.project.durationCustom,undefined);
});
test('free input on the suggestions question is accepted without a redundant dialog',async()=>{
 const h=fixture([{custom:'50 秒'}]);assert.equal((await h.run()).duration,50);assert.equal(h.asks.length,1);
});
test('explicit user duration skips the dialog and an explicit change clears prior script approval',async()=>{
 const h=fixture();await h.run(45);assert.equal(h.asks.length,0);h.project.approved={old:true};await h.run(60);
 assert.equal(h.project.duration,60);assert.equal(h.project.approved,null);
});
for(const answer of [null,{selected:[]},{selected:['15 秒','30 秒']},{custom:'2.5秒'},{custom:'121秒'}])test(`unresolved or invalid answer never defaults: ${JSON.stringify(answer)}`,async()=>{
 const h=fixture([answer]);assert.equal((await h.run()).status,'pending');assert.equal(h.project.duration,undefined);
});
test('cancelling custom input preserves the choice and resumes input without re-asking suggestions',async()=>{
 const h=fixture([{selected:['自定义时长']},null]);assert.equal((await h.run()).status,'pending');assert.equal(h.project.duration,undefined);
 h.answers.push({custom:'20秒'});assert.equal((await h.run()).duration,20);assert.equal(h.asks[2].questions[0].id,'video_duration_custom');
});
test('unavailable questions, aborts and failed persistence cannot authorize duration',async()=>{
 const h=fixture();h.ctx.get=()=>null;assert.equal((await h.run()).status,'pending');
 const controller=new AbortController();controller.abort();h.exec.signal=controller.signal;assert.equal((await h.run(30)).status,'pending');
 const other=fixture([{selected:['15 秒']}]);const result=await api.ensureProjectDuration(other.ctx,other.exec,other.project,undefined,async()=>{throw Error('disk failure');});
 assert.equal(result.status,'pending');assert.equal(other.project.duration,undefined);
});

test('a previously approved project reuses its confirmed duration without invalidating review',async()=>{
 const h=fixture();h.project.approved={name:'metaontic_agent_forge_video_generate',specification:{duration:30}};
 const approved=h.project.approved;assert.equal((await h.run()).duration,30);assert.equal(h.asks.length,0);assert.equal(h.project.approved,approved);
});
