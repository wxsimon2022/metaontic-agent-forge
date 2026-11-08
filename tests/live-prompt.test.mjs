import './no-network-analytics.mjs';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {mkdtemp,rm} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import * as plugin from '../index.js';

test('an existing prompt registration reads current configuration on each request', async () => {
 const dir=await mkdtemp(path.join(os.tmpdir(),'meta-prompt-'));const prior=process.env.DSH_HOME;
 process.env.DSH_HOME=dir;
 let section;let dispose;
 try {
  const config={model:'seedance-2-0-mini'};
  dispose=plugin.apply({tools:{register:()=>()=>{}},on:()=>()=>{},inject(names,install){
   if(names.includes('systemPrompt'))return install({systemPrompt:{section(value){section=value;return()=>{};}}});
  }},config);
  const director={agent:{session:{header:{agentPreset:'forge-video-director'}}}};
  assert.equal(typeof section.text,'function');
  assert.match(section.text(director),/总时长 ≤ 15 秒/);
  const prompt=section.text(director);
  assert.match(prompt,/完善创意的同一轮用ask_user_question合并询问所有缺失信息/);
  assert.match(prompt,/等用户回答后才调用video_project/);
  assert.match(prompt,/15秒、30秒、45秒、60秒和“自定义时长”/);
  assert.doesNotMatch(prompt,/需求阶段先调用video_project|用video_project\(action:prepare\)省略duration/);
  assert.match(prompt,/禁止省略已确认值导致工具重复提问/);
  assert.match(prompt,/无论创意是否完整/);
  assert.match(prompt,/用户创意原文已写明时长、横竖屏或分辨率时，直接记录对应值/);
  assert.match(prompt,/这三项都不出现在提问中/);
  assert.doesNotMatch(prompt,/地址、时长等/);
  assert.match(prompt,/不得借完善另起创意/);
  assert.doesNotMatch(prompt,/完整方案不增加完善询问|不完善且尚未授权时/);
  assert.equal(section.text({}),'');
  assert.equal(section.text({agent:{session:{header:{agentPreset:null}}}}),'');
  config.model='seedance-2.5';assert.match(section.text(director),/总时长 ≤ 30 秒/);
 }finally{dispose?.();if(prior===undefined)delete process.env.DSH_HOME;else process.env.DSH_HOME=prior;await rm(dir,{recursive:true,force:true});}
});

test('promotional mode adds its brief while standard and general video modes remain scoped', async()=>{
 let section;let selected='forge-promo-video';
 const ctx={tools:{register:()=>()=>{}},on:()=>()=>{},get(name){return name==='agentPresets'?{presetForSession:()=>selected}:undefined;},inject(names,install){if(names.includes('systemPrompt'))return install({systemPrompt:{section(v){section=v;return()=>{};}}});}};
 const dispose=plugin.apply(ctx,{connectionMode:'metaontic'});
 const request={agent:{session:{header:{agentPreset:'forge-video-director'}}}};
 try{
  const promo=section.text(request);
  assert.match(promo,/当前模式：宣传视频助手/);
  assert.match(promo,/不得编造价格、优惠、销量/);
  assert.match(promo,/用户原话或本轮答复已确认时/);
  assert.match(promo,/video_project/);
  selected='forge-video-director';assert.doesNotMatch(section.text(request),/当前模式：宣传视频助手/);
  selected=null;assert.equal(section.text(request),'');
  selected='unknown';assert.equal(section.text(request),'');
 }finally{dispose();}
});
