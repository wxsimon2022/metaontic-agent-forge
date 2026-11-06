import {sourceOf} from './source.mjs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {test} from 'node:test';
const ctx=vm.createContext({FORWARD_TRANSITION:'FORWARD_DEFAULT',CLOSEUP_TRANSITION:'CLOSEUP_DEFAULT',CONTINUOUS_TRANSITION:'CONTINUOUS_DEFAULT',isOmniExtendModel:()=>false});
vm.runInContext(sourceOf('prompts/generation')+'\nObject.assign(globalThis,{buildExtensionPrompt});',ctx);
const args={prompt:'镜头1：女子抬眼，平静地说{我知道了。}',seconds:15,startAt:15,mode:'continuous'};
test('default continuation adds a real transition block while retaining continuous framing',()=>{
 const text=ctx.buildExtensionPrompt(args);
 assert.match(text,/^向后延长视频1/);assert.match(text,/【过渡画面】/);assert.match(text,/CONTINUOUS_DEFAULT/);
 assert.match(text,/不重复上一段动作或台词/);assert.doesNotMatch(text,/参考\s*视频\s*1/);
 assert.ok(text.includes(args.prompt));
});
test('reviewed transition permits an intended cut without conflicting same-frame constraints',()=>{
 const transition='承接男子放下茶杯的动作，切到女子近景，女子抬头回应，室内环境声连续。';
 const text=ctx.buildExtensionPrompt({...args,transitionDescription:transition});
 assert.ok(text.includes('【过渡画面】'+transition));assert.doesNotMatch(text,/CONTINUOUS_DEFAULT|CLOSEUP_DEFAULT/);
 assert.match(text,/明确切镜时允许改变景别与机位/);assert.match(text,/我知道了/);
 assert.doesNotMatch(text,/机位、景别、焦段、运镜方向与速度/);
});
test('per-segment transition takes precedence, stays separate from new plot and does not repeat',()=>{
 const transition='承接上一段点头动作，切到男子中景，延续背景配乐。';
 const text=ctx.buildExtensionPrompt({...args,prompt:args.prompt+'\n【过渡画面】'+transition,transitionDescription:'unused global fallback'});
 assert.equal(text.split(transition).length-1,1);assert.equal(text.split('【过渡画面】').length-1,1);
 assert.doesNotMatch(text,/unused global fallback/);assert.ok(text.includes(args.prompt));
});
test('forward continuation describes its ending into video1 and retains forward direction',()=>{
 const text=ctx.buildExtensionPrompt({...args,direction:'forward'});
 assert.match(text,/^向前延长视频1/);assert.match(text,/本段末尾/);assert.match(text,/FORWARD_DEFAULT/);
 assert.doesNotMatch(text,/参考\s*视频\s*1/);
});
test('closeup fallback describes a deliberate cut without demanding identical framing',()=>{
 const text=ctx.buildExtensionPrompt({...args,mode:'closeup'});
 assert.match(text,/在完整对白或动作结束后/);assert.match(text,/CLOSEUP_DEFAULT/);
 assert.doesNotMatch(text,/机位、景别、焦段、运镜方向与速度/);
});
test('non-text transition descriptions are refused before any request',()=>{
 assert.throws(()=>ctx.buildExtensionPrompt({...args,transitionDescription:{invalid:true}}),/过渡描述必须是文字/);
});
test('settings no longer provide a global continuation mode control',()=>{
 const settings=vm.createContext({});vm.runInContext(sourceOf('connection-defaults','client/config')+'\nObject.assign(globalThis,createClientConfig());',settings);
 assert.equal(settings.SELECTS.mode,undefined);assert.equal(settings.FIELD_BY_KEY.mode,undefined);
 assert.equal(settings.SECTIONS.some(s=>s.fields.includes('mode')),false);
});

test('Volcano Engine direct is hidden from the connection list while existing configs keep working',()=>{
 const settings=vm.createContext({});vm.runInContext(sourceOf('connection-defaults','client/config')+'\nObject.assign(globalThis,createClientConfig());',settings);
 assert.equal(Array.from(settings.SELECTS.connectionMode).join(','),'metaontic,service');
 // 隐藏只在设置页：默认值、旧配置校验与运行端都不受影响的取值仍在 schema 里。
 assert.equal(settings.FIELD_BY_KEY.volcengineApiKey.kind,'text');
});
