// Mocked API integration tests: no network or paid generation.
import assert from 'node:assert/strict';
import { test, after } from 'node:test';
import { build } from 'esbuild';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const temp = await mkdtemp(path.join(tmpdir(), 'metaontic-image-test-'));
await build({stdin:{contents:`
export {apply} from './src/index.ts';
export {runTask,buildGenerationBody,buildRequestBody} from './src/providers/seedance.ts';
export {prepareImageTool} from './src/tools/video-prepare-image.ts';
export {estimateUsage} from './src/workflow/costs.ts';
export {preflightGate,estimateArgsFor} from './src/workflow/approval.ts';
export {pickResumeOptions} from './src/workflow/resume.ts';
export {configTool} from './src/tools/video-config.ts';
export {reconcileSubmission} from './src/providers/submissions.ts';
`,resolveDir:process.cwd()},bundle:true,platform:'node',format:'esm',outfile:path.join(temp,'plugin.mjs')});
const api=await import(pathToFileURL(path.join(temp,'plugin.mjs')));
after(()=>rm(temp,{recursive:true,force:true}));
async function fixture(run) {
 const dir=await mkdtemp(path.join(temp,'case-'));
 const oldFetch=globalThis.fetch, oldHome=process.env.DSH_HOME;
 process.env.DSH_HOME=dir;
 const config={connectionMode:'metaontic',baseUrl:'https://relay.example',metaonticApiKey:'b',apiKey:'a',keyOrigin:'register',model:'video',outputDir:dir,ffmpegBinary:'/missing',ffprobeBinary:'/missing',pollIntervalMs:1,pollErrorRetries:1};
 const calls=[],tools=new Map(); let imageCount=0,videoCount=0;
 const flags={allow:'allowed-once',videoReject:true,imageFailAt:0,queryFailure:false,rejectRetry:false};
 let asks=0;
 const ctx={get:()=>({request:async()=>{asks++;return flags.allow;}}),tools:{register(t){tools.set(t.name,t);return ()=>{};}},inject(){},on(){return ()=>{};}};
 api.apply(ctx,config);
 globalThis.fetch=async(url,options={})=>{
  const body=options.body?JSON.parse(options.body):undefined;calls.push({url,body,key:options.headers?.Authorization});
  if(url.endsWith('/tasks/doubao'))return Response.json({task_id:'image-'+(++imageCount)});
  if(/\/v1\/tasks\/image-\d+\/artifacts$/.test(url))return Response.json({artifacts:[{type:'text',content_url:'https://example.com/text'},{type:'image',content_url:'https://example.com/cartoon-'+url.match(/image-(\d+)/)[1]+'.png'}]});
  if(/\/v1\/tasks\/image-\d+$/.test(url))return Response.json(Number(url.match(/image-(\d+)/)[1])===flags.imageFailAt?{status:'FAILED',fail_reason:'test failed'}:{status:'SUCCESS'});
  if(body){videoCount++;return Response.json({id:'video-'+videoCount});}
  if(flags.queryFailure)return Response.json({error:{message:'query failed'}},{status:400});
  return Response.json((url.endsWith('/video-1')&&flags.videoReject)||flags.rejectRetry?{status:'failed',error:{code:'InputImageSensitiveContentDetected.HumanFace',message:'rejected'}}:{status:'succeeded',content:{video_url:'https://example.com/video.mp4'}});
 };
 const body={model:'video',resolution:'720p',content:[{type:'text',text:'test'},{type:'image_url',image_url:{url:'https://example.com/original.png'},role:'first_frame'}]};
 const h={dir,config,calls,tools,ctx,flags,body,get asks(){return asks;},get images(){return imageCount;},get videos(){return videoCount;},exec:{agent:{}},read:async d=>JSON.parse(await readFile(path.join(d,'paused-plan.json'),'utf8'))};
 try {await run(h);} finally {globalThis.fetch=oldFetch;if(oldHome===undefined)delete process.env.DSH_HOME;else process.env.DSH_HOME=oldHome;}
}
for(const mode of ['metaontic']) test(`${mode}: convert, pause for review, then one durable video retry`,()=>fixture(async h=>{
 h.config.connectionMode=mode;
 const state={}; const saved=[];
 const progress={state,saveState:async()=>saved.push(JSON.parse(JSON.stringify(state))),ctx:h.ctx,exec:h.exec};
 const review=await api.runTask(h.config,h.body,undefined,progress);
 assert.equal(review.status,'review_required');assert.equal(h.videos,1);assert.equal(h.images,1);assert.equal(h.asks,1);
 assert.equal((await api.runTask(h.config,h.body,undefined,progress)).status,'review_required');assert.equal(h.videos,1);
 const completed=await api.runTask(h.config,h.body,undefined,{...progress,referenceImagesReviewed:true});
 assert.equal(completed.status,'succeeded');assert.equal(h.videos,2);
 await api.runTask(h.config,h.body,undefined,progress);assert.equal(h.videos,2);assert.equal(h.images,1);
 const imagePost=h.calls.find(c=>c.url.endsWith('/tasks/doubao'));
 assert.deepEqual(imagePost.body.image,['https://example.com/original.png']);assert.equal(imagePost.body.size,'2048x2048');assert.equal(imagePost.body.n,1);
 assert.equal(imagePost.key,'Bearer b');
 const retried=h.calls.filter(c=>c.body?.model==='video')[1].body;
 assert.equal(retried.content[1].role,'first_frame');assert.match(retried.content[1].image_url.url,/cartoon/);
 assert.ok(saved.some(s=>s.images&&Object.values(s.images).some(i=>i.taskId&&!i.imageUrl)));
 assert.ok(h.calls.every(c=>!c.url.includes('/images/generations')&&!c.url.includes('/tasks/doubao/')));
}));
for(const outcome of ['rejected','cancelled','unavailable']) test(`conversion ${outcome} never generates images or retries video`,()=>fixture(async h=>{
 h.flags.allow=outcome;const result=await api.runTask(h.config,h.body,undefined,{ctx:h.ctx,exec:h.exec});assert.equal(result.status,'failed');assert.equal(h.images,0);assert.equal(h.videos,1);
}));
test('partial conversion resumes existing image task and never redraws a completed image',()=>fixture(async h=>{
 h.body.content.push({type:'image_url',image_url:{url:'https://example.com/two.png'},role:'reference_image'});
 const originalFetch=globalThis.fetch;let secondQueries=0;
 globalThis.fetch=async(url,options)=>{
  if(url.endsWith('/tasks/image-2')&&++secondQueries===1)throw new Error('network');
  return originalFetch(url,options);
 };
 const state={},p={state,ctx:h.ctx,exec:h.exec,saveState:async()=>{}};
 const first=await api.runTask(h.config,h.body,undefined,p);assert.equal(first.status,'failed');assert.equal(h.images,2);
 assert.ok(Object.values(state.images).some(i=>i.imageUrl));assert.ok(Object.values(state.images).some(i=>i.taskId&&!i.imageUrl));
 assert.equal((await api.runTask(h.config,h.body,undefined,p)).status,'review_required');assert.equal(h.images,2);assert.equal(h.asks,1);
}));
test('known failed image stops across resume, and rejected video retry cannot convert again',()=>fixture(async h=>{
 const state={};h.flags.imageFailAt=1;const p={state,ctx:h.ctx,exec:h.exec,saveState:async()=>{}};
 await api.runTask(h.config,h.body,undefined,p);await api.runTask(h.config,h.body,undefined,p);assert.equal(h.images,1);
}));
test('video retry pending task resumes by query and never repeats conversion',()=>fixture(async h=>{
 const state={},p={state,ctx:h.ctx,exec:h.exec,saveState:async()=>{}};
 await api.runTask(h.config,h.body,undefined,p);h.flags.queryFailure=true;
 assert.equal((await api.runTask(h.config,h.body,undefined,{...p,referenceImagesReviewed:true})).status,'unknown');
 h.flags.queryFailure=false;h.flags.rejectRetry=true;
 assert.equal((await api.runTask(h.config,h.body,undefined,p)).status,'failed');
 await api.runTask(h.config,h.body,undefined,p);assert.equal(h.videos,2);assert.equal(h.images,1);
}));
test('full tool resume persists reference inputs and reviewed conversion state',()=>fixture(async h=>{
 const tool=h.tools.get('video_generate');
 const png=path.join(h.dir,'original.png');await writeFile(png,Buffer.from('89504e470d0a1a0a0000000000000000','hex'));
 const first=await tool.execute({prompt:'story',duration:5,firstFrameUrl:png,merge:false,resolution:'480p'},h.exec);
 assert.equal(first.status,'review_required');assert.equal(first.convertedReferences.length,1);
 const record=await h.read(first.resumeDir);assert.equal(record.options.firstFrameUrl,png);assert.equal(record.options.resolution,'480p');assert.equal(record.operationState[0].phase,'review');
 assert.ok(record.operationState[0].originalBody.content[1].image_url.url.startsWith('data:'));
 assert.ok(!JSON.stringify(record).includes('metaonticApiKey'));
 await rm(png);
 const again=await tool.execute({resume:first.resumeDir},h.exec);assert.equal(again.status,'review_required');assert.equal(h.videos,1);
 const completed=await tool.execute({resume:first.resumeDir,referenceImagesReviewed:true},h.exec);assert.equal(completed.status,'succeeded');assert.equal(h.videos,2);
 assert.equal(h.calls.filter(c=>c.body?.model==='video')[1].body.resolution,'480p');
}));
test('ordinary failed first segment resumes with original resolved references',()=>fixture(async h=>{
 h.flags.videoReject=false;const base=globalThis.fetch;
 globalThis.fetch=async(url,options)=>url.endsWith('/video-1')?Response.json({status:'failed',error:{message:'temporary generation failure'}}):base(url,options);
 const tool=h.tools.get('video_generate');
 const first=await tool.execute({prompt:'story',duration:5,referenceImages:['https://example.com/reference.png'],merge:false},h.exec);assert.equal(first.status,'failed');
 const second=await tool.execute({resume:first.resumeDir},h.exec);assert.equal(second.status,'succeeded');
 const last=h.calls.filter(c=>c.body?.model==='video').at(-1).body;assert.equal(last.content[1].image_url.url,'https://example.com/reference.png');
}));
test('uncertain image submission blocks duplicate POST and can link original task',()=>fixture(async h=>{
 let posts=0;const base=globalThis.fetch;
 globalThis.fetch=async(url,options)=>{if(options.method==='POST'){posts++;throw new Error('response lost');}return base(url,options);};
 const tool=api.prepareImageTool(h.config),args={image:'https://example.com/ref.png',style:'动画'};
 let submissionId;
 await assert.rejects(()=>tool.execute(args,{}),e=>{submissionId=e.submissionId;return e.code==='submission_unknown';});
 await assert.rejects(()=>tool.execute(args,{}),e=>e.code==='submission_unknown');assert.equal(posts,1);
 await api.reconcileSubmission(h.config,submissionId,'image-9',false);
 assert.equal((await tool.execute(args,{})).taskId,'image-9');assert.equal(posts,1);
}));
test('uncertain video POST is persisted and blocks a second charged submission',()=>fixture(async h=>{
 let posts=0;globalThis.fetch=async()=>{posts++;throw new Error('response lost');};
 const tool=h.tools.get('video_generate');
 const first=await tool.execute({prompt:'story',duration:5,merge:false},h.exec);assert.equal(first.status,'submission_unknown');assert.ok(first.submissionId);assert.ok(first.resumeDir);
 const second=await tool.execute({resume:first.resumeDir},h.exec);assert.equal(second.status,'submission_unknown');assert.equal(posts,1);
}));
test('connection and model changes during image task affect only the next call',()=>fixture(async h=>{
 const original=globalThis.fetch;
 globalThis.fetch=async(url,options)=>{const result=await original(url,options);if(options.method==='POST'){h.config.baseUrl='https://other.example';h.config.metaonticApiKey='changed';h.config.imageModel='doubao-seedream-5-0-pro-260628';}return result;};
 await api.prepareImageTool(h.config).execute({image:'https://example.com/ref.png',style:'动画'},{});
 assert.ok(h.calls.every(c=>c.url.startsWith('https://relay.example')&&c.key==='Bearer b'));
}));
test('480P/720P requests, estimates, defaults and validation agree',()=>fixture(async h=>{
 for(const resolution of ['480p','720p']){
  const g=await api.buildGenerationBody(h.config,{prompt:'test',resolution},5);
  const e=api.buildRequestBody(h.config,{prompt:'test',duration:5,resolution},'https://example.com/source.mp4');
  assert.equal(g.body.resolution,resolution);assert.equal(e.body.resolution,resolution);
  assert.equal(api.estimateUsage(h.config,'video_generate',{duration:5,resolution}).resolution,resolution);
 }
 assert.ok(api.estimateUsage(h.config,'video_generate',{duration:5,resolution:'480p'}).tokens<api.estimateUsage(h.config,'video_generate',{duration:5,resolution:'720p'}).tokens);
 h.config.resolution='480p';assert.equal((await api.buildGenerationBody(h.config,{prompt:'test'},5)).body.resolution,'720p');
 await assert.rejects(()=>api.buildGenerationBody(h.config,{prompt:'test',resolution:'1080p'},5),/480P/);
}));

