import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { mkdtemp, mkdir, writeFile, readFile, readdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { sourceOf } from './source.mjs';

function setup(manager) {
  const state={calls:0,status:'',message:''};
  const sandbox=vm.createContext({window:{localStorage:{removeItem(){}}}});
  vm.runInContext(sourceOf('client/updates'),sandbox);
  const api={...manager,installBundle:async()=>{state.calls++;return {ok:true,value:{application:'applied',version:'3.13.2'}};}};
  const context={updateConfirm:true,PLUGIN_VERSION:'3.13.1',updateLatest:'3.13.2',availableVersions:['3.13.2'],
    PLUGIN_PACKAGE:'metaontic-video',UPDATE_ATTEMPTS:1,UPDATE_CACHE_KEY:'test',
    manager:()=>({manager:api}),isNewerVersion:()=>true,setUpdateConfirm(){},setUpdateLatest(){},
    setUpdateStatus:v=>{state.status=v;},setUpdateMessage:v=>{state.message=v;},setUpdateAt(){},t:key=>key};
  return {actions:sandbox.createUpdateActions(context),state};
}
for(const source of ['link:D:\\software\\package','D:\\software\\package','file:D:/software/package','file:///D:/software/package',
 '\\\\server\\share\\package','/Users/name/package','file:/Users/name/package','link:/tmp/test.tgz','metaontic-video@file:D:\\software\\package']) {
 test(`directory source blocks replacement before installer: ${source}`,async()=>{
  const h=setup({listBundles:async()=>({ok:true,value:[{name:'metaontic-video',installed:true,source}]})});
  await h.actions.runOnlineUpdate();assert.equal(h.state.calls,0);assert.equal(h.state.status,'failed');assert.match(h.state.message,/本地目录链接/);
 });
}
for(const source of ['file:D:\\软件 路径\\plugin.tgz','C:\\Downloads\\plugin.tar.gz','file:/tmp/中文 空格/plugin.tgz',
 'https://example.com/plugin.tgz','git+https://gitee.com/hackloop/metaontic-video.git','metaontic-video@3.13.1']) {
 test(`managed or repository source permits confirmed update: ${source}`,async()=>{
  const h=setup({listBundles:async()=>[{name:'metaontic-video',installed:true,source}]});
  await h.actions.runOnlineUpdate();assert.equal(h.state.calls,1);assert.equal(h.state.status,'applied');
 });
}
for(const manager of [{},{listBundles:async()=>{throw Error('transport');}},{listBundles:async()=>({ok:false})},
 {listBundles:async()=>[]},{listBundles:async()=>[{name:'other',installed:true,source:'https://example.com/pkg.tgz'}]},
 {listBundles:async()=>[{name:'metaontic-video',installed:true}]},
 {listBundles:async()=>[{name:'metaontic-video',installed:true,source:'https://example.com/pkg.tgz',meta:{error:'ENOENT'}}]}]) {
 test('unverified installation state fails closed without installer call',async()=>{
  const h=setup(manager);await h.actions.runOnlineUpdate();assert.equal(h.state.calls,0);assert.equal(h.state.status,'failed');assert.match(h.state.message,/无法核实/);
 });
}
test('local source block preserves real directory content across repeated clicks',async()=>{
 const temp=await mkdtemp(path.join(tmpdir(),'meta-update-safety-'));
 try {
  await mkdir(path.join(temp,'locale'));await writeFile(path.join(temp,'locale/en.json'),'original metadata');
  const h=setup({listBundles:async()=>[{name:'metaontic-video',installed:true,source:`link:${temp}`}]});
  await h.actions.runOnlineUpdate();await h.actions.runOnlineUpdate();
  assert.equal(h.state.calls,0);assert.equal(await readFile(path.join(temp,'locale/en.json'),'utf8'),'original metadata');
  assert.deepEqual(await readdir(temp),['locale']);
 }finally{await rm(temp,{recursive:true,force:true});}
});
