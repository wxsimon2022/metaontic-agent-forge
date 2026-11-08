import {sourceOf} from './source.mjs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {randomUUID} from 'node:crypto';
import {performance} from 'node:perf_hooks';

function harness(){
 const logs=[];
 const ctx=vm.createContext({randomUUID,performance,Buffer,appendRequestLog:async record=>logs.push(record)});
 vm.runInContext(sourceOf('businesses/video/tools/video-stage','businesses/video/workflow/script-tracking'),ctx);
 return {ctx,logs};
}
const session={header:{cwd:'/tmp/project'}};
const call=(name,arguments_)=>session.header.cwd&&{type:'tool/call',data:{turn:1,name,arguments:JSON.stringify(arguments_)}};

test('saving script.md closes the script design span and logs one save event',async()=>{
 const {ctx,logs}=harness();const tool=ctx.stageTool();const tracker=ctx.createScriptTracker();
 const started=await tool.execute({action:'start',stage:'script_design'});
 await tracker.observe(session,call('write',{file_path:'/tmp/project/script.md',content:'---\n版本: 第 1 版\n---\n完整脚本正文'}));
 const finished=logs.find(x=>x.event==='stage_finished');
 assert.equal(finished.spanId,started.spanId);assert.equal(finished.source,'script_saved');assert.ok(finished.elapsedMs>=0);
 const saved=logs.filter(x=>x.event==='script_saved');assert.equal(saved.length,1);
 assert.equal(saved[0].path,'/tmp/project/script.md');assert.equal(saved[0].mode,'create');
 assert.equal(saved[0].version,'第1版');assert.equal(saved[0].closedSpanId,started.spanId);
 assert.ok(saved[0].characters>0&&saved[0].bytes>=saved[0].characters);
 assert.equal((await tool.execute({action:'finish',stage:'script_design',spanId:started.spanId})).status,'unavailable');
});

test('only script files written by write tools reach the tracker',async()=>{
 const {ctx,logs}=harness();const tracker=ctx.createScriptTracker();
 await tracker.observe(session,call('write',{file_path:'/tmp/project/make_storyboard.py',content:'print(1)'}));
 await tracker.observe(session,call('read',{file_path:'/tmp/project/script.md'}));
 await tracker.observe(session,call('write',{file_path:'/tmp/project/storyboard.png',content:'x'}));
 assert.deepEqual(logs,[]);
});

test('rewriting the script on Windows paths completes the same span instead of duplicating it',async()=>{
 const {ctx,logs}=harness();const tool=ctx.stageTool();const tracker=ctx.createScriptTracker();
 const started=await tool.execute({action:'start',stage:'script_design'});
 await tracker.observe(session,call('edit',{file_path:'C:\\work\\video\\script.md',old_string:'a',new_string:'b'}));
 const saved=logs.filter(x=>x.event==='script_saved');
 assert.equal(saved.length,1);assert.equal(saved[0].mode,'update');assert.equal(saved[0].version,undefined);
 assert.equal(logs.filter(x=>x.event==='stage_finished').length,1);
 assert.equal(logs.find(x=>x.event==='stage_finished').spanId,started.spanId);
});

test('apply_patch bodies that touch script.md are recognised',async()=>{
 const {ctx,logs}=harness();const tool=ctx.stageTool();const tracker=ctx.createScriptTracker();
 await tool.execute({action:'start',stage:'script_design'});
 await tracker.observe(session,call('apply_patch',{patch:'*** Begin Patch\n*** Update File: /tmp/project/script.md\n@@\n-a\n+b\n*** End Patch'}));
 assert.equal(logs.filter(x=>x.event==='script_saved').length,1);
 assert.equal(logs.filter(x=>x.event==='stage_finished').length,1);
});

test('saves without an open marker and malformed events never throw',async()=>{
 const {ctx,logs}=harness();const tracker=ctx.createScriptTracker();
 await tracker.observe(session,call('write',{file_path:'/tmp/project/script.md',content:'草稿'}));
 await tracker.observe(session,{type:'tool/call',data:{name:'write',arguments:'{不是 JSON'}});
 await tracker.observe(session,{type:'assistant/message',data:{message:{content:[]}}});
 await tracker.observe(undefined,{type:'tool/call',data:{name:'write',arguments:'{}'}});
 assert.equal(logs.length,1);assert.equal(logs[0].event,'script_saved');assert.equal(logs[0].closedSpanId,undefined);
});

test('storyboard and review waits stay untouched by a script save',async()=>{
 const {ctx,logs}=harness();const tool=ctx.stageTool();const tracker=ctx.createScriptTracker();
 await tool.execute({action:'start',stage:'storyboard_design'});
 await tool.execute({action:'start',stage:'script_design'});
 await tracker.observe(session,call('write',{file_path:'/tmp/project/script.md',content:'v2'}));
 const closed=logs.find(x=>x.event==='stage_finished');
 assert.equal(logs.filter(x=>x.event==='stage_finished').length,1);
 assert.equal((await tool.execute({action:'finish',stage:'storyboard_design',spanId:closed.spanId})).status,'unavailable');
});
