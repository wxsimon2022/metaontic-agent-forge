/** Explicitly invoked release command. --dry-run never writes, commits or pushes. */
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, realpathSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { findPromoPage, syncPromoFile, syncPromoText } from './sync-promo-address.mjs';
const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** 宣传页（服务端仓库）当前是否已指向目标版本；只读，不写文件。 */
export function promoStatus(version, file = findPromoPage()) {
  if (!file) return { file: '', needsSync: false, missing: [] };
  const before = readFileSync(file, 'utf8');
  const { text, results } = syncPromoText(before, version);
  return { file, needsSync: text !== before, missing: results.filter((item) => !item.hit).map((item) => item.name) };
}

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
/** 版本更新内容的字数上限：整篇合计（分类前缀不计），只写用户能感知的结论。 */
export const NOTES_LIMIT=100;
/** 版本更新内容只展示这两类；修复并入「优化」，不单独列一节。 */
export const NOTES_CATEGORIES=['新增','优化'];
/** 更新说明实际字数：按分类前缀后的正文计，空格也算一个字。 */
export function notesLength(items) {
  return (items||[]).reduce((total,item)=>total+String(item||'').replace(/^(新增|优化|修复)：/,'').length,0);
}
export function notesFor(version, items) {
  if (items.some(x=>typeof x==='string'&&x.startsWith('修复：'))) throw Error('版本更新内容只展示「新增」与「优化」：修复项请并入「优化」条目，不单列修复分类');
  if (!validVersion(version) || !Array.isArray(items) || !items.length || items.some(x=>typeof x!=='string'||! /^(新增|优化)：\S/.test(x)||/[\r\n]/.test(x))) throw Error('更新说明必须为完整的新增/优化条目');
  const length=notesLength(items);
  if(length>NOTES_LIMIT) throw Error(`更新说明共 ${length} 字，超过 ${NOTES_LIMIT} 字上限；版本更新内容只写用户能感知的结论，实现细节留在提交与工程记录里`);
  return NOTES_CATEGORIES.filter(c=>items.some(x=>x.startsWith(c+'：'))).map(c=>({category:c,items:items.filter(x=>x.startsWith(c+'：')).map(x=>x.slice(c.length+1))}));
}
const help = `一键发布（准备好完整说明与指南后执行）：
说明要求：只写「新增」与「优化」两类（修复并入优化），合计不超过 ${NOTES_LIMIT} 字。
发版会同时把使用说明书的成品地址与宣传页（服务端仓库，可用 METAONTIC_PROMO_PATH 指定，--no-promo 跳过）同步到本次版本。
  node scripts/release.mjs 3.13.3 --notes release-plan.json
  node scripts/release.mjs 3.13.3 --notes release-plan.json --dry-run
  node scripts/release.mjs 3.13.3 --resume
默认只发 Gitee：本地成品直接建 Release 并上传，不再等 GitHub Actions 打包回传。
需要同时同步 GitHub（含双平台安装校验）时加 --both，或 --github <地址>。
可选：--gitee <Gitee仓库地址> --branch master
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
  const opts={branch:'master',targets:'gitee',github:'git@ssh.github.com:wxsimon2022/metaontic-video.git',gitee:'git@ssh.gitee.com:hackloop/metaontic-video.git'};
  for(let i=1;i<argv.length;i++) {
    const key=argv[i];
    if(['--dry-run','--resume','--no-promo'].includes(key)) opts[key.slice(2)]=true;
    else if(key==='--both') opts.targets='both';
    // GitHub 只在明确要求时同步；不带地址的 --github 表示“连同 GitHub 一起发”。
    else if(key==='--github' && (!argv[i+1] || argv[i+1].startsWith('--'))) opts.targets='both';
    else if(['--notes','--github','--gitee','--branch'].includes(key) && argv[i+1] && !argv[i+1].startsWith('--')) { opts[key.slice(2)]=argv[++i]; if(key==='--github')opts.targets='both'; }
    else throw Error(`未知参数或缺少参数值：${key}`);
  }
  if(!/^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(opts.branch)||opts.branch.includes('..'))throw Error('无效分支');
  const github=repository(opts.github,'github.com'),gitee=repository(opts.gitee,'gitee.com');
  const includeGithub=opts.targets!=='gitee';
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
  const out=path.join(root,'.local/releases',version);
  // Gitee 是默认发布渠道，本地成品直接上传；GitHub 是可选镜像。
  const assets=[`metaontic-video-${version}.tgz`,`MetaOnticVideo-Windows-${version}.zip`,`MetaOnticVideo-Windows-${version}.zip.sha256`];
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
  console.log(`版本：${tag}\n发布渠道：${includeGithub?'Gitee + GitHub':'仅 Gitee'}\nGitee：${gitee.web}${includeGithub?`\nGitHub：${github.web}`:''}\n本地最近标签：${local}\n提交范围：\n${changes||'（无新提交，包含下列工作区改动）'}\n工作区：\n${dirty||'（干净）'}`);
  console.log(sections.map(x=>x.category+'\n'+x.items.map(i=>'- '+i).join('\n')).join('\n\n'));
  const printLinks=()=>console.log(`\nGitee发布页：${gitee.web}/releases/tag/${tag}\n插件地址：${gitee.web}/releases/download/${tag}/metaontic-video-${version}.tgz\nWindows包：${gitee.web}/releases/download/${tag}/MetaOnticVideo-Windows-${version}.zip${includeGithub?`\nGitHub发布页：${github.web}/releases/tag/${tag}`:''}\n注意：安装框填写tgz地址，不填写发布页或ZIP地址。`);
  if(opts['dry-run']) {
    const promo=promoStatus(version);
    console.log(promo.file?`宣传页：${promo.file}${promo.needsSync?`（待同步到 v${version}）`:`（已是 v${version}）`}`:'宣传页：未找到，发布时需手动同步安装地址');
    console.log(`\nDRY RUN（${includeGithub?'Gitee + GitHub':'仅 Gitee'}）：计划检查 → 构建/测试 → 打包/核对 → 提交/标签 → 推送 → ${includeGithub?'等待双平台CI → 核对两处附件':'上传并核对 Gitee Release 附件'}。`);printLinks();return;
  }
  // 最新正式版以发布渠道为准：Gitee 单仓发布时不能依赖 GitHub Release 列表。
  const latestOfficial=async()=>{
    const token=process.env.GITEE_TOKEN;
    if(token) {
      try {
        const response=await fetch(`https://gitee.com/api/v5/repos/${gitee.slug}/releases?access_token=${encodeURIComponent(token)}&per_page=50`,{signal:AbortSignal.timeout(20000)});
        if(response.ok) {
          const tags=(await response.json()).filter(r=>!r.prerelease&&/^v\d+\.\d+\.\d+$/.test(r.tag_name||'')).map(r=>r.tag_name);
          if(tags.length)return tags.reduce((a,b)=>newer(b.slice(1),a.slice(1))?b:a);
        }
      } catch(error) { console.log(`读取 Gitee 正式版列表失败：${error.message}`); }
    }
    const tags=git('tag','-l','v*').split('\n').filter(t=>/^v\d+\.\d+\.\d+$/.test(t));
    return tags.length?tags.reduce((a,b)=>newer(b.slice(1),a.slice(1))?b:a):undefined;
  };
  if(includeGithub)run('gh',['auth','status']);
  const latest=includeGithub
    ? JSON.parse(gh('release','list','--repo',github.slug,'--exclude-drafts','--exclude-pre-releases','--limit','1','--json','tagName'))[0]?.tagName
    : await latestOfficial();
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
    // 宣传页在服务端仓库、不属于这个包，但用户会照它复制安装地址：发版时一并改到目标版本。
    // 只在这里（真正发版的路径）写文件，--dry-run 不会动宣传页。
    let promoLine='';
    if(!opts['no-promo']) {
      const promo=promoStatus(version);
      if(promo.file) {
        const {changed}=syncPromoFile(promo.file,version);
        console.log(`宣传页${changed?'已同步到':'已是'} v${version}：${promo.file}`);
        promoLine=`- 宣传页安装地址已同步为 v${version}（${promo.file}，属服务端仓库，需在那里提交并部署）。\n`;
        if(promo.missing.length)console.warn(`宣传页这些位置没匹配到，请人工核对：${promo.missing.join('、')}`);
      } else console.warn('未找到宣传页，请在服务端仓库手动同步安装地址（可用 METAONTIC_PROMO_PATH 指定路径）。');
    }
    mkdirSync(out,{recursive:true});
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
    // 包内 README 会被宿主插件页当成「详细介绍」渲染，成品包统一裁掉。
    run(python,[...(python==='py'?['-3']:[]),'scripts/strip-package-readme.py',path.join(out,`metaontic-video-${version}.tgz`)]);
    run(python,[...(python==='py'?['-3']:[]),'scripts/package-windows.py',path.join(out,`metaontic-video-${version}.tgz`),path.join(out,`MetaOnticVideo-Windows-${version}.zip`)]);
    run('git',['diff','--check']);
    const body=`MetaOnticVideo ${tag}\n\n`+sections.map(s=>s.category+'\n'+s.items.map(i=>'- '+i).join('\n')).join('\n\n')+'\n\n验证\n- 本地构建及测试通过。\n'+(includeGithub?'- Windows/macOS成品安装及升级为CI上传前置条件。\n':'- 本条按仅 Gitee 发布处理：未运行 GitHub 双平台 CI，也没做 Windows 桌面实测，Windows 兼容性只有构建与打包层面的保证。\n')+promoLine+'- 桌面GUI与付费调用未由发布脚本自动验证。\n';
    const notes=path.join(out,'release-notes.txt');writeFileSync(notes,body);
    writeFileSync(`docs/engineering/release-${version}.md`,`# ${tag} 发布核对\n\n实际基线：${base}。\n\n${body}\n指南核对：${plan.guideReview}\n`);
    run('git',['add','-A']);run('git',['commit','-m',`release: ${tag}`]);run('git',['tag','-a',tag,'-F',notes]);
  }
  // 先确认发布渠道凭据，避免推送成功后才因为缺令牌停半路。
  const token=process.env.GITEE_TOKEN;
  if(!token)throw Error('缺少 GITEE_TOKEN，无法发布 Gitee Release 附件；设置后可用相同版本 --resume 续跑');
  // 双仓并行推送，单仓失败按退避重试三次；GitHub 走 ssh 443，实测偶尔整段连不通，单次就放弃最耗时。
  const push=async(repo,host,label)=>{
    const args=repo.transport.startsWith('git@ssh.')?['-c',`core.sshCommand=ssh -p 443 -o HostKeyAlias=${host} -o ConnectTimeout=30 -o ServerAliveInterval=10 -o ServerAliveCountMax=3`]:[];
    for(let attempt=1;attempt<=3;attempt++) {
      const result=spawnSync('git',[...args,'push',repo.transport,target,tag],{cwd:root,encoding:'utf8',stdio:'inherit',shell:false});
      if(!result.error&&result.status===0) { console.log(`${label} 已推送`);return true; }
      if(attempt<3) { console.log(`${label} 第 ${attempt} 次推送失败，${attempt*10} 秒后重试`);await new Promise(r=>setTimeout(r,attempt*10000)); }
    }
    console.log(`${label} 推送失败`);
    return false;
  };
  const remotes=includeGithub?[[gitee,'gitee.com','Gitee'],[github,'github.com','GitHub']]:[[gitee,'gitee.com','Gitee']];
  if((await Promise.all(remotes.map(([repo,host,label])=>push(repo,host,label)))).some(ok=>!ok)) { printLinks();throw Error('有仓库推送失败；网络恢复后用相同版本 --resume 续跑，不要重新打版本'); }
  // Gitee 是默认发布渠道：本地成品直接建 Release 并上传，省掉 GitHub Actions 打包回传那一大段等待。
  const {publishGitee}=await import('./publish-gitee.mjs');
  const notesText=readFileSync(path.join(out,'release-notes.txt'),'utf8');
  for(const name of assets) {
    const file=path.join(out,name);
    if(!existsSync(file))throw Error(`缺少成品 ${file}；请先重新构建打包再续跑`);
    await publishGitee({token,tag,archive:file,notes:notesText,prerelease:false});
  }
  console.log(`Gitee Release 附件已核对：${assets.join('、')}`);
  if(!includeGithub) { printLinks();return; }
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
  const complete=assets.every(x=>names.includes(x));
  console.log(`GitHub附件：${complete?'齐全':'未齐全'}；双仓CI：${watched===null?'未全部成功':'成功'}`);printLinks();
  if(!complete||watched===null)throw Error('发布未全部完成；保留现有标签，用相同版本--resume续跑，不要重新打版本');
}
if(process.argv[1] && realpathSync(process.argv[1])===fileURLToPath(import.meta.url))main(process.argv.slice(2)).catch(error=>{console.error(`发布停止：${error.message}`);process.exitCode=1;});
