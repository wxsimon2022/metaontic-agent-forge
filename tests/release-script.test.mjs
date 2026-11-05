import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, copyFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { validVersion, newer, repository, notesFor, notesLength, NOTES_LIMIT } from '../scripts/release.mjs';

test('release input rejects nonstable versions and command-shaped repository names',()=>{
 for(const v of ['3.1.2-beta.1','v3.1.2','03.1.2','--help','3.1'])assert.equal(validVersion(v),false);
 assert.equal(newer('3.14.0','3.13.2'),true);assert.equal(newer('3.13.2','3.13.2'),false);
 assert.equal(repository('git@ssh.github.com:owner/repo.git','github.com').slug,'owner/repo');
 assert.equal(repository('https://gitee.com/owner/repo.git','gitee.com').web,'https://gitee.com/owner/repo');
 for(const source of ['--upload-pack=evil','https://example.com/owner/repo','git@github.com:owner/repo;bad','https://github.com/../repo'])assert.throws(()=>repository(source,'github.com'));
 assert.throws(()=>notesFor('1.0.0',['unstructured']));assert.throws(()=>notesFor('1.0.0',['修复：text\nforged section']));
 // 版本更新内容不超过100字：整篇合计（分类前缀不计），刚好100字放行，多一个字直接拒绝。
 assert.equal(NOTES_LIMIT,100);
 assert.equal(notesLength(['新增：'+'字'.repeat(60),'修复：'+'字'.repeat(40)]),100);
 assert.deepEqual(notesFor('1.0.0',['新增：'+'字'.repeat(60),'修复：'+'字'.repeat(40)]).map(x=>x.category),['新增','修复']);
 assert.throws(()=>notesFor('1.0.0',['新增：'+'字'.repeat(60),'修复：'+'字'.repeat(41)]),/100 字上限/);
 assert.throws(()=>notesFor('1.0.0',['优化：'+'字'.repeat(101)]),/100 字上限/);
});

test('release dry run changes no files, tags or git index and starts no publication',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'meta-release-dry-'));
 try {
  await mkdir(path.join(dir,'scripts'));
  await copyFile(new URL('../scripts/release.mjs',import.meta.url),path.join(dir,'scripts/release.mjs'));
  await writeFile(path.join(dir,'package.json'),'{"type":"module","version":"1.0.0"}');
  await writeFile(path.join(dir,'MetaOnticVideo使用说明书.md'),'# 安装指南\n使用正式成品。');
  await writeFile(path.join(dir,'MetaOnticVideo使用说明书.pdf'),'test fixture');
  await writeFile(path.join(dir,'plan.json'),JSON.stringify({items:['修复：覆盖整个待发布范围的具体问题。'],guideReview:'已核对安装步骤与操作指南，本次无变化。'}));
  const git=(...a)=>execFileSync('git',a,{cwd:dir,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
  git('init','-b','master');git('add','.');git('-c','user.name=Test','-c','user.email=test@localhost','commit','-m','fixture');git('tag','v1.0.0');
  const before=git('status','--porcelain');const tags=git('tag');const head=git('rev-parse','HEAD');const pkg=await readFile(path.join(dir,'package.json'),'utf8');
  const result=spawnSync(process.execPath,[path.join(dir,'scripts/release.mjs'),'1.0.1','--notes',path.join(dir,'plan.json'),'--dry-run'],{encoding:'utf8',timeout:10000});
  assert.equal(result.status,0,result.stderr);assert.match(result.stdout,/DRY RUN/);assert.match(result.stdout,/metaontic-video-1.0.1.tgz/);
  // 默认只发 Gitee：不碰 GitHub，也不会打印 GitHub 的发布页与附件地址。
  assert.match(result.stdout,/仅 Gitee/);assert.doesNotMatch(result.stdout,/github\.com/);
  const both=spawnSync(process.execPath,[path.join(dir,'scripts/release.mjs'),'1.0.1','--notes',path.join(dir,'plan.json'),'--dry-run','--both'],{encoding:'utf8',timeout:10000});
  assert.equal(both.status,0,both.stderr);assert.match(both.stdout,/Gitee \+ GitHub/);assert.match(both.stdout,/github\.com\/wxsimon2022\/metaontic-video\/releases\/tag\/v1\.0\.1/);
  assert.equal(git('status','--porcelain'),before);assert.equal(git('tag'),tags);assert.equal(git('rev-parse','HEAD'),head);assert.equal(await readFile(path.join(dir,'package.json'),'utf8'),pkg);
 }finally{await rm(dir,{recursive:true,force:true});}
});