for (const mode of ['metaontic']) test(`${mode}: independent image key covers submission, polling and artifacts without changing video key`,()=>fixture(async h=>{
 h.config.connectionMode=mode;h.config.imageUseVideoKey=false;h.config.imageApiKey='image-only';
 await api.prepareImageTool(h.config).execute({image:'https://example.com/ref.png',style:'动画'},{});
 assert.equal(h.calls.length,3);assert.ok(h.calls.every(c=>c.key==='Bearer image-only'));
 h.calls.length=0;h.flags.videoReject=false;
 await api.runTask(h.config,h.body,undefined,{state:{},saveState:async()=>{}});
 assert.ok(h.calls.length>=2);assert.ok(h.calls.every(c=>c.key===`Bearer ${mode==='service'?'a':'b'}`));
}));
test('missing independent image key stops before network and shared mode ignores stored image key',()=>fixture(async h=>{
 h.config.imageUseVideoKey=false;
 await assert.rejects(()=>api.prepareImageTool(h.config).execute({image:'https://example.com/ref.png',style:'动画'},{}),/单独填写/);
 assert.equal(h.calls.length,0);
 h.config.imageUseVideoKey=true;h.config.imageApiKey='unused';
 await api.prepareImageTool(h.config).execute({image:'https://example.com/ref.png',style:'动画'},{});
 assert.ok(h.calls.every(c=>c.key==='Bearer b'));
}));

