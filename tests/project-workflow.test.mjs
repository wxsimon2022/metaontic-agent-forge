import './no-network-analytics.mjs';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { apply } from '../index.js';
import { workflowApi as api } from './workflow-test-api.mjs';

async function fixture(run) {
  const dir = await mkdtemp(path.join(os.tmpdir(), '项目 workflow '));
  const oldHome = process.env.DSH_HOME, oldFetch = globalThis.fetch;
  process.env.DSH_HOME = dir;
  const config = {connectionMode:'metaontic',metaonticApiKey:'test-secret',model:'doubao-seedance-2-0-mini-260615',baseUrl:'https://mock.invalid'};
  const tools = new Map(), observers = []; let gate, asks = 0, posts = 0;
  const answers = { review:'脚本通过', character:'直接文生视频', during:null };
  const exec = {callId:'workflow',agent:{session:{id:'session-1',header:{cwd:dir}}}};
  const ctx = {
    tools:{register(t){tools.set(t.name,t);return ()=>{};}}, inject(){},
    on(name,fn){if(name==='session/event')observers.push(fn);else gate=fn;return ()=>{};},
    get(name){return name==='userQuestions'?{ask:async request=>{
      asks++; await answers.during?.();
      const id=request.questions[0].id, choice=id==='script_review'?answers.review:answers.character;
      return choice?{answers:[{id,selected:[choice]}]}:{answers:[]};
    }}:undefined;},
  };
  const dispose=apply(ctx,config);
  globalThis.fetch=async (url,opts={})=>{
    if(opts.method==='POST'){posts++;return Response.json({id:`task-${posts}`});}
    if(String(url).includes('/api/log/'))return Response.json({success:true,data:[]});
    if(String(url).endsWith('/api/status'))return Response.json({});
    return Response.json({status:'succeeded',content:{video_url:'https://mock.invalid/result.mp4'}});
  };
  const spec={prompt:'清晨湖面',duration:5,ratio:'16:9',resolution:'480p',merge:false};
  const script=path.join(dir,'script.md'), image=path.join(dir,'storyboard.svg');
  await writeFile(script,'# 湖面\n清晨的湖面，镜头缓缓推进。\n费用预估：按渠道实际调用。');await writeFile(image,'<svg/>');
  async function show(body=true){
    for(const observer of observers)await observer(exec.agent.session,{type:'tool/call',data:{turn:1,name:'metaontic_agent_forge_video_project'}});
    const text=(body?await readFile(script,'utf8'):'摘要')+`\n![分镜](<${image}>)`;
    for(const observer of observers)await observer(exec.agent.session,{type:'assistant/message',data:{turn:1,message:{content:[{type:'text',text}]}}});
  }
  const project=tools.get('metaontic_agent_forge_video_project');
  async function prepare(subjectType='scenery'){return project.execute({action:'prepare',subjectType,duration:spec.duration},exec);}
  async function review(id,extra={}){await show();return project.execute({action:'review',projectId:id,scriptPath:script,toolName:'metaontic_agent_forge_video_generate',specification:spec,...extra},exec);}
  try {await run({dir,config,tools,exec,answers,spec,script,image,project,prepare,review,show,gate:x=>gate(x,()=>null),get asks(){return asks;},get posts(){return posts;}});}
  finally{dispose();globalThis.fetch=oldFetch;if(oldHome===undefined)delete process.env.DSH_HOME;else process.env.DSH_HOME=oldHome;await rm(dir,{recursive:true,force:true});}
}

