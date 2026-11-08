import { sourceOf } from './source.mjs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {validateRelease} from '../scripts/validate-release.mjs';
function setup(releases) {
  const ctx = vm.createContext({
    __PLUGIN_VERSION__:'3.9.0', h:()=>null, AbortController,
    window:{setTimeout, clearTimeout},
    fetch:async()=>({ok:true,json:async()=>releases}),
  });
  vm.runInContext(sourceOf('client/updates')+'\nObject.assign(globalThis,createUpdates({h}));',ctx);
  return ctx;
}
test('release channels filter draft and flagged prereleases; numeric beta ordering and stable promotion', async()=>{
 const ctx=setup([{tag_name:'v3.10.0-beta.2',prerelease:true},{tag_name:'v3.10.0-beta.10',prerelease:true},
 {tag_name:'v3.9.1',prerelease:false},{tag_name:'v3.11.0',prerelease:true},{tag_name:'v5.0.0',draft:true}]);
 assert.equal(await ctx.fetchLatestVersion('stable'),'3.9.1');
 assert.equal(await ctx.fetchLatestVersion('prerelease'),'3.9.1'); // legacy preference cannot enable prereleases
 assert.equal(ctx.isNewerVersion('3.10.0-beta.10','3.10.0-beta.2'),true);
 assert.equal(ctx.isNewerVersion('3.10.0','3.10.0-beta.10'),true);
 assert.equal(ctx.isNewerVersion('3.10.0-beta.10','3.10.0'),false);
 assert.equal(ctx.isNewerVersion('bad3.10.0','3.9.0'),false);
});
test('stable channel returns older stable target for downgrade and refuses beta-only releases', async()=>{
 const ctx=setup([{tag_name:'v3.8.2'},{tag_name:'v3.10.0-beta.1'}]);
 assert.equal(await ctx.fetchLatestVersion('stable'),'3.8.2');
 const only=setup([{tag_name:'v3.10.0-beta.1'}]);
 await assert.rejects(only.fetchLatestVersion('stable'),/no published stable/);
});
test('old channel response cannot overwrite new selection',async()=>{
 const ctx=setup([]);let complete;const seen=[];
 const state={updateChannel:'prerelease',updateRequest:{current:0},fetchLatestVersion:()=>new Promise(resolve=>{complete=resolve;}),
 setUpdateConfirm(){},setUpdateLatest:x=>seen.push(x),setUpdateAt(){},setUpdateStatus(){},setUpdateMessage(){}};
 const actions=ctx.createUpdateActions(state);
 const pending=actions.checkForUpdate(true);state.updateRequest.current++;state.updateChannel='stable';
 complete('3.10.0-beta.1');assert.equal(await pending,'');assert.deepEqual(seen,[]);
});
test('installation never falls back to master, even when a release tag fails to resolve',async()=>{
 const ctx=setup([]);const specs=[];
 const actions=ctx.createUpdateActions({updateConfirm:true,updateLatest:'3.10.0',availableVersions:['3.10.0','3.8.2'],
 setUpdateConfirm(){},setUpdateStatus(){},setUpdateMessage(){},t:key=>key,UPDATE_SPEC:'git+https://gitee.com/hadlooop/metaontic-agent-forge.git',
 PLUGIN_PACKAGE:'metaontic-agent-forge',UPDATE_ATTEMPTS:1,manager:()=>({manager:{
 listBundles: async () => ({ok:true,value:[{name:'metaontic-agent-forge',installed:true,source:'https://example.invalid/metaontic-agent-forge.tgz'}]}), installBundle:async spec=>{specs.push(spec);return {ok:false,error:{message:'Could not resolve'}};},
 removeBundle:()=>assert.fail('must not uninstall'),}})});
 await actions.runOnlineUpdate();assert.equal(specs.length,2);assert.ok(specs.every(spec=>spec.endsWith('/v3.10.0/metaontic-agent-forge-3.10.0.tgz')));
});
test('release validation prevents mismatched version and prerelease flags',()=>{
 const pkg=(version,prerelease)=>({version,releaseNotes:{version,prerelease}});
 assert.throws(()=>validateRelease(pkg('3.10.0-beta.1',true)));
 assert.doesNotThrow(()=>validateRelease(pkg('3.10.0',false)));
 assert.throws(()=>validateRelease(pkg('3.10.0-beta.1',false)));
 assert.throws(()=>validateRelease(pkg('3.10.0',true)));
 assert.throws(()=>validateRelease(pkg('3.10.0-beta.0',true)));
});
test('cache stores recent stable versions without reusing legacy channel cache',()=>{
 const ctx=setup([]);const cache=new Map();
 ctx.window.localStorage={getItem:key=>cache.get(key),setItem:(key,value)=>cache.set(key,value)};
 const actions=ctx.createUpdateActions({UPDATE_CACHE_KEY:'check.v3',UPDATE_MAX_AGE_MS:10000});
 actions.rememberUpdateCheck('3.10.0',['3.10.0','3.9.0','3.8.2']);
 assert.deepEqual(Array.from(actions.readUpdateCache().versions),['3.10.0','3.9.0','3.8.2']);
});
test('public runtime dependencies exclude build tools and internal rendering', async()=>{
 const {readFileSync}=await import('node:fs');
 const pkg=JSON.parse(readFileSync(new URL('../package.json',import.meta.url),'utf8'));
 assert.equal(pkg.dependencies.hyperframes,undefined);assert.equal(pkg.dependencies.esbuild,undefined);
 assert.ok(pkg.devDependencies.hyperframes);
});

