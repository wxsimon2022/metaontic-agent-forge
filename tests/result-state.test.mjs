import {api} from './module-test-api.mjs';
import assert from 'node:assert/strict';
import {test} from 'node:test';
const segments=[1,2].map(index=>({index,kind:index===1?'generate':'extend',seconds:15,status:'succeeded',taskId:`task-${index}`,videoUrl:`https://media.invalid/${index}.mp4`,localPath:`/out/${index}.mp4`}));
const final={status:'succeeded',merged:true,videoPath:'/out/final.mp4',segments};
for(const [fields,phase] of [
 [{},'complete'],[{paused:true},'segment_review'],[{partial:true},'partial'],
 [{deliveryError:'download failed'},'delivery_pending'],[{ffmpegMissing:true},'delivery_pending'],
 [{pendingTaskId:'pending'},'task_pending'],[{status:'timeout'},'task_pending'],
 [{status:'unknown'},'task_pending'],[{status:'review_required'},'reference_review'],
])test(`result state ${phase} overrides superficially successful delivery`,()=>{
 const state=api.videoResultState({...final,...fields});assert.equal(state.phase,phase);
 assert.equal(state.canPresent,phase==='complete');assert.equal(state.isFinal,phase==='complete');
});
test('remote-only success, single local clip, partial failure and absent results remain distinct',()=>{
 assert.equal(api.videoResultState({status:'succeeded',videoUrl:'https://media.invalid/a.mp4'}).phase,'generated');
 assert.equal(api.videoResultState({status:'succeeded',segments:[segments[0]]}).canPresent,true);
 assert.equal(api.videoResultState({status:'failed',segments:[segments[0]]}).phase,'partial');
 assert.equal(api.videoResultState({status:'failed'}).phase,'failed');
 assert.equal(api.videoResultState({status:'succeeded'}).phase,'unknown');
});
const record=()=>({plugin:'metaontic-video',version:1,plan:[{kind:'generate',seconds:15},{kind:'extend',seconds:15}],done:1,cursor:15,steps:[{...segments[0]}],pendingTask:{taskId:'pending',index:2}});
test('old and current pause files are validated without changing their bytes or requiring new fields',()=>{
 const current=record();const before=JSON.stringify(current);assert.equal(api.validatePauseRecord(current),current);assert.equal(JSON.stringify(current),before);
 delete current.version;delete current.pendingTask.index;delete current.steps[0].seconds;
 assert.equal(api.validatePauseRecord(current),current);
});
for(const [label,edit] of [
 ['unknown version',r=>r.version=2],['out of range cursor index',r=>r.done=3],
 ['missing completed steps',r=>r.steps=[]],['invalid plan duration',r=>r.plan[0].seconds=NaN],
 ['nonfinite cursor',r=>r.cursor=Infinity],['wrong pending index',r=>r.pendingTask.index=1],
 ['missing prior task',r=>delete r.steps[0].taskId],
])test(`invalid pause file blocks recovery: ${label}`,()=>{
 const data=record();edit(data);assert.throws(()=>api.validatePauseRecord(data),/保留原文件.*不要重新提交/);
});

test('conflicting legacy flags cannot hide a pending or failed segment',()=>{
 assert.equal(api.videoResultState({...final,segments:[segments[0],{status:'unknown'}]}).phase,'task_pending');
 assert.equal(api.videoResultState({...final,segments:[segments[0],{status:'failed'}]}).phase,'partial');
 assert.equal(api.videoResultState(null).phase,'unknown');
});
