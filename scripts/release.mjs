/** Explicitly invoked release command. --dry-run never writes, commits or pushes. */
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, realpathSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function validVersion(value) { return /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(value || ''); }
export function newer(next, previous) {
  if (!validVersion(next) || !validVersion(previous)) return false;
  const a=next.split('.').map(Number),b=previous.split('.').map(Number);
  for(let i=0;i<3;i++) if(a[i]!==b[i]) return a[i]>b[i];
  return false;
}
export function repository(value, host) {
  const match = /^(?:git@(?:ssh\.)?([^:]+):|https:\/\/([^/]+)\/)([\w.-]+\/[\w.-]+?)(?:\.git)?$/.exec(value || '');
  if (!match || (match[1] || match[2]) !== host || match[3].includes('..')) throw Error(`无效${host}仓库地址`);
  return { transport:value, slug:match[3], web:`https://${host}/${match[3]}` };
}
export function notesFor(version, items) {
  if (!validVersion(version) || !Array.isArray(items) || !items.length || items.some(x=>typeof x!=='string'||! /^(新增|优化|修复)：\S/.test(x)||/[\r\n]/.test(x))) throw Error('更新说明必须为完整的新增/优化/修复条目');
  return ['新增','优化','修复'].filter(c=>items.some(x=>x.startsWith(c+'：'))).map(c=>({category:c,items:items.filter(x=>x.startsWith(c+'：')).map(x=>x.slice(c.length+1))}));
}
const help = `一键发布（准备好完整说明与指南后执行）：
  node scripts/release.mjs 3.13.3 --notes release-plan.json
  node scripts/release.mjs 3.13.3 --notes release-plan.json --dry-run
  node scripts/release.mjs 3.13.3 --resume
可选：--github <GitHub仓库地址> --gitee <Gitee仓库地址> --branch master
默认双仓：wxsimon2022/metaontic-video、hackloop/metaontic-video。
--dry-run 只显示范围与计划，不写文件、不改版本、不提交、不联网发布。
--resume 仅续跑已提交且同一标签的发布，不改旧标签。
`;

