import {sourceOf} from './source.mjs';
import assert from 'node:assert/strict';
import {test,after} from 'node:test';
import vm from 'node:vm';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {mkdir,readFile,writeFile,rename,rm,mkdtemp} from 'node:fs/promises';
import os from 'node:os';
const home=await mkdtemp(path.join(os.tmpdir(),'meta-character-choice-'));after(()=>rm(home,{recursive:true,force:true}));
let next=0;
function setup(label='直接文生视频'){
 let asks=0;const id='session-'+(++next);
 const c=vm.createContext({createHash,path,mkdir,readFile,writeFile,rename,rm,dshHome:()=>home,isVolcengine:config=>config.connectionMode==='volcengine',timedStage:async(_stage,op)=>op()});
 vm.runInContext(sourceOf('workflow/character-choice'),c);
 const ctx={get:()=>({ask:async request=>{asks++;return {answers:[{id:request.questions[0].id,selected:label?[label]:[]}]};}})};
 const exec={name:'video_generate',callId:'call-'+id,agent:{session:{id}},arguments:{}};
 return {c,ctx,exec,get asks(){return asks;},args:{prompt:'人物介绍',duration:30,resolution:'480p',ratio:'16:9'}};
}
test('new text-only video must ask, explicit text choice permits the normal payment gate',async()=>{
 const h=setup();assert.equal(await h.c.characterChoiceGate(h.ctx,{},h.exec,h.args),null);assert.equal(h.asks,1);
});
test('choose character image prevents video submit and returns a durable image preparation instruction',async()=>{
 const h=setup('先生成角色图（单独计费）');
 const result=await h.c.characterChoiceGate(h.ctx,{},h.exec,h.args);assert.equal(result.kind,'deny');assert.match(result.reason,/video_prepare_image/);
 const again=await h.c.characterChoiceGate(h.ctx,{},h.exec,h.args);assert.equal(again.kind,'deny');assert.equal(h.asks,1);
});
test('text-only decision persists across guard reload but never carries over to another project',async()=>{
 const h=setup();await h.c.characterChoiceGate(h.ctx,{},h.exec,h.args);
 const fresh=setup();fresh.exec.agent.session.id=h.exec.agent.session.id;
 assert.equal(await fresh.c.characterChoiceGate(fresh.ctx,{},fresh.exec,h.args),null);assert.equal(fresh.asks,0);
 await fresh.c.characterChoiceGate(fresh.ctx,{},fresh.exec,{...h.args,prompt:'另一个项目'});assert.equal(fresh.asks,1);
});
test('existing images, continuation and already submitted resume never ask or restart tasks',async()=>{
 const h=setup();
 for(const args of [{resume:'/existing'},{referenceImages:['https://image.invalid/one.png']},{firstFrameUrl:'https://image.invalid/one.png'},{characterReferenceImages:['https://image.invalid/one.png']}])assert.equal(await h.c.characterChoiceGate(h.ctx,{},h.exec,args),null);
 assert.equal(await h.c.characterChoiceGate(h.ctx,{}, {...h.exec,name:'video_extend'},h.args),null);assert.equal(h.asks,0);
});
for(const mode of ['empty','custom','unavailable','aborted'])test(`unresolved ${mode} response stops before video submission`,async()=>{
 const h=setup(mode==='custom'?'随便':'');
 if(mode==='unavailable')h.ctx.get=()=>({});
 if(mode==='aborted')h.ctx.get=()=>({ask:async()=>{throw Error('aborted');}});
 assert.equal((await h.c.characterChoiceGate(h.ctx,{},h.exec,h.args)).kind,'deny');
});
test('Volcano mode offers an honest upload option and stops text submission when selected',async()=>{
 const h=setup('使用我提供的角色图');const result=await h.c.characterChoiceGate(h.ctx,{connectionMode:'volcengine'},h.exec,h.args);
 assert.equal(result.kind,'deny');assert.match(result.reason,/用户提供的角色图/);
});
test('missing live session never silently assumes text-only consent',async()=>{
 const h=setup();assert.equal((await h.c.characterChoiceGate(h.ctx,{}, {...h.exec,agent:{}},h.args)).kind,'deny');assert.equal(h.asks,0);
});

test('a changed plan can reopen the choice without silently overriding previous consent',async()=>{
 const h=setup('先生成角色图（单独计费）');await h.c.characterChoiceGate(h.ctx,{},h.exec,h.args);
 h.ctx.get=()=>({ask:async request=>({answers:[{id:request.questions[0].id,selected:['直接文生视频']}]})});
 assert.equal(await h.c.characterChoiceGate(h.ctx,{},h.exec,{...h.args,resetCharacterChoice:true}),null);
 assert.equal(await h.c.characterChoiceGate(h.ctx,{},h.exec,h.args),null);
});