test('real plugin requires project review in both preflight and execution; scenery skips character question',()=>fixture(async h=>{
  const args={...h.spec};
  assert.equal((await h.gate({...h.exec,name:'metaontic_agent_forge_video_generate',arguments:args})).kind,'deny');
  await assert.rejects(h.tools.get('metaontic_agent_forge_video_generate').execute(args,h.exec),/projectId/);
  const p=await h.prepare();assert.equal(h.asks,0);assert.equal(p.choice,'not_needed');
  assert.equal((await h.review(p.projectId)).status,'approved');assert.equal(h.asks,1);
  args.projectId=p.projectId;
  const decision=await h.gate({...h.exec,name:'metaontic_agent_forge_video_generate',arguments:args});
  assert.equal(decision.kind,'ask');assert.match(decision.displayReason.zh,/16:9.*480p.*本段5秒/);assert.match(decision.displayReason.zh,/本段基础估价约¥/);assert.match(decision.displayReason.zh,/剩余计划1段/);
  assert.equal(h.asks,1,'no extra start-production question');
  const result=await h.tools.get('metaontic_agent_forge_video_generate').execute(args,h.exec);assert.equal(result.status,'succeeded');assert.equal(h.posts,1);
}));

test('script, production settings and session identity invalidate approval; hot reload retains it',()=>fixture(async h=>{
  const p=await h.prepare();await h.review(p.projectId);
  const exec={...h.exec,name:'metaontic_agent_forge_video_generate'},args={...h.spec,projectId:p.projectId};
  await api.assertProjectApproved(h.config,exec,args);
  for(const changes of [{resolution:'720p'},{prompt:'另一段故事'},{duration:10},{ratio:'9:16'},{generateAudio:false}])await assert.rejects(api.assertProjectApproved(h.config,exec,{...args,...changes}),/参数/);
  h.config.model='doubao-seedance-2-0-fast-260128';await assert.rejects(api.assertProjectApproved(h.config,exec,args),/参数/);h.config.model='doubao-seedance-2-0-mini-260615';
  await assert.rejects(api.assertProjectApproved(h.config,{...exec,agent:{session:{id:'other'}}},args),/不属于/);
  await writeFile(h.script,'改稿');await assert.rejects(api.assertProjectApproved(h.config,exec,args),/脚本已修改/);
  assert.equal(h.posts,0);
}));

for(const response of [null,'需要修改'])test(`review ${response} never grants approval`,()=>fixture(async h=>{
  h.answers.review=response;const p=await h.prepare();assert.equal((await h.review(p.projectId)).status,'draft');
  await assert.rejects(api.assertProjectApproved(h.config,{...h.exec,name:'metaontic_agent_forge_video_generate'},{...h.spec,projectId:p.projectId}),/尚未审核/);assert.equal(h.posts,0);
}));

test('review requires full script and inline storyboard, not a summary or file path',()=>fixture(async h=>{
  const p=await h.prepare();await h.show(false);
  const result=await h.project.execute({action:'review',projectId:p.projectId,scriptPath:h.script,specification:h.spec},h.exec);
  assert.equal(result.status,'blocked');assert.equal(h.asks,0);assert.match(result.reason,/完整展示/);
}));

test('changes while waiting for review cannot approve a different script',()=>fixture(async h=>{
  const p=await h.prepare();h.answers.during=()=>writeFile(h.script,'等待期间改变');
  await assert.rejects(h.review(p.projectId),/等待审核期间/);
  assert.equal((await h.project.execute({action:'status',projectId:p.projectId},h.exec)).status,'draft');
}));

test('character route is prepared early, survives edits and differs across projects',()=>fixture(async h=>{
  h.answers.character='直接文生视频';const p=await h.prepare('fixed_subject');assert.equal(p.choice,'text_only');assert.equal(h.asks,1);
  await h.project.execute({action:'prepare',projectId:p.projectId},h.exec);assert.equal(h.asks,1);
  h.spec.prompt='改提示词';h.spec.resolution='720p';await h.review(p.projectId);assert.equal(h.asks,2,'only review asks again');
  const next=await h.prepare('fixed_subject');assert.notEqual(next.projectId,p.projectId);assert.equal(h.asks,3);
}));

