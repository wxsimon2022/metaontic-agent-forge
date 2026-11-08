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
    PLUGIN_PACKAGE:'metaontic-agent-forge',UPDATE_ATTEMPTS:1,UPDATE_CACHE_KEY:'test',
    manager:()=>({manager:api}),isNewerVersion:()=>true,setUpdateConfirm(){},setUpdateLatest(){},
    setUpdateStatus:v=>{state.status=v;},setUpdateMessage:v=>{state.message=v;},setUpdateAt(){},t:key=>key};
  return {actions:sandbox.createUpdateActions(context),state};
}
for(const source of ['link:D:\\software\\package','D:\\software\\package','file:D:/software/package','file:///D:/software/package',
 '\\\\server\\share\\package','/Users/name/package','file:/Users/name/package','link:/tmp/test.tgz','metaontic-agent-forge@file:D:\\software\\package']) {
 test(`directory source blocks replacement before installer: ${source}`,async()=>{
  const h=setup({listBundles:async()=>({ok:true,value:[{name:'metaontic-agent-forge',installed:true,source}]})});
  await h.actions.runOnlineUpdate();assert.equal(h.state.calls,0);assert.equal(h.state.status,'failed');assert.match(h.state.message,/本地目录链接/);
 });
}
for(const source of ['file:D:\\软件 路径\\plugin.tgz','C:\\Downloads\\plugin.tar.gz','file:/tmp/中文 空格/plugin.tgz',
 'https://example.com/plugin.tgz','git+https://gitee.com/hadlooop/metaontic-agent-forge.git','metaontic-agent-forge@3.13.1']) {
 test(`managed or repository source permits confirmed update: ${source}`,async()=>{
  const h=setup({listBundles:async()=>[{name:'metaontic-agent-forge',installed:true,source}]});
  await h.actions.runOnlineUpdate();assert.equal(h.state.calls,1);assert.equal(h.state.status,'applied');
 });
}
for(const manager of [{},{listBundles:async()=>{throw Error('transport');}},{listBundles:async()=>({ok:false})},
 {listBundles:async()=>[]},{listBundles:async()=>[{name:'other',installed:true,source:'https://example.com/pkg.tgz'}]},
 {listBundles:async()=>[{name:'metaontic-agent-forge',installed:true}]},
 {listBundles:async()=>[{name:'metaontic-agent-forge',installed:true,source:'https://example.com/pkg.tgz',meta:{error:'ENOENT'}}]}]) {
 test('unverified installation state fails closed without installer call',async()=>{
  const h=setup(manager);await h.actions.runOnlineUpdate();assert.equal(h.state.calls,0);assert.equal(h.state.status,'failed');assert.match(h.state.message,/无法核实/);
 });
}
test('local source block preserves real directory content across repeated clicks',async()=>{
 const temp=await mkdtemp(path.join(tmpdir(),'meta-update-safety-'));
 try {
  await mkdir(path.join(temp,'locale'));await writeFile(path.join(temp,'locale/en.json'),'original metadata');
  const h=setup({listBundles:async()=>[{name:'metaontic-agent-forge',installed:true,source:`link:${temp}`}]});
  await h.actions.runOnlineUpdate();await h.actions.runOnlineUpdate();
  assert.equal(h.state.calls,0);assert.equal(await readFile(path.join(temp,'locale/en.json'),'utf8'),'original metadata');
  assert.deepEqual(await readdir(temp),['locale']);
 }finally{await rm(temp,{recursive:true,force:true});}
});

test('lockfile integrity failure waits for the background cleanup and retries, never switches mirror',async()=>{
  const state={calls:0,status:'',message:'',waits:0};
  // 插件的后台清理每 2 秒扫一次锁文件：客户端命中该错误时应当等清理完成再试，而不是让用户自己数秒重按。
  const sandbox=vm.createContext({window:{localStorage:{removeItem(){}},setTimeout:(fn)=>{state.waits+=1;fn();return 0;}}});
  vm.runInContext(sourceOf('client/updates'),sandbox);
  const diagnostic='ERR_PNPM_MISSING_TARBALL_INTEGRITY Cannot install package "metaontic-agent-forge@https://gitee.com/x.tgz": its lockfile entry has no "integrity" field';
  const api={listBundles:async()=>[{name:'metaontic-agent-forge',installed:true,source:'https://gitee.com/hadlooop/metaontic-agent-forge/releases/download/v3.13.10/metaontic-agent-forge-3.13.10.tgz'}],
    installBundle:async()=>{state.calls+=1;return {ok:true,value:{application:'failed',error:{code:'operation-error',diagnostic}}};}};
  const context={updateConfirm:true,PLUGIN_VERSION:'3.13.9',updateLatest:'3.13.10',availableVersions:['3.13.10'],
    PLUGIN_PACKAGE:'metaontic-agent-forge',UPDATE_ATTEMPTS:3,UPDATE_CACHE_KEY:'test',
    manager:()=>({manager:api}),isNewerVersion:()=>true,setUpdateConfirm(){},setUpdateLatest(){},
    setUpdateStatus:v=>{state.status=v;},setUpdateMessage:v=>{state.message=v;},setUpdateAt(){},t:key=>key};
  await sandbox.createUpdateActions(context).runOnlineUpdate();
  assert.equal(state.calls,3);                       // 只在同一个 Gitee 地址上等清理后重试，不换 GitHub 地址
  assert.equal(state.waits,2);                       // 前两次之间各等一次后台清理，第三次才收尾
  assert.equal(state.status,'failed');
  assert.match(state.message,/^versionUpdateLockfile/);
});
