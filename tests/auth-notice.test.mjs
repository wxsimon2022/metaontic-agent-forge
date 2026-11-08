import assert from 'node:assert/strict';
import {test} from 'node:test';
import {api} from './module-test-api.mjs';
const h=(type,props,...children)=>({type,props,children});
test('chat AUTH uses actionable copy while all other failures retain the host renderer',()=>{
 const Original=()=>{};const hostT=()=>{};
 const Notice=api.createAuthNotice({h,Original,hostT,t:key=>({authNoticeTitle:'服务连接验证未通过',authNoticeHint:'请到 Harness 的模型设置检查当前 API密钥和中转地址',supportContact:'客服'}[key])});
 const rendered=Notice({node:{data:{code:'AUTH',message:'API 密钥无效'}}});
 const json=JSON.stringify(rendered);assert.match(json,/服务连接验证未通过/);assert.match(json,/Harness 的模型设置/);assert.doesNotMatch(json,/API 密钥无效/);
 for(const code of ['QUOTA','ACCOUNT_SIGNED_OUT','INTERRUPTED',undefined]){
  const node={data:{code,message:'host detail'}};const delegated=Notice({node,extra:1});
  assert.equal(delegated.type,Original);assert.equal(delegated.props.node,node);assert.equal(delegated.props.t,hostT);assert.equal(delegated.props.extra,1);
 }
});
test('authentication slot is reversible and missing host capabilities do not break the plugin',()=>{
 assert.equal(api.registerAuthNotice({slots:{}},h,()=>{}),undefined);
 let options,view;const dispose=()=>{};const Original=()=>{};
 const ctx={locale:{bind:()=>()=>{}},slots:{entriesOfSlot:()=>[{options:{key:'turn-error',priority:0},component:Original,locale:'chat'}],register:(o,v)=>{options=o;view=v;return dispose;}}};
 assert.equal(api.registerAuthNotice(ctx,h,()=>{}),dispose);assert.equal(options.key,'turn-error');assert.equal(options.priority,1);assert.equal(typeof view,'function');
});
test('HTTP 401 and 403 remain auth failures with friendly video-settings guidance, regardless of upstream wording',()=>{
 for(const status of [401,403]){
  const r=api.classifyError(status,{error:{message:'invalid API key quota_exceeded'}});
  assert.equal(r.code,'provider_auth');assert.match(r.message,new RegExp(String(status)));assert.match(r.message,/插件设置/);assert.match(r.message,/客服/);assert.doesNotMatch(r.message,/invalid API key|quota_exceeded/);
 }
});
