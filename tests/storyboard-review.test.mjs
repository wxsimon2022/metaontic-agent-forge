import {sourceOf} from './source.mjs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {test,after} from 'node:test';
import path from 'node:path';
import {mkdtemp,writeFile,readdir,stat,rm,utimes} from 'node:fs/promises';
import os from 'node:os';
const dir=await mkdtemp(path.join(os.tmpdir(),'storyboard-review-'));
const image=path.join(dir,'storyboard v1.png');await writeFile(image,'fixture');after(()=>rm(dir,{recursive:true,force:true}));
function setup(logged=[]){
 const ctx=vm.createContext({path,readdir,stat,process,appendRequestLog:async entry=>{logged.push(entry);}});vm.runInContext(sourceOf('businesses/video/workflow/storyboard-review'),ctx);
 const guard=ctx.createStoryboardReviewGuard({log:async entry=>{logged.push(entry);}}),session={header:{cwd:dir}};
 const observe=(type,data)=>guard.observe(session,{type,data:{turn:1,...data}});
 const exec={name:'ask_user_question',agent:{session},arguments:{questions:[{id:'script_review_v1',question:'这版脚本可以吗？'}]}};
 observe('tool/call',{name:'metaontic_agent_forge_video_estimate'});
 const present=()=>observe('deliverables/presented',{files:[{path:image}]});
 const body=(text,type='text')=>observe('assistant/message',{message:{content:[{type,text}]}});
 return {guard,session,exec,observe,present,body,logged};
}
test('present success without inline body blocks review (actual incident sequence)',async()=>{
 const h=setup();h.present();h.body('分镜示意图已画好：8 个镜头与三段过渡都标在图上。');
 const decision=await h.guard.gate(h.exec);assert.equal(decision.kind,'deny');assert.match(decision.reason,/正文里内嵌展示/);
});
test('missing present blocks review even if image is mentioned in plain text',async()=>{
 const h=setup();h.body(image);assert.equal((await h.guard.gate(h.exec)).kind,'deny');
});
test('reasoning and tool image reads do not prove the user saw the image',async()=>{
 const h=setup();h.present();h.body(`![图](<${image}>)`,'reasoning');assert.equal((await h.guard.gate(h.exec)).kind,'deny');
});
test('present followed by actual visible inline Markdown allows review',async()=>{
 const h=setup();h.present();h.body(`![分镜](<${image}>)\n[打开原图](<${image}>)`);assert.equal(await h.guard.gate(h.exec),null);
});
test('改稿后只展示旧版分镜图会被拦下（同目录已有更新的图）',async()=>{
 const sub=await mkdtemp(path.join(os.tmpdir(),'storyboard-stale-'));
 const old=path.join(sub,'storyboard v1.png');await writeFile(old,'fixture');
 const newer=path.join(sub,'storyboard v2.png');await writeFile(newer,'fixture');
 const later=new Date(Date.now()+5000);await utimes(newer,later,later);
 const logged=[];
 const ctx=vm.createContext({path,readdir,stat,process,appendRequestLog:async entry=>{logged.push(entry);}});
 vm.runInContext(sourceOf('businesses/video/workflow/storyboard-review'),ctx);
 const guard=ctx.createStoryboardReviewGuard({log:async entry=>{logged.push(entry);}}),session={header:{cwd:sub}};
 const observe=(type,data)=>guard.observe(session,{type,data:{turn:1,...data}});
 observe('tool/call',{name:'metaontic_agent_forge_video_estimate'});
 observe('assistant/message',{message:{content:[{type:'text',text:`![分镜](<${old}>)`}]}});
 const exec={name:'ask_user_question',agent:{session},arguments:{questions:[{id:'script_review_v1',question:'这版脚本可以吗？'}]}};
 const decision=await guard.gate(exec);
 assert.equal(decision.kind,'deny');
 assert.match(decision.reason,/新版分镜图还没展示/);
 assert.ok(decision.reason.includes(newer));
 await rm(sub,{recursive:true,force:true});
});
test('old turns and other sessions cannot satisfy the current review',async()=>{
 const h=setup();h.present();h.body(`![图](<${image}>)`);
 h.observe('tool/call',{turn:2,name:'metaontic_agent_forge_video_estimate'});assert.equal((await h.guard.gate(h.exec)).kind,'deny');
 const another={...h.exec,agent:{session:{}}};assert.equal(await h.guard.gate(another),null);
});
test('ordinary questions and video production confirmation remain unaffected',async()=>{
 const h=setup();h.present();
 assert.equal(await h.guard.gate({...h.exec,arguments:{questions:[{question:'选择480P还是720P？'}]}}),null);
 assert.equal(await h.guard.gate({...h.exec,name:'metaontic_agent_forge_video_generate'}),null);
});

test('turn ending right after the script body is logged as a missing review ask',async()=>{
 const h=setup();h.present();h.body(`![分镜](<${image}>)`);
 h.observe('turn/end',{});
 assert.deepEqual(h.logged.map(entry=>entry.event),['storyboard_review_missing']);
});
test('review asked in the same turn is not reported missing',async()=>{
 const h=setup();h.present();h.body(`![分镜](<${image}>)`);
 assert.equal(await h.guard.gate(h.exec),null);
 h.observe('turn/end',{});
 assert.equal(h.logged.some(entry=>entry.event==='storyboard_review_missing'),false);
});
test('next turn without review ask is reported missing too',async()=>{
 const h=setup();h.body(`![分镜](<${image}>)`);
 h.observe('tool/call',{turn:2,name:'metaontic_agent_forge_video_estimate'});
 assert.deepEqual(h.logged.map(entry=>entry.event),['storyboard_review_missing']);
});