test('service method carries image traffic with the service-issued key',()=>fixture(async h=>{
 h.config.connectionMode='service';
 await api.prepareImageTool(h.config).execute({image:'https://example.com/ref.png',style:'动画'},{});
 assert.ok(h.calls.length>=1);assert.ok(h.calls.every(c=>c.key==='Bearer a'));
}));

test('B recovery uses image key only for image traffic and video key for original/retry/status',()=>fixture(async h=>{
 h.config.imageUseVideoKey=false;h.config.imageApiKey='image-secret';h.config.volcengineApiKey='wrong-c';
 const progress={state:{},saveState:async()=>{},ctx:h.ctx,exec:h.exec};
 assert.equal((await api.runTask(h.config,h.body,undefined,progress)).status,'review_required');
 assert.equal((await api.runTask(h.config,h.body,undefined,{...progress,referenceImagesReviewed:true})).status,'succeeded');
 await h.tools.get('video_status').execute({taskId:'video-2'},h.exec);
 for(const c of h.calls) assert.equal(c.key,c.url.includes('/v1/tasks/')?'Bearer image-secret':'Bearer b');
}));
test('independent image task query and uncertain submission reconciliation retain image key',()=>fixture(async h=>{
 h.config.imageUseVideoKey=false;h.config.imageApiKey='image-secret';
 const original=globalThis.fetch;
 globalThis.fetch=async(url,opts)=>{if(opts.method==='POST')throw new Error('response lost');return original(url,opts);};
 let id;
 await assert.rejects(()=>api.prepareImageTool(h.config).execute({image:'https://example.com/ref.png',style:'动画'},{}),e=>{id=e.submissionId;return !!id;});
 await h.tools.get('media_submission').execute({action:'get',submissionId:id});
 h.config.imageApiKey='wrong';
 await assert.rejects(()=>h.tools.get('media_submission').execute({action:'reconcile',submissionId:id,taskId:'image-9'}),/原接入|原连接/);
 h.config.imageApiKey='image-secret';
 await h.tools.get('media_submission').execute({action:'reconcile',submissionId:id,taskId:'image-9'});
 await api.prepareImageTool(h.config).execute({taskId:'image-9'},{});
 assert.ok(h.calls.length>=3);assert.ok(h.calls.every(c=>c.key==='Bearer image-secret'));
}));
test('C video submission, polling and status use only Volcano key',()=>fixture(async h=>{
 h.config.connectionMode='volcengine';h.config.volcengineApiKey='volcano-only';h.config.imageApiKey='wrong-image';h.config.imageUseVideoKey=false;h.flags.videoReject=false;
 assert.equal((await api.runTask(h.config,h.body,undefined,{})).status,'succeeded');
 await h.tools.get('video_status').execute({taskId:'video-1'},h.exec);
 assert.ok(h.calls.every(c=>c.key==='Bearer volcano-only'&&c.url.startsWith('https://ark.cn-beijing.volces.com/')));
 await assert.rejects(()=>api.prepareImageTool(h.config).execute({taskId:'image-1'},{}),/火山直连暂不提供/);
}));
test('B independent image key snapshot survives settings edits during submission',()=>fixture(async h=>{
 h.config.imageUseVideoKey=false;h.config.imageApiKey='original-image';const original=globalThis.fetch;
 globalThis.fetch=async(url,opts)=>{const result=await original(url,opts);if(opts.method==='POST'){h.config.imageApiKey='changed';h.config.imageUseVideoKey=true;h.config.metaonticApiKey='changed-video';}return result;};
 await api.prepareImageTool(h.config).execute({image:'https://example.com/ref.png',style:'动画'},{});
 assert.ok(h.calls.every(c=>c.key==='Bearer original-image'));
}));
for(const mode of ['service','metaontic','volcengine']) test(`${mode}: missing video key never falls back to another model key`,()=>fixture(async h=>{
 h.config.connectionMode=mode;h.config.imageApiKey='not-video';
 h.config[mode==='service'?'apiKey':mode==='metaontic'?'metaonticApiKey':'volcengineApiKey']='';
 await assert.rejects(()=>h.tools.get('video_generate').execute({prompt:'test',duration:5,merge:false},h.exec),/Key/);
 assert.equal(h.calls.length,0);
}));

