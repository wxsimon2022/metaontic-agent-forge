import {resolve} from 'node:path';
import {sourceOf} from './source.mjs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {test} from 'node:test';
const ctx=vm.createContext({resolve,formatSeconds:n=>n});
vm.runInContext(sourceOf('tools/results')+'\nObject.assign(globalThis,{deliveryInstruction,renderResult,renderVideoResult});',ctx);
const segments=[1,2].map(index=>({index,seconds:15,kind:index===1?'direct':'extend',status:'succeeded',taskId:'task-'+index,localPath:`/out/part-${index}.mp4`,videoUrl:`https://media.invalid/${index}.mp4`}));
for(const name of ['renderResult','renderVideoResult'])test(`${name}: delivers both parts and the final merged video`,()=>{
 const text=ctx[name]({status:'succeeded',mode:'extended',segments,merged:true,videoPath:'/out/final.mp4'}).map(x=>x.text).join('\n');
 assert.match(text,/第一段：\/out\/part-1.mp4/);assert.match(text,/第二段：\/out\/part-2.mp4/);assert.match(text,/合并后完整视频：\/out\/final.mp4/);
 assert.match(text,/先展示合并成片，再按段号依次展示各分段/);
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
 const text=ctx.deliveryInstruction({status:'succeeded',plannedSeconds:30,segments:[{...segments[0],seconds:30}],merged:true,videoPath:'/out/direct.mp4'});
 assert.match(text,/\[观看视频\]\(<\/out\/direct.mp4>\)/);
 assert.doesNotMatch(text,/第二段|合并后完整视频/);
});

test('single video always includes a clickable absolute path even when present exists',()=>{
 const text=ctx.deliveryInstruction({status:'succeeded',segments:[{...segments[0],localPath:'my videos/01.mp4'}]});
 assert.ok(text.includes(`[观看视频](<${resolve('my videos/01.mp4')}>)`));
 assert.match(text,/present成功也不能省略正文链接/);
});
test('remote-only delivery uses the actual playback URL',()=>{
 const text=ctx.deliveryInstruction({status:'succeeded',videoUrl:'https://media.invalid/one.mp4'});
 assert.ok(text.includes('[观看视频](<https://media.invalid/one.mp4>)'));
});

for(const name of ['renderResult','renderVideoResult']) test(`${name}: reference review links every converted image without advancing generation`,()=>{
 const text=ctx[name]({status:'review_required',resumeDir:'/pause',convertedReferences:[{role:'first_frame',imageUrl:'https://media.invalid/a.png'},{role:'last_frame',imageUrl:'https://media.invalid/b.png'}]}).map(x=>x.text).join('\n');
 assert.ok(text.includes('[打开图片1](<https://media.invalid/a.png>)'));
 assert.ok(text.includes('[打开图片2](<https://media.invalid/b.png>)'));
 assert.match(text,/明确同意后/); assert.match(text,/尚未重试视频/);
});
for(const status of ['timeout','unknown','failed','cancelled']) test(`partial ${status} keeps clickable completed segments only`,()=>{
 const text=ctx.renderResult({status,segments:[segments[0],{index:2,status:'unknown',taskId:'pending'}]}).map(x=>x.text).join('\n');
 assert.ok(text.includes('[第一段](</out/part-1.mp4>)'));
 assert.ok(!text.includes('[第二段]')); assert.ok(!text.includes('](<undefined>)'));
});
test('status query and standalone image processing provide actual Markdown links',()=>{
 const tools=vm.createContext({resolve,formatSeconds:n=>n});
 vm.runInContext(sourceOf('tools/results','tools/video-status','tools/video-prepare-image'),tools);
 const status=tools.taskTool({}).output.render({}, {status:'succeeded',taskId:'existing',videoUrl:'https://media.invalid/done.mp4'})[0].text;
 assert.ok(status.includes('[观看视频](<https://media.invalid/done.mp4>)'));
 const image=tools.prepareImageTool({}).output.render({}, {imageUrl:'https://media.invalid/image.png',model:'seedream'})[0].text;
 assert.ok(image.includes('[打开参考图](<https://media.invalid/image.png>)'));
 assert.match(image,/明确确认后/);
 assert.ok(!tools.taskTool({}).output.render({}, {status:'unknown',taskId:'pending'})[0].text.includes('[观看视频]'));
});

test('merged video is listed before all individual segments',()=>{
 const text=ctx.deliveryInstruction({status:'succeeded',segments,merged:true,videoPath:'/out/final.mp4'});
 assert.ok(text.indexOf('[打开合并视频]') < text.indexOf('[第一段]'));
 assert.ok(text.indexOf('[第一段]') < text.indexOf('[第二段]'));
});
