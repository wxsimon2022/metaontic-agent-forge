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
 assert.equal(await ctx.fetchLatestVersion('prerelease'),'3.11.0');
 assert.equal(ctx.isNewerVersion('3.10.0-beta.10','3.10.0-beta.2'),true);
 assert.equal(ctx.isNewerVersion('3.10.0','3.10.0-beta.10'),true);
 assert.equal(ctx.isNewerVersion('3.10.0-beta.10','3.10.0'),false);
 assert.equal(ctx.isNewerVersion('bad3.10.0','3.9.0'),false);
});
test('stable channel returns older stable target for downgrade and refuses beta-only releases', async()=>{
 const ctx=setup([{tag_name:'v3.8.2'},{tag_name:'v3.10.0-beta.1'}]);
 assert.equal(await ctx.fetchLatestVersion('stable'),'3.8.2');
 const only=setup([{tag_name:'v3.10.0-beta.1'}]);
 await assert.rejects(only.fetchLatestVersion('stable'),/no releases/);
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
 const actions=ctx.createUpdateActions({updateConfirm:true,updateLatest:'3.10.0-beta.1',updateChannel:'prerelease',
 setUpdateConfirm(){},setUpdateStatus(){},setUpdateMessage(){},t:key=>key,UPDATE_SPEC:'git+https://gitee.com/hackloop/metaontic-video.git',
 PLUGIN_PACKAGE:'metaontic-video',UPDATE_ATTEMPTS:1,manager:()=>({manager:{
 installBundle:async spec=>{specs.push(spec);return {ok:false,error:{message:'Could not resolve'}};},
 removeBundle:()=>assert.fail('must not uninstall'),}})});
 await actions.runOnlineUpdate();assert.equal(specs.length,2);assert.ok(specs.every(spec=>spec.endsWith('/v3.10.0-beta.1/metaontic-video-3.10.0-beta.1.tgz')));
});
test('release validation prevents mismatched version and prerelease flags',()=>{
 const pkg=(version,prerelease)=>({version,releaseNotes:{version,prerelease}});
 assert.doesNotThrow(()=>validateRelease(pkg('3.10.0-beta.1',true)));
 assert.doesNotThrow(()=>validateRelease(pkg('3.10.0',false)));
 assert.throws(()=>validateRelease(pkg('3.10.0-beta.1',false)));
 assert.throws(()=>validateRelease(pkg('3.10.0',true)));
 assert.throws(()=>validateRelease(pkg('3.10.0-beta.0',true)));
});
test('channel caches remain independent',()=>{
 const ctx=setup([]);const cache=new Map();
 ctx.window.localStorage={getItem:key=>cache.get(key),setItem:(key,value)=>cache.set(key,value)};
 const stable=ctx.createUpdateActions({UPDATE_CACHE_KEY:'check.stable',UPDATE_MAX_AGE_MS:10000});
 const beta=ctx.createUpdateActions({UPDATE_CACHE_KEY:'check.prerelease',UPDATE_MAX_AGE_MS:10000});
 stable.rememberUpdateCheck('3.9.0');beta.rememberUpdateCheck('3.10.0-beta.1');
 assert.equal(stable.readUpdateCache().latest,'3.9.0');assert.equal(beta.readUpdateCache().latest,'3.10.0-beta.1');
});
test('public runtime dependencies exclude build tools and internal rendering', async()=>{
 const {readFileSync}=await import('node:fs');
 const pkg=JSON.parse(readFileSync(new URL('../package.json',import.meta.url),'utf8'));
 assert.equal(pkg.dependencies.hyperframes,undefined);assert.equal(pkg.dependencies.esbuild,undefined);
 assert.ok(pkg.devDependencies.hyperframes);
});