for (const toolName of ['video_generate', 'video_extend']) test(`${toolName}: 30s resume approval, estimate and both requests retain 480p`,()=>fixture(async h=>{
 h.flags.videoReject=false;
 const tool=h.tools.get(toolName);
 const initial={prompt:'story',segmentPrompts:['first scene','second scene'],merge:false,resolution:'480p'};
 const first=await tool.execute(toolName==='video_generate'?{...initial,duration:30}:{...initial,videoUrl:'https://example.com/source.mp4',duration:15,segments:2},h.exec);
 assert.equal(first.paused,true);
 assert.equal(h.videos,1);
 const args={resume:first.resumeDir};
 const gate=await api.preflightGate(h.ctx,h.config,{...h.exec,name:toolName,arguments:args});
 assert.equal(gate.kind,'ask');
 for(const text of [gate.reason,gate.displayReason.zh,gate.displayReason.en]) {
  assert.match(text,/480p/i);assert.doesNotMatch(text,/720p/i);
 }
 const prepared=await api.estimateArgsFor(h.config,toolName,args);
 assert.equal(prepared.resolution,'480p');
 assert.equal(api.estimateUsage(h.config,toolName,prepared,prepared.remainingPlan.slice(0,1)).resolution,'480p');
 const second=await h.tools.get(toolName).execute(args,h.exec);
 assert.equal(second.status,'succeeded');
 assert.equal(h.videos,2);
 assert.deepEqual(h.calls.filter(c=>c.body?.model==='video').map(c=>c.body.resolution),['480p','480p']);
}));