test('recent list merges sources, sorts numerically, deduplicates and caps at three',async()=>{
 const ctx=setup([]);
 ctx.fetch=async url=>({ok:true,json:async()=>String(url).includes('gitee')
   ? [{tag_name:'v3.9.0'},{tag_name:'v3.10.0'},{tag_name:'v3.8.2'},{tag_name:'v3.8.1'}]
   : [{tag_name:'v3.11.0'},{tag_name:'v3.10.0'},{tag_name:'v9.0.0',prerelease:true}]});
 assert.deepEqual(Array.from(await ctx.fetchRecentVersions()),['3.11.0','3.10.0','3.9.0']);
});
test('older and identical versions cannot install even if the action is called directly',async()=>{
 const ctx=setup([]);
 for(const target of ['3.8.2','3.10.0']) {
  let installs=0;
  const actions=ctx.createUpdateActions({PLUGIN_VERSION:'3.10.0',isNewerVersion:ctx.isNewerVersion,
   updateConfirm:true,updateLatest:target,setUpdateConfirm(){},setUpdateStatus(){},setUpdateMessage(){},t:key=>key,
   manager:()=>({manager:{listBundles: async () => ({ok:true,value:[{name:'metaontic-agent-forge',installed:true,source:'https://example.invalid/metaontic-agent-forge.tgz'}]}), installBundle:async()=>{installs++;}}})});
  await actions.runOnlineUpdate();assert.equal(installs,0);
 }
});
test('new check does not default to downgrading an installed newer version',async()=>{
 const ctx=setup([]);let target;let versions;
 const actions=ctx.createUpdateActions({PLUGIN_VERSION:'3.10.0',isNewerVersion:ctx.isNewerVersion,
 fetchRecentVersions:async()=>['3.9.0','3.8.2','3.8.1'],setUpdateConfirm(){},setUpdateLatest:v=>target=v,
 setAvailableVersions:v=>versions=v,setUpdateAt(){},setUpdateStatus(){},setUpdateMessage(){}});
 await actions.checkForUpdate(true);assert.equal(target,'3.9.0');assert.equal(ctx.isNewerVersion(target,'3.10.0'),false);
});
test('higher-version installation reports a successful update',async()=>{
 const ctx=setup([]);const messages=[];
 const actions=ctx.createUpdateActions({PLUGIN_VERSION:'3.8.2',isNewerVersion:ctx.isNewerVersion,
 updateConfirm:true,updateLatest:'3.10.0',availableVersions:['3.10.0','3.9.0','3.8.2'],
 setUpdateConfirm(){},setUpdateStatus(){},setUpdateMessage:key=>messages.push(key),setUpdateLatest(){},t:key=>key,
 UPDATE_ATTEMPTS:1,PLUGIN_PACKAGE:'metaontic-agent-forge',manager:()=>({manager:{listBundles: async () => ({ok:true,value:[{name:'metaontic-agent-forge',installed:true,source:'https://example.invalid/metaontic-agent-forge.tgz'}]}), installBundle:async()=>({ok:true,value:{application:'applied',version:'3.8.2'}})}})});
 await actions.runOnlineUpdate();assert.equal(messages.at(-1),'versionUpdateDone');
});
