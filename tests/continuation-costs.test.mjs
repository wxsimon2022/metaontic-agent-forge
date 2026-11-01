import {sourceOf} from './source.mjs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {test} from 'node:test';
const ctx=vm.createContext({
 ref:(c,k,f)=>c[k]??f, resolveModel:c=>c.model, resolveResolution:(_c,a)=>a?.resolution||'720p',
 ESTIMATE_PIXELS:{'720p':[1280,720]},FIXED_RESOLUTION:'720p',ESTIMATE_FPS:24,ESTIMATE_TOKEN_DIVISOR:1024,
 ESTIMATE_RATES:[['mini',{none:23/7.3,video:14/7.3}]],finiteNumber:x=>Number.isFinite(x)?x:null,
});
vm.runInContext(sourceOf('workflow/costs'),ctx);
const config={model:'mini',estimateGroupRatio:1};
test('approval includes input tokens and selects video rate only for continuations',()=>{
 const plan=[{kind:'generate',seconds:15},{kind:'extend',seconds:15},{kind:'extend',seconds:8}];
 const result=ctx.estimateUsage(config,'video_generate',{resolution:'720p',firstFrameUrl:'https://image.invalid/one.png'},plan);
 assert.deepEqual(Array.from(result.segments,s=>s.inputSeconds),[0,15,15]);
 assert.deepEqual(Array.from(result.segments,s=>s.tokens),[324000,648000,496800]);
 assert.deepEqual(Array.from(result.segments,s=>s.usesReference),[false,true,true]);
 assert.equal(result.segments[0].usd,324000*(23/7.3)/1e6);
});
test('resumed first remaining step uses previous completed video duration',()=>{
 const result=ctx.estimateUsage(config,'video_generate',{inputVideoSeconds:12},[{kind:'extend',seconds:4}]);
 assert.equal(result.segments[0].tokens,21600*16);
 assert.equal(result.segments[0].inputSeconds,12);
});
test('external continuation with unknown input duration does not invent a cheap estimate',()=>{
 assert.throws(()=>ctx.estimateUsage(config,'video_extend',{},[{kind:'extend',seconds:15}]),/缺少实际输入视频时长/);
});
