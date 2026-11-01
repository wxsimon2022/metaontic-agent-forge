import {sourceOf} from './source.mjs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {test} from 'node:test';
const ctx=vm.createContext({formatSeconds:n=>n});
vm.runInContext(sourceOf('tools/results')+'\nObject.assign(globalThis,{deliveryInstruction,renderResult,renderVideoResult});',ctx);
const segments=[1,2].map(index=>({index,seconds:15,kind:index===1?'direct':'extend',status:'succeeded',taskId:'task-'+index,localPath:`/out/part-${index}.mp4`,videoUrl:`https://media.invalid/${index}.mp4`}));
for(const name of ['renderResult','renderVideoResult'])test(`${name}: delivers both parts and the final merged video`,()=>{
 const text=ctx[name]({status:'succeeded',mode:'extended',segments,merged:true,videoPath:'/out/final.mp4'}).map(x=>x.text).join('\n');
 assert.match(text,/第一段：\/out\/part-1.mp4/);assert.match(text,/第二段：\/out\/part-2.mp4/);assert.match(text,/合并后完整视频：\/out\/final.mp4/);
 assert.match(text,/逐项展示/);
});
test('paused first part is delivered without inventing a second part or merged full video',()=>{
 const text=ctx.deliveryInstruction({status:'succeeded',paused:true,remainingSeconds:15,segments:segments.slice(0,1),merged:true,videoPath:segments[0].localPath});
 assert.match(text,/第一段/);assert.doesNotMatch(text,/第二段|合并后完整视频/);
});
test('merge failure preserves all segments and does not label the last upstream url as final',()=>{
 const text=ctx.deliveryInstruction({status:'succeeded',segments,merged:false,videoUrl:segments[1].videoUrl,deliveryError:'failed'});
 assert.match(text,/第二段/);assert.match(text,/合并结果尚未交付/);assert.doesNotMatch(text,/合并后完整视频：/);
});
test('single direct 30s video does not invent split files',()=>{
 assert.equal(ctx.deliveryInstruction({status:'succeeded',plannedSeconds:30,segments:[{...segments[0],seconds:30}],merged:true,videoPath:'/out/direct.mp4'}),'');
});
