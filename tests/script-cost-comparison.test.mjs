import './no-network-analytics.mjs';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { apply } from '../index.js';
function setup(config) {
 const tools = new Map(); let prompt;
 apply({tools:{register(t){tools.set(t.name,t);return ()=>{};}},inject(names,fn){if(names.includes('systemPrompt'))return fn({systemPrompt:{section(v){prompt=v;return ()=>{};}}});},on(){return ()=>{};}},config);
 return {tool:tools.get('video_estimate'),prompt:()=>prompt.text({agent:{session:{header:{agentPreset:'forge-video-director'}}}})};
}
const base={connectionMode:'metaontic',model:'doubao-seedance-2-0-fast-260128'};
const args={duration:30,resolution:'720p',ratio:'16:9'};
test('script estimate is read-only and includes reference input for 30s continuation',async()=>{
 const {tool}=setup(base);const original=globalThis.fetch;globalThis.fetch=()=>{throw Error('must not call network');};
 try {
  const r=await tool.execute({...args,groupRatio:.8});
  assert.equal(r.official.cny,45.36);assert.equal(r.plugin.cny,20.9952);
  assert.deepEqual(r.plugin.segments.map(x=>[x.seconds,x.inputSeconds]),[[15,0],[15,15]]);
  assert.equal(r.plugin.segments[1].tokens,648000);
  assert.match(tool.output.render(args,r)[0].text,/火山官方方案：约¥45.36/);
  assert.match(tool.output.render(args,r)[0].text,/插件方案：约¥21.00/);
  assert.equal(r.currency,'CNY');
 }finally{globalThis.fetch=original;}
});
test('manual keys have no assumed discount; service and direct retain their own rates',async()=>{
 const manual=await setup({...base,estimateGroupRatio:.8}).tool.execute(args);
 assert.equal(manual.plugin.groupRatio,1);assert.equal(manual.plugin.cny,26.244);
 const service=await setup({...base,connectionMode:'service'}).tool.execute(args);
 assert.equal(service.plugin.groupRatio,.8);
 const direct=setup({...base,connectionMode:'volcengine'}).tool;
 assert.equal((await direct.execute(args)).plugin.groupRatio,1);
 await assert.rejects(()=>direct.execute({...args,groupRatio:.8}),/不适用/);
});
test('mini and 480P use their own rates and model dimensions, portrait preserves cost',async()=>{
 const tool=setup({...base,model:'doubao-seedance-2-0-mini-260615'}).tool;
 const a=await tool.execute({...args,groupRatio:.8});assert.equal(a.plugin.cny,13.2192);
 const b=await tool.execute({...args,resolution:'480p',groupRatio:.8});
 assert.deepEqual(b.plugin.dimensions,[864,496]);assert.deepEqual(b.official.dimensions,[854,480]);
 assert.ok(b.plugin.cny<a.plugin.cny);
 const c=await tool.execute({...args,resolution:'480p',ratio:'9:16',groupRatio:.8});assert.equal(c.plugin.cny,b.plugin.cny);
});
test('plans match minimum-duration tails, custom segments, and previous segment instead of cumulative input',async()=>{
 const tool=setup(base).tool;
 const a=await tool.execute({...args,duration:16});assert.deepEqual(a.plugin.segments.map(x=>x.seconds),[12,4]);
 const b=await tool.execute({...args,duration:40,segmentSeconds:10});
 assert.deepEqual(b.plugin.segments.map(x=>[x.seconds,x.inputSeconds]),[[15,0],[9,15],[8,9],[8,8]]);
 // 火山官方参照按 Seedance 2.5 的实际秒数排段：单段上限30秒，尾段不凑整
 assert.deepEqual(b.official.segments.map(x=>[x.seconds,x.inputSeconds]),[[30,0],[10,30]]);
 const d45=await tool.execute({...args,duration:45});
 assert.deepEqual(d45.official.segments.map(x=>[x.kind,x.seconds,x.inputSeconds]),[['generate',30,0],['extend',15,30]]);
 assert.equal(d45.official.cny,86.184);
 assert.deepEqual(d45.plugin.segments.map(x=>x.seconds),[15,15,15]);
 const c=await tool.execute({...args,duration:15});assert.equal(c.official.model,'doubao-seedance-2-5');assert.equal(c.plugin.segments.length,1);
 // 15秒如实按15秒计（22.68），30秒是一次2.5直出（45.36），都不是两段30秒
 assert.deepEqual(c.official.segments.map(x=>[x.seconds,x.inputSeconds]),[[15,0]]);assert.equal(c.official.cny,22.68);
 const c30=await tool.execute({...args,duration:30});assert.deepEqual(c30.official.segments.map(x=>[x.seconds,x.inputSeconds]),[[30,0]]);
 assert.equal(c30.official.cny,45.36);
});
test('unknown models, unsupported ratios and unresolved resolution fail rather than invent prices',async()=>{
 const tool=setup(base).tool;
 for(const bad of [{...args,resolution:undefined},{...args,ratio:'1:1'},{...args,duration:121},{...args,duration:5.5},{...args,groupRatio:NaN}])await assert.rejects(()=>tool.execute(bad));
 await assert.rejects(()=>setup({...base,model:'unknown'}).tool.execute(args),/可靠价目/);
});
test('all connection modes instruct the assistant to estimate while writing the script',()=>{
 for(const connectionMode of ['service','metaontic','volcengine']) {
  const h=setup({...base,connectionMode});assert.ok(h.tool);assert.match(h.prompt(),/写脚本时就一并调用只读video_estimate/);
  assert.match(h.prompt(),/最低用量补足未计入/);
  // 画幅不再默认 9:16：没写明时必须问用户，和清晰度一起确认
  assert.match(h.prompt(),/画幅和清晰度都必须由用户明确选择或确认/);
  assert.match(h.prompt(),/16:9 横屏 \/ 9:16 竖屏/);
  assert.doesNotMatch(h.prompt(),/默认15秒、9:16/);
 }
});

test('60s breakdown labels first segment without video and all continuations with video input',async()=>{
 const tool=setup({...base,model:'doubao-seedance-2-0-mini-260615'}).tool;
 const result=await tool.execute({...args,duration:60});
 assert.deepEqual(result.plugin.segments.map(s=>[s.billingMode,s.inputSeconds,s.rateCnyPerMillion]),[
 ['without_video_input',0,23],['with_video_input',15,14],['with_video_input',15,14],['with_video_input',15,14]]);
 const text=tool.output.render({},result)[0].text;
 assert.match(text,/插件第1段：无视频输入；输入0秒 \+ 输出15秒/);
 assert.match(text,/插件第2段：有视频输入；输入15秒 \+ 输出15秒/);
});

test('Seedance 2.5 30s official base estimate matches current published 480P/720P tariffs without splitting',async()=>{
 const tool=setup(base).tool;
 for(const [resolution,tokens,expected] of [['480p',288225,20.1758],['720p',648000,45.36]]){
  const result=await tool.execute({...args,duration:30,resolution});
  assert.equal(result.official.segments.length,1);
  assert.equal(result.official.segments[0].inputSeconds,0);
  assert.equal(result.official.segments[0].tokens,tokens);
  assert.equal(result.official.segments[0].rateCnyPerMillion,70);
  assert.equal(result.official.cny,expected);
 }
});