test('speech instructions reach generation and both extension directions without rewriting reviewed dialogue',()=>fixture(async h=>{
 const prompt='女孩用普通话说{欢迎来到吃龙山。}字幕为〖欢迎来到螭龙山。〗';
 const args={prompt,resolution:'480p',duration:5};
 const generated=await api.buildGenerationBody(h.config,args,5);
 for(const result of [generated,...['forward','backward'].map(direction=>api.buildRequestBody(h.config,{...args,direction},'https://example.com/source.mp4'))]) {
  const text=result.body.content.find(c=>c.type==='text').text;
  assert.ok(text.includes(prompt));
  assert.match(text,/一人说完另一人再接/);
  assert.match(text,/不为赶时长加速、吞字或截断/);
  assert.match(text,/展示原文只用于已要求的字幕/);
 }
 assert.equal(args.prompt,prompt);
 const silent=await api.buildGenerationBody(h.config,{prompt:'风景空镜，无对白',generateAudio:false},5);
 assert.equal(silent.body.generate_audio,false);
 assert.match(silent.body.content[0].text,/无对白时不新增人声/);
}));

for(const connectionMode of ['service','metaontic','volcengine']) test(`${connectionMode}: reviewed transition enters the native video request without a new API parameter`,()=>fixture(async h=>{
 h.config.connectionMode=connectionMode;h.config.volcengineApiKey='c';
 const transition='承接视频1中男子放下茶杯的动作，切到女子近景，环境声连续。';
 const {body}=api.buildRequestBody(h.config,{prompt:'镜头1：女子抬头说{我知道了。}',duration:15,resolution:'480p',mode:'continuous',transitionDescription:transition},'https://example.com/source.mp4');
 const text=body.content.find(c=>c.type==='text').text;
 assert.ok(text.includes(transition));assert.doesNotMatch(text,/参考\s*视频\s*1/);
 assert.equal(body.transitionDescription,undefined);assert.equal(body.resolution,'480p');
 assert.equal(body.content.find(c=>c.type==='video_url').role,'reference_video');
}));