test('cancelled character selection and generate-first without an image both stop before video',()=>fixture(async h=>{
  h.answers.character=null;const p=await h.prepare('fixed_subject');assert.equal(p.status,'pending');
  await assert.rejects(h.review(p.projectId),/角色图选择未完成/);
  h.answers.character='先生成角色图（单独计费）';await h.project.execute({action:'prepare',projectId:p.projectId},h.exec);
  await assert.rejects(h.review(p.projectId),/先提供角色图/);assert.equal(h.posts,0);
}));

test('approval estimates include previous full video input and refuse unknown rates or dimensions',()=>fixture(async h=>{
  const plan=[{kind:'generate',seconds:15},{kind:'extend',seconds:15}];
  const result=api.estimateSegmentCosts(h.config,{...h.spec,resolution:'720p'},plan);
  assert.deepEqual(result.segments.map(s=>s.inputSeconds),[0,15]);assert.equal(result.cny,16.524);
  assert.throws(()=>api.estimateSegmentCosts({...h.config,model:'unknown'},h.spec,plan),/可靠价目/);
  assert.throws(()=>api.estimateSegmentCosts(h.config,{...h.spec,ratio:'1:1'},plan),/画幅/);
  assert.throws(()=>api.estimateSegmentCosts(h.config,h.spec,[{kind:'extend',seconds:5}]),/输入视频时长/);
}));

test('video-only prompt uses current preset projection; standard and unknown modes receive no restriction',()=>{
  let section, selected='metaontic-agent-forge-video-director';
  const ctx={tools:{register(){return ()=>{};}},on(){return ()=>{};},get(name){return name==='agentPresets'?{presetForSession:()=>selected}:undefined;},inject(names,fn){if(names.includes('systemPrompt'))return fn({systemPrompt:{section(value){section=value;}}});}};
  const dispose=apply(ctx,{});
  const context={agent:{session:{header:{agentPreset:'metaontic-agent-forge-video-director'}}}};
  assert.match(section.text(context),/本对话只做视频创作/);
  selected=null;assert.equal(section.text(context),'','current standard selection overrides original video header');
  selected='standard';assert.equal(section.text(context),'');
  selected='another-preset';assert.equal(section.text(context),'');
  assert.equal(section.text({}),'');dispose();
});

test('missing duration stops preparation before character choice and blocks script review',()=>fixture(async h=>{
 const p=await h.project.execute({action:'prepare',subjectType:'fixed_subject'},h.exec);
 assert.equal(p.status,'pending');assert.equal(h.asks,1);assert.equal(h.posts,0);
 await assert.rejects(h.review(p.projectId),/角色图|时长/);
}));
test('a prepared project must review the user-confirmed total duration',()=>fixture(async h=>{
 const p=await h.prepare();await h.show();
 await assert.rejects(h.project.execute({action:'review',projectId:p.projectId,scriptPath:h.script,toolName:'metaontic_agent_forge_video_generate',specification:{...h.spec,duration:10}},h.exec),/确认的总时长/);
}));

test('initial generation cannot omit the confirmed duration and fall back to 15 seconds',()=>fixture(async h=>{
 const p=await h.prepare();await h.review(p.projectId);const args={...h.spec,projectId:p.projectId};delete args.duration;
 await assert.rejects(h.tools.get('metaontic_agent_forge_video_generate').execute(args,h.exec),/已确认的视频时长/);assert.equal(h.posts,0);
}));

test('extension review rejects oversize seconds and accepts an explicit equal-length multisegment plan',()=>fixture(async h=>{
 h.config.model='seedance-2.5';h.spec.duration=45;
 const p=await h.prepare();
 await assert.rejects(h.review(p.projectId,{toolName:'metaontic_agent_forge_video_extend'}),/不会自动缩短/);
 h.spec.duration=15;h.spec.segments=3;
 assert.equal((await h.review(p.projectId,{toolName:'metaontic_agent_forge_video_extend'})).status,'approved');
 assert.equal(h.posts,0);
}));
