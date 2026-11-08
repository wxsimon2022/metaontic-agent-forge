import assert from 'node:assert/strict';
import {test} from 'node:test';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {workflowApi as api} from './workflow-test-api.mjs';
async function fixture(run){
 const dir=await mkdtemp(path.join(os.tmpdir(),'分段 review '));
 const saved={plugin:'metaontic-agent-forge',toolName:'video_generate',plan:[{kind:'generate',seconds:15},{kind:'extend',seconds:15},{kind:'extend',seconds:15}],done:1,cursor:15,options:{},steps:[{index:1,kind:'generate',seconds:15,taskId:'task-1',videoUrl:'https://mock.invalid/1.mp4'}]};
 const record=path.join(dir,'paused-plan.json');const save=()=>writeFile(record,JSON.stringify(saved));await save();
 const exec={callId:'review',agent:{session:{id:'test-session',header:{cwd:dir}}}};
 let asks=0,choice='效果可以，继续下一段',during=null;
 const ctx={get:()=>({ask:async()=>{asks++;await during?.();return choice?{answers:[{id:'segment_result_review',selected:[choice]}]}:{answers:[]};}})};
 const review=api.createSegmentReview(ctx);const file=path.join(dir,'01-generate.mp4');await writeFile(file,'video');
 const show=(target=file)=>review.observe(exec.agent.session,{type:'assistant/message',data:{message:{content:[{type:'text',text:`[观看本段](<${target}>)`}]}}});
 try{await run({dir,saved,exec,review,ctx,show,save,file,get asks(){return asks;},set choice(v){choice=v;},set during(v){during=v;}});}finally{await rm(dir,{recursive:true,force:true});}
}
test('结果必须先正文展示再弹窗，审核成功持久化且重复调用不重复问',()=>fixture(async h=>{
 await assert.rejects(api.assertSegmentReviewed(h.exec,{resume:h.dir}),/结果审核/);
 assert.equal((await h.review.review({resume:h.dir},h.exec)).status,'blocked');assert.equal(h.asks,0);
 h.show();assert.equal((await h.review.review({resume:h.dir},h.exec)).status,'approved');assert.equal(h.asks,1);
 await api.assertSegmentReviewed(h.exec,{resume:h.dir});
 const reloaded=api.createSegmentReview(h.ctx);assert.equal((await reloaded.review({resume:h.dir},h.exec)).reused,true);assert.equal(h.asks,1);
 const receipt=JSON.parse(await readFile(path.join(h.dir,'segment-review.json'),'utf8'));assert.equal(receipt.key,'1:task-1');
}));
for(const choice of [null,'先暂停，暂不继续'])test(`结果审核${choice}不放行下一段`,()=>fixture(async h=>{
 h.choice=choice;h.show();assert.equal((await h.review.review({resume:h.dir},h.exec)).status,'paused');
 await assert.rejects(api.assertSegmentReviewed(h.exec,{resume:h.dir}),/结果审核/);
}));
test('下一段不能复用上一段审核；旧进度和generate/extend均受保护',()=>fixture(async h=>{
 h.show();await h.review.review({resume:h.dir},h.exec);
 h.saved.done=2;h.saved.cursor=30;h.saved.steps.push({index:2,kind:'extend',seconds:15,taskId:'task-2',videoUrl:'https://mock.invalid/2.mp4'});await h.save();
 for(const name of ['video_generate','video_extend'])await assert.rejects(api.assertSegmentReviewed({...h.exec,name},{resume:h.dir}),/结果审核/);
 assert.equal((await h.review.review({resume:h.dir},h.exec)).status,'blocked');
 h.show('https://mock.invalid/2.mp4');assert.equal((await h.review.review({resume:h.dir},h.exec)).status,'approved');assert.equal(h.asks,2);
}));
test('原任务查询、下载恢复及累计预览不新增任务，不强加结果确认',()=>fixture(async h=>{
 h.saved.pendingTask={taskId:'pending'};await h.save();await api.assertSegmentReviewed(h.exec,{resume:h.dir});
 h.saved.pendingTask=null;h.saved.deliveryPending=true;await h.save();await api.assertSegmentReviewed(h.exec,{resume:h.dir});
 h.saved.deliveryPending=false;await h.save();await api.assertSegmentReviewed(h.exec,{resume:h.dir,cumulativePreview:true});assert.equal(h.asks,0);
}));
test('审核等待期间进度变化不授予新一段权限',()=>fixture(async h=>{
 h.show();h.during=async()=>{h.saved.done=2;h.saved.steps.push({index:2,kind:'extend',taskId:'task-2',videoUrl:'https://mock.invalid/2.mp4'});await h.save();};
 await assert.rejects(h.review.review({resume:h.dir},h.exec),/进度已改变/);
 await assert.rejects(api.assertSegmentReviewed(h.exec,{resume:h.dir}),/结果审核/);
}));