for(const toolName of ['video_generate','video_extend']) test(`${toolName}: approved transition survives pause and resume without another submission`,()=>fixture(async h=>{
 h.flags.videoReject=false;
 const transition='承接视频1末尾的点头动作，切到女子中景，原配乐连续。';
 const initial={prompt:'镜头1：人物缓慢抬头回应。',segmentPrompts:['镜头1：男子放下茶杯。','镜头1：女子抬头回应。'],transitionDescription:transition,merge:false,resolution:'480p'};
 const first=await h.tools.get(toolName).execute(toolName==='video_generate'?{...initial,duration:30}:{...initial,videoUrl:'https://example.com/source.mp4',duration:15,segments:2},h.exec);
 assert.equal(first.paused,true);
 const record=JSON.parse(await readFile(path.join(first.resumeDir,'paused-plan.json'),'utf8'));
 assert.equal(record.options.transitionDescription,transition);
 const result=await h.tools.get(toolName).execute({resume:first.resumeDir},h.exec);
 assert.equal(result.status,'succeeded');assert.equal(h.videos,2);
 const bodies=h.calls.filter(c=>c.body?.model==='video').map(c=>c.body);
 assert.ok(bodies[1].content.find(c=>c.type==='text').text.includes(transition));
 if(toolName==='video_generate') assert.ok(!bodies[0].content[0].text.includes(transition));
}));
for(const toolName of ['video_generate','video_extend']) test(`${toolName}: invalid transition is rejected before any paid submission`,()=>fixture(async h=>{
 h.flags.videoReject=false;
 await assert.rejects(h.tools.get(toolName).execute({prompt:'story',duration:30,segmentPrompts:['first','second'],videoUrl:'https://example.com/source.mp4',transitionDescription:{invalid:true},merge:false},h.exec),/过渡描述必须是文字/);
 assert.equal(h.videos,0);assert.equal(h.calls.length,0);
}));

test('legacy global continuation mode does not override new script requests',()=>fixture(async h=>{
 h.config.mode='closeup';
 const plain=api.buildRequestBody(h.config,{prompt:'人物继续说话',duration:15},'https://example.com/source.mp4').body.content[0].text;
 assert.match(plain,/保持同一构图/);assert.doesNotMatch(plain,/下一位说话人的近景/);
 const scripted=api.buildRequestBody(h.config,{prompt:'人物继续说话',duration:15,mode:'closeup'},'https://example.com/source.mp4').body.content[0].text;
 assert.match(scripted,/下一位说话人的近景/);
}));
test('video_config no longer exposes or saves a global continuation mode',()=>fixture(async h=>{
 let writes=0;
 const tool=api.configTool(h.config,{mutate(){writes++;}});
 assert.equal(tool.parameters.properties.mode,undefined);
 await assert.rejects(tool.execute({action:'set',mode:'closeup'}),/续拍方式由已审核脚本决定/);
 assert.equal(writes,0);
}));
for(const toolName of ['video_generate','video_extend']) test(`${toolName}: resume retains script continuation mode after global config changes`,()=>fixture(async h=>{
 h.flags.videoReject=false;h.config.mode='continuous';
 const initial={prompt:'人物继续说话',segmentPrompts:['第一段新动作','第二段新对白'],mode:'closeup',merge:false};
 const first=await h.tools.get(toolName).execute(toolName==='video_generate'?{...initial,duration:30}:{...initial,videoUrl:'https://example.com/source.mp4',duration:15,segments:2},h.exec);
 const record=JSON.parse(await readFile(path.join(first.resumeDir,'paused-plan.json'),'utf8'));assert.equal(record.options.mode,'closeup');
 h.config.mode='continuous';
 await h.tools.get(toolName).execute({resume:first.resumeDir},h.exec);
 assert.equal(h.videos,2);const bodies=h.calls.filter(c=>c.body?.model==='video').map(c=>c.body);
 assert.match(bodies[1].content[0].text,/下一位说话人的近景/);
}));

for(const resolution of ['480p','720p']) test(`script and approval continuation estimates agree at ${resolution}`,()=>fixture(async h=>{
 h.config.model='doubao-seedance-2-0-mini-260615';h.config.estimateGroupRatio=1;
 const script=await h.tools.get('video_estimate').execute({duration:30,resolution,ratio:'16:9',groupRatio:1});
 const gate=api.estimateUsage(h.config,'video_generate',{duration:30,resolution});
 assert.deepEqual(gate.segments.map(s=>s.inputSeconds),[0,15]);
 assert.deepEqual(gate.segments.map(s=>s.tokens),script.plugin.segments.map(s=>s.tokens));
 assert.ok(Math.abs(gate.usd*7.3-script.plugin.cny)<0.0001);
}));