export async function main(argv) {
  if(argv[0]==='--interactive') {
    const {createInterface}=await import('node:readline/promises');
    const input=createInterface({input:process.stdin,output:process.stdout});
    let entered;
    try { console.log('正式发布：请先填写release-plan.json并同步指南。'); entered=(await input.question('请输入正式版本号（如3.13.3，留空退出）：')).trim(); } finally { input.close(); }
    if(!entered)return;
    return main([entered,...argv.slice(1)]);
  }
  if (!argv.length || argv.includes('--help') || argv.includes('-h')) { console.log(help); return; }
  const version = argv[0]; if (!validVersion(version)) throw Error('版本号必须为X.Y.Z正式版');
  const opts={branch:'master',github:'git@ssh.github.com:wxsimon2022/metaontic-video.git',gitee:'git@ssh.gitee.com:hackloop/metaontic-video.git'};
  for(let i=1;i<argv.length;i++) {
    const key=argv[i];
    if(['--dry-run','--resume'].includes(key)) opts[key.slice(2)]=true;
    else if(['--notes','--github','--gitee','--branch'].includes(key) && argv[i+1] && !argv[i+1].startsWith('--')) opts[key.slice(2)]=argv[++i];
    else throw Error(`未知参数或缺少参数值：${key}`);
  }
  if(!/^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(opts.branch)||opts.branch.includes('..'))throw Error('无效分支');
  const github=repository(opts.github,'github.com'),gitee=repository(opts.gitee,'gitee.com');
  // Current workflow mirrors to this configured Gitee repository. Reject silently publishing elsewhere.
  if(gitee.slug!=='hackloop/metaontic-video')throw Error('当前CI绑定hackloop/metaontic-video，变更目标前请同步CI镜像配置');
  process.chdir(root);
  const run=(command,args,{capture=false,optional=false}={})=>{
    const result=spawnSync(command,args,{cwd:root,encoding:'utf8',stdio:capture?'pipe':'inherit',shell:false});
    if(result.error || result.status!==0) { if(optional)return null; throw Error(`${command} ${args[0]||''} 失败（${result.status??result.error?.code}）`); }
    return capture?result.stdout.trim():'';
  };
  const git=(...args)=>run('git',args,{capture:true});
  const gh=(...args)=>run('gh',args,{capture:true});
  const tag=`v${version}`,target=`${opts.branch}`;
  if(git('branch','--show-current')!==target)throw Error(`请在${target}分支执行，脚本不会切换分支`);
  if(git('ls-files','-u'))throw Error('有未解决的合并冲突');
  const local=git('describe','--tags','--abbrev=0');
  const changes=git('log',`${local}..HEAD`,'--oneline');
  const dirty=git('status','--short');
  const pkg=JSON.parse(readFileSync('package.json','utf8'));
  let plan;
  if(opts.notes) plan=JSON.parse(readFileSync(path.resolve(opts.notes),'utf8'));
  else if(existsSync('release-plan.json'))plan=JSON.parse(readFileSync('release-plan.json','utf8'));
  else if(opts.resume)plan={items:pkg.releaseNotes?.items,guideReview:'沿用已提交的发布核对'};
  else throw Error('缺少release-plan.json；复制docs/engineering/release-plan.example.json并填写完整更新内容及guideReview');
  const sections=notesFor(version,plan.items);
  if(plan.items.some(x=>/请填写|请替换|占位/.test(x))||/请替换/.test(plan.guideReview||''))throw Error('请先替换发布计划中的模板占位文字');
  if(typeof plan.guideReview!=='string'||plan.guideReview.trim().length<8)throw Error('请填写具体guideReview，记录本次指南核对结果');
  for(const f of ['MetaOnticVideo使用说明书.md','MetaOnticVideo使用说明书.pdf'])if(!existsSync(f))throw Error(`缺少${f}`);
  const guide=readFileSync('MetaOnticVideo使用说明书.md','utf8');
  if(/适用版本|发布核对|^#{1,6}.*(?:更新日志|发布说明|版本更新)/m.test(guide))throw Error('使用说明书含发布内容，请移至工程发布记录');
  // 指南里写死的成品地址必须指向本次版本，否则用户会照旧版本地址安装。
  for(const match of guide.matchAll(/releases\/download\/v(\d+\.\d+\.\d+)\//g))if(match[1]!==version)throw Error(`使用说明书里的成品地址仍指向 v${match[1]}，请更新为 v${version}`);
  const files=git('ls-files','--cached','--others','--exclude-standard','-z').split('\0').filter(Boolean);
  if(files.some(f=>/(?:价格对比|计费参考|比价视频)|(?:^|\/)\.env(?:$|\.)|(?:^|\/)\.local\//.test(f)))throw Error('待提交文件中存在本地价格资料或环境文件，请先核对忽略规则');
  console.log(`版本：${tag}\nGitHub：${github.web}\nGitee：${gitee.web}\n本地最近标签：${local}\n提交范围：\n${changes||'（无新提交，包含下列工作区改动）'}\n工作区：\n${dirty||'（干净）'}`);
  console.log(sections.map(x=>x.category+'\n'+x.items.map(i=>'- '+i).join('\n')).join('\n\n'));
  const printLinks=()=>console.log(`\n发布页：${github.web}/releases/tag/${tag}\n插件地址：${github.web}/releases/download/${tag}/metaontic-video-${version}.tgz\nWindows包：${github.web}/releases/download/${tag}/MetaOnticVideo-Windows-${version}.zip\nGitee发布页：${gitee.web}/releases/tag/${tag}\n注意：安装框填写tgz地址，不填写发布页或ZIP地址。`);
  if(opts['dry-run']) { console.log('\nDRY RUN：计划检查 → 构建/测试 → 打包/核对 → 提交/标签 → Gitee/GitHub推送 → 等待双平台CI → 核对附件。');printLinks();return; }
  run('gh',['auth','status']);
  const latest=JSON.parse(gh('release','list','--repo',github.slug,'--exclude-drafts','--exclude-pre-releases','--limit','1','--json','tagName'))[0]?.tagName;
  if(!opts.resume && latest && !newer(version,latest.replace(/^v/,'')))throw Error(`目标必须高于最新正式版${latest}`);
  const exists=run('git',['rev-parse','--verify',`refs/tags/${tag}`],{capture:true,optional:true});
  if(opts.resume) {
    if(!exists||pkg.version!==version||git('rev-parse',`${tag}^{commit}`)!==git('rev-parse','HEAD')||dirty)throw Error('续跑要求：标签/版本/HEAD一致且工作区干净');
  } else {
    if(exists)throw Error('标签已存在，禁止覆盖；如仅重试发布请使用--resume');
    run(process.execPath,['scripts/check-active-video.mjs']);
    const base=latest||local;
    console.log(`实际待发布范围 ${base}..HEAD：\n${git('log',`${base}..HEAD`,'--oneline')}`);
    // Refuse a changed guide without a refreshed PDF; explicit review also covers unchanged guides.
    const before=run('git',['show',`${base}:MetaOnticVideo使用说明书.md`],{capture:true,optional:true});
    const priorPdf=run('git',['rev-parse',`${base}:MetaOnticVideo使用说明书.pdf`],{capture:true,optional:true});
    if(before!==guide.trim() && priorPdf===git('hash-object','MetaOnticVideo使用说明书.pdf'))throw Error('指南正文已变更，但PDF未同步');
    const now=new Date().toISOString();
    pkg.version=version;pkg.releaseNotes={version,prerelease:false,publishedAt:now,items:plan.items};
    writeFileSync('package.json',JSON.stringify(pkg,null,2)+'\n');
    const lock=JSON.parse(readFileSync('package-lock.json','utf8'));lock.version=version;lock.packages[''].version=version;
    writeFileSync('package-lock.json',JSON.stringify(lock,null,2)+'\n');
    const markdown=sections.map(s=>'### '+s.category+'\n\n'+s.items.map(i=>'- '+i).join('\n')).join('\n\n');
    for(const [file,header] of [['README.md',`## ${tag} 更新内容`],['CHANGELOG.md',`## ${tag}`]]) {
      let text=readFileSync(file,'utf8');
      if(text.includes(header)) { const start=text.indexOf(header);const rest=text.slice(start+header.length);const next=rest.search(/^## v\d+\.\d+\.\d+/m);text=text.slice(0,start)+(next<0?'':rest.slice(next)); }
      const at=text.search(/^## v\d+\.\d+\.\d+/m);if(at<0)throw Error(`${file}缺少更新区插入位置`);
      writeFileSync(file,text.slice(0,at)+header+'\n\n'+markdown+'\n\n'+text.slice(at));
    }
    const out=path.join(root,'.local/releases',version);mkdirSync(out,{recursive:true});
    // npm CLI is JavaScript; invoking it through Node avoids .cmd shell quoting on Windows.
    const npm=process.env.npm_execpath||run(process.platform==='win32'?'where.exe':'which',['npm'],{capture:true}).split(/\r?\n/).find(x=>x.endsWith('npm'));
    let npmCli=process.env.npm_execpath;
    if(!npmCli && process.platform!=='win32')npmCli=run(process.execPath,['-p',`require('fs').realpathSync(${JSON.stringify(npm)})`],{capture:true});
    if(!npmCli && process.platform==='win32') {
      const cmd=run('where.exe',['npm.cmd'],{capture:true}).split(/\r?\n/)[0];npmCli=path.join(path.dirname(cmd),'node_modules/npm/bin/npm-cli.js');
    }
    if(!npmCli||!existsSync(npmCli))throw Error('未找到npm CLI；建议用npm run release调用');
    if(!existsSync('node_modules/esbuild'))run(process.execPath,[npmCli,'ci']);
    run(process.execPath,[require.resolve('typescript/bin/tsc'),'-p','tsconfig.json']);
    run(process.execPath,['scripts/build.mjs']);
    run(process.execPath,['--test',...readdirSync('tests').filter(x=>x.endsWith('.test.mjs')).map(x=>'tests/'+x)]);
    run(process.execPath,['scripts/validate-release.mjs']);
    run(process.execPath,[npmCli,'pack','--pack-destination',out]);
    // Python is a packaging tool only; Windows py launcher is accepted.
    const python=process.platform==='win32'?'py':'python3';
    run(python,[...(python==='py'?['-3']:[]),'scripts/package-windows.py',path.join(out,`metaontic-video-${version}.tgz`),path.join(out,`MetaOnticVideo-Windows-${version}.zip`)]);
    run('git',['diff','--check']);
    const body=`MetaOnticVideo ${tag}\n\n`+sections.map(s=>s.category+'\n'+s.items.map(i=>'- '+i).join('\n')).join('\n\n')+'\n\n验证\n- 本地构建及测试通过。\n- Windows/macOS成品安装及升级为CI上传前置条件。\n- 桌面GUI与付费调用未由发布脚本自动验证。\n';
    const notes=path.join(out,'release-notes.txt');writeFileSync(notes,body);
    writeFileSync(`docs/engineering/release-${version}.md`,`# ${tag} 发布核对\n\n实际基线：${base}。\n\n${body}\n指南核对：${plan.guideReview}\n`);
    run('git',['add','-A']);run('git',['commit','-m',`release: ${tag}`]);run('git',['tag','-a',tag,'-F',notes]);
  }
  for(const [repo,host] of [[gitee,'gitee.com'],[github,'github.com']]) {
    const args=repo.transport.startsWith('git@ssh.')?['-c',`core.sshCommand=ssh -p 443 -o HostKeyAlias=${host} -o ConnectTimeout=15`]:[];
    run('git',[...args,'push',repo.transport,target,tag]);
  }
  // Poll by tag: never watch some unrelated release's run.
  let workflow;
  for(let i=0;i<20;i++) {
    const runs=JSON.parse(gh('run','list','--repo',github.slug,'--workflow','publish.yml','--branch',tag,'--limit','10','--json','databaseId,headSha,status,conclusion'));
    workflow=runs.find(x=>x.headSha===git('rev-parse','HEAD'));
    if(workflow)break;await new Promise(r=>setTimeout(r,3000));
  }
  if(!workflow) {printLinks();throw Error('已推送，但尚未找到匹配CI；稍后用--resume续跑');}
  if(workflow.conclusion==='failure' && opts.resume)run('gh',['run','rerun',String(workflow.databaseId),'--failed','--repo',github.slug]);
  const watched=run('gh',['run','watch',String(workflow.databaseId),'--exit-status','--interval','10','--repo',github.slug],{optional:true});
  const release=run('gh',['release','view',tag,'--repo',github.slug,'--json','assets,isPrerelease,body'],{capture:true,optional:true});
  const data=release?JSON.parse(release):null;
  if(data?.isPrerelease)throw Error('远端错误地标记为预发布');
  const names=data?.assets?.filter(a=>a.state==='uploaded').map(a=>a.name)||[];
  const complete=[`metaontic-video-${version}.tgz`,`MetaOnticVideo-Windows-${version}.zip`,`MetaOnticVideo-Windows-${version}.zip.sha256`].every(x=>names.includes(x));
  console.log(`GitHub附件：${complete?'齐全':'未齐全'}；双仓CI：${watched===null?'未全部成功':'成功'}`);printLinks();
  if(!complete||watched===null)throw Error('发布未全部完成；保留现有标签，用相同版本--resume续跑，不要重新打版本');
}
if(process.argv[1] && realpathSync(process.argv[1])===fileURLToPath(import.meta.url))main(process.argv.slice(2)).catch(error=>{console.error(`发布停止：${error.message}`);process.exitCode=1;});
