import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pruneGitee } from '../scripts/prune-gitee.mjs';

const day = 86400000;
function fakeGitee(){
 const releases=[1,2,4,5,6].map((age,index)=>({ id:index+1, tag_name:`v3.${index}.0`, created_at:new Date(Date.now()-age*day).toISOString() }));
 const deleted=[];
 const request=async (url,options)=>{
  const path=url.pathname+ (url.searchParams.get('page')?'?page='+url.searchParams.get('page'):'');
  if(options.method==='DELETE'){ const id=Number(/\/releases\/(\d+)$/.exec(url.pathname)[1]); deleted.push(releases.find(r=>r.id===id).tag_name); return { ok:true, json:async()=>({}) }; }
  if(path.includes('/attach_files')) return { ok:true, json:async()=>[{ name:'a.tgz', size:1024 }] };
  if(path.startsWith('/api/v5/repos/hackloop/metaontic-video/releases?page=1')) return { ok:true, json:async()=>releases.filter(r=>!deleted.includes(r.tag_name)) };
  return { ok:false, status:404 };
 };
 return { request, deleted, releases };
}

test('dry run lists candidates and deletes nothing',async()=>{
 const gitee=fakeGitee();
 const result=await pruneGitee({ token:'t', dryRun:true, keep:3, days:3, request:gitee.request, log:()=>{} });
 assert.deepEqual(result.candidates,['v3.3.0','v3.4.0']);
 assert.deepEqual(gitee.deleted,[]);
 assert.equal(result.freedBytes,2048);
});

test('confirmed run removes only releases outside the keep window',async()=>{
 const gitee=fakeGitee();
 const result=await pruneGitee({ token:'t', dryRun:false, keep:3, days:3, request:gitee.request, log:()=>{} });
 assert.deepEqual(gitee.deleted,['v3.3.0','v3.4.0']);
 assert.deepEqual(result.deleted,['v3.3.0','v3.4.0']);
 const remaining=gitee.releases.filter(release=>!gitee.deleted.includes(release.tag_name)).map(release=>release.tag_name);
 assert.deepEqual(remaining,['v3.0.0','v3.1.0','v3.2.0']);
});

test('the keep window protects recent releases even when they are old',async()=>{
 const gitee=fakeGitee();
 const result=await pruneGitee({ token:'t', dryRun:false, keep:5, days:1, request:gitee.request, log:()=>{} });
 assert.deepEqual(gitee.deleted,[]);
 assert.equal(result.remainingBytes,5*1024);
});

test('missing token stops before any request',async()=>{
 let called=0;
 await assert.rejects(pruneGitee({ token:'', request:async()=>{called++;}, log:()=>{} }),/Missing GITEE_TOKEN/);
 assert.equal(called,0);
});