for(const mode of ['metaontic','volcengine']) test(`${mode}: initial character images persist through all four 60s segments and resume`,()=>fixture(async h=>{
 h.flags.videoReject=false;h.config.connectionMode=mode;h.config.volcengineApiKey='c';
 const tool=h.tools.get('video_generate');
 const images=['https://example.com/face.png','https://example.com/body.png'];
 let result=await tool.execute({prompt:'同一主角',duration:60,resolution:'480p',referenceImages:images,segmentPrompts:['one','two','three','four'],merge:false},h.exec);
 for(let i=0;i<3;i++){
  assert.equal(result.paused,true);
  const record=await h.read(result.resumeDir);
  assert.deepEqual(record.characterReferences.map(item=>item.image_url.url),images);
  result=await tool.execute({resume:result.resumeDir},h.exec);
 }
 assert.equal(result.status,'succeeded');assert.equal(h.videos,4);
 const posts=h.calls.filter(c=>c.body?.content);
 for(const post of posts){
  assert.deepEqual(post.body.content.filter(x=>x.type==='image_url').map(x=>x.image_url.url),images);
 }
 for(const post of posts.slice(1)){
  assert.ok(post.body.content.some(x=>x.role==='reference_video'));
  assert.ok(post.body.content.filter(x=>x.type==='image_url').every(x=>x.role==='reference_image'));
  assert.match(post.body.content[0].text,/固定主体外观/);
 }
 assert.equal(h.images,0);
}));

test('video_extend carries explicitly selected character images through resume',()=>fixture(async h=>{
 h.flags.videoReject=false;
 const tool=h.tools.get('video_extend');
 const images=['https://example.com/face.png'];
 let result=await tool.execute({prompt:'角色继续说话',videoUrl:'https://example.com/input.mp4',duration:5,segments:2,characterReferenceImages:images,merge:false},h.exec);
 assert.equal(result.paused,true);result=await tool.execute({resume:result.resumeDir},h.exec);
 assert.equal(result.status,'succeeded');
 for(const call of h.calls.filter(c=>c.body?.content))assert.deepEqual(call.body.content.filter(x=>x.type==='image_url').map(x=>x.image_url.url),images);
 assert.equal(h.images,0);
}));

test('first-frame source becomes reference_image in continuation, without first_frame/video mixing',()=>fixture(async h=>{
 h.flags.videoReject=false;
 const tool=h.tools.get('video_generate');
 const first=await tool.execute({prompt:'主角',duration:20,segmentPrompts:['one','two'],firstFrameUrl:'https://example.com/face.png',merge:false},h.exec);
 await tool.execute({resume:first.resumeDir},h.exec);
 const posts=h.calls.filter(c=>c.body?.content);
 assert.equal(posts[0].body.content.find(x=>x.type==='image_url').role,'first_frame');
 assert.equal(posts[1].body.content.find(x=>x.type==='image_url').role,'reference_image');
}));

test('approved converted character image is reused by subsequent segments without another image call',()=>fixture(async h=>{
 const tool=h.tools.get('video_generate');
 const initial=await tool.execute({prompt:'角色',duration:20,segmentPrompts:['one','two'],referenceImages:['https://example.com/real.png'],merge:false},h.exec);
 assert.equal(initial.status,'review_required');assert.equal(h.images,1);
 const reviewed=await tool.execute({resume:initial.resumeDir,referenceImagesReviewed:true},h.exec);
 assert.equal(reviewed.paused,true);
 const saved=await h.read(reviewed.resumeDir);
 assert.equal(saved.characterReferences[0].image_url.url,'https://example.com/cartoon-1.png');
 const final=await tool.execute({resume:reviewed.resumeDir},h.exec);
 assert.equal(final.status,'succeeded');assert.equal(h.images,1);
 const last=h.calls.filter(c=>c.body?.content).at(-1).body;
 assert.equal(last.content.find(x=>x.type==='image_url').image_url.url,'https://example.com/cartoon-1.png');
}));

for(const shared of [true,false]) test(`text character image creates no video and uses correct image key (shared=${shared})`,()=>fixture(async h=>{
 h.config.imageUseVideoKey=shared;h.config.imageApiKey='image-only';
 const before=await api.preflightGate(h.ctx,h.config,{...h.exec,name:'video_prepare_image',arguments:{operation:'create_character',prompt:'青年角色',style:'二维动画'}});
 assert.equal(before.kind,'ask');assert.match(before.displayReason.zh,/单独计费/);
 const image=await api.prepareImageTool(h.config).execute({operation:'create_character',prompt:'短发青年，蓝色衬衫',style:'二维动画'},h.exec);
 assert.equal(image.reviewRequired,true);assert.equal(h.videos,0);
 const post=h.calls.find(x=>x.url.endsWith('/tasks/doubao'));assert.equal(post.body.image,undefined);assert.match(post.body.prompt,/短发青年/);
 assert.equal(post.key,shared?'Bearer b':'Bearer image-only');
 await api.prepareImageTool(h.config).execute({taskId:image.taskId},h.exec);assert.equal(h.images,1);
}));

test('role image approval rejection and non-interactive mode do not auto-generate',()=>fixture(async h=>{
 h.ctx.get=()=>({config:{policy:'never'}});
 const decision=await api.preflightGate(h.ctx,h.config,{...h.exec,name:'video_prepare_image',arguments:{operation:'create_character',prompt:'人物',style:'动画'}});
 assert.equal(decision.kind,'deny');assert.equal(h.images,0);assert.equal(h.videos,0);
}));

test('created and reviewed role image is used for initial video and continuation',()=>fixture(async h=>{
 h.flags.videoReject=false;
 const image=await api.prepareImageTool(h.config).execute({operation:'create_character',prompt:'青年角色',style:'动画'},h.exec);
 const tool=h.tools.get('video_generate');const references=[image.imageUrl];
 const first=await tool.execute({prompt:'角色自我介绍',duration:20,segmentPrompts:['one','two'],referenceImages:references,characterReferenceImages:references,merge:false},h.exec);
 await tool.execute({resume:first.resumeDir},h.exec);
 assert.equal(h.images,1);assert.equal(h.videos,2);
 for(const post of h.calls.filter(x=>x.body?.content))assert.deepEqual(post.body.content.filter(x=>x.type==='image_url').map(x=>x.image_url.url),references);
}));

test('actual video preflight asks the character choice before payment and never submits when image creation is chosen',()=>fixture(async h=>{
 let asked=0;const prior=h.ctx.get;
 h.ctx.get=name=>name==='userQuestions'?{ask:async req=>{asked++;return {answers:[{id:req.questions[0].id,selected:['先生成角色图（单独计费）']}]};}}:prior(name);
 const decision=await api.preflightGate(h.ctx,h.config,{...h.exec,agent:{session:{id:'real-gate-test'}},name:'video_generate',arguments:{prompt:'新角色',duration:15,merge:false,resolution:'480p'}});
 assert.equal(decision.kind,'deny');assert.match(decision.reason,/video_prepare_image/);assert.equal(asked,1);assert.equal(h.videos,0);assert.equal(h.images,0);
}));

test('realistic character image uses photography prompt and truthful paid approval',()=>fixture(async h=>{
 const args={operation:'create_character',prompt:'短发青年，蓝色衬衫',style:'真人写实',characterType:'realistic'};
 const gate=await api.preflightGate(h.ctx,h.config,{...h.exec,name:'video_prepare_image',arguments:args});
 assert.equal(gate.kind,'ask');assert.match(gate.displayReason.zh,/真人写实/);assert.match(gate.displayReason.zh,/单独计费/);
 const result=await api.prepareImageTool(h.config).execute(args,h.exec);
 const post=h.calls.find(x=>x.url.endsWith('/tasks/doubao'));
 assert.match(post.body.prompt,/真人写实摄影/);assert.doesNotMatch(post.body.prompt,/不要输出摄影|采用明显的非真人/);
 assert.equal(result.reviewRequired,true);assert.equal(h.images,1);assert.equal(h.videos,0);
 await api.prepareImageTool(h.config).execute({taskId:result.taskId},h.exec);assert.equal(h.images,1);
}));
test('default character remains stylized and realistic option is listed first',()=>fixture(async h=>{
 const tool=api.prepareImageTool(h.config);
 assert.deepEqual(tool.parameters.properties.characterType.enum,['realistic','stylized']);
 await tool.execute({operation:'create_character',prompt:'青年',style:'二维动画'},h.exec);
 assert.match(h.calls.find(x=>x.url.endsWith('/tasks/doubao')).body.prompt,/明显的非真人/);
}));
test('realistic type cannot bypass non-realistic reference conversion',()=>fixture(async h=>{
 const args={operation:'convert_reference',image:'https://example.com/ref.png',style:'真人写实',characterType:'realistic'};
 const gate=await api.preflightGate(h.ctx,h.config,{...h.exec,name:'video_prepare_image',arguments:args});
 assert.equal(gate.kind,'deny');
 await assert.rejects(()=>api.prepareImageTool(h.config).execute(args,h.exec),/必须使用非真人/);
 assert.equal(h.images,0);assert.equal(h.videos,0);
}));
