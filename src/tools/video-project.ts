import { validateExtensionDuration } from '../workflow/planning.js';
import { ensureProjectDuration } from '../workflow/duration-choice.js';
import { readFile } from 'node:fs/promises';
import { estimatePlan } from '../workflow/costs.js';
import { resolveSegmentPrompts } from '../workflow/planning.js';
import path from 'node:path';
import { createProject, readProject, writeProject, lockProject, productionFingerprint, scriptDigest, hasProjectImages } from '../workflow/project.js';
import { characterChoiceGate } from '../workflow/character-choice.js';
import { resumeDirOf } from '../workflow/resume.js';
import { approvalPolicy } from '../workflow/approval.js';

/** 真实用户答复只由宿主 userQuestions 获取，不接受助手提交 approved:true。 */
export function projectTool(config, ctx, reviewGuard, generationProperties, extensionProperties, segmentReview = null) {
  return {
    name: 'video_project',
    description: '先在完善创意的同一轮合并询问时长、画幅和清晰度，用户回答后prepare创建独立projectId并传已确认duration，决定角色图路线。原始需求未写时长但已在完善创意中回答，也必须传确认的duration，禁止省略造成重复询问；只有从未确认时长才由工具兜底询问，未答不继续，禁止自行默认15秒。scenery仅用于无固定主体空镜，fixed_subject用于需要固定外形的人物/主体。角色图选择绑定项目不随提示词改变。脚本、分镜、逐段生成提示词及完整制作参数准备后，正文完整展示，再review弹本版脚本审核（同版已通过不重复，改稿需重审）；通过后直接调用对应生成工具，工具付费审批即开始制作确认，不另弹开始制作问题。改稿或参数改变须review，status只读取真实状态。每段完成后先展示视频，再调用review_segment并传resume弹结果确认窗；这不属于重复制作确认，禁止跳过。不会生成或扣费。',
    parameters: { type: 'object', properties: {
      resume: { type: 'string', description: 'review_segment审核已完成分段，传原resumeDir；先正文展示视频，再调用本动作弹结果确认窗。' },
      action: { type: 'string', enum: ['prepare', 'review', 'status', 'review_segment'] }, projectId: { type: 'string' },
      duration: { type: 'integer', description: 'prepare时仅传用户已明确指定或回答确认的目标总秒数（4–120）；原始需求未写但已在完善创意中回答也必须传值；同项目沿用已保存值，只有从未确认才省略。续拍指本次新增的总秒数，不是每段时长。' },
      subjectType: { type: 'string', enum: ['fixed_subject', 'scenery', 'provided_images'] },
      resetCharacterChoice: { type: 'boolean', description: '仅用户明确改变角色图路线时传true' },
      toolName: { type: 'string', enum: ['video_generate', 'video_extend'] },
      scriptPath: { type: 'string', description: '完整脚本文件路径；审核后不要改写状态标记，真实审核状态由插件保存' },
      specification: { type: 'object', properties: { ...extensionProperties, ...generationProperties }, description: '之后生成调用的完整参数，不含projectId；续做改稿需包含原resume；含prompt、逐段segmentPrompts、素材、duration、ratio、resolution等' },
    }, required: ['action'] },
    output: { schema: { type: 'object' }, render(_args, value) { return [{ type: 'text', text: JSON.stringify(value) }]; } },
    timeoutMs: 600000,
    isConcurrencySafe() { return false; },
    async execute(args, exec) {
      if (args.action === 'review_segment') {
        if (!segmentReview) throw new Error('结果审核服务不可用');
        return segmentReview.review(args, exec);
      }
      if (args.action === 'status') {
        const data = await readProject(args.projectId, exec);
        const current = data.approved && await scriptDigest(data.approved.scriptPath).catch(() => '') === data.approved.scriptHash
          && productionFingerprint(config, data.approved.name, data.approved.specification) === data.approved.fingerprint;
        return { projectId: data.id, subjectType: data.subjectType, choice: data.choice, duration: data.duration, status: current ? 'approved' : 'draft' };
      }
      if (!['prepare', 'review'].includes(args.action)) throw new Error('未知项目操作');
      let data = args.projectId ? await readProject(args.projectId, exec) : null;
      if (!data) {
        if (args.action !== 'prepare' || !['fixed_subject', 'scenery', 'provided_images'].includes(args.subjectType)) throw new Error('先prepare并明确subjectType。');
        data = await createProject(exec, args.subjectType);
      }
      return lockProject(data.id, async () => {
        data = await readProject(data.id, exec);
        if (args.action === 'prepare') {
          if (args.subjectType && args.subjectType !== data.subjectType) throw new Error('新主体方案请创建新项目，不覆盖原项目。');
          const length = await ensureProjectDuration(ctx, exec, data, args.duration, writeProject);
          if (length.status !== 'confirmed') return { projectId: data.id, status: 'pending', nextAction: length.reason };
          if (args.resetCharacterChoice) { data.choice = ''; data.approved = null; await writeProject(data); }
          if (data.subjectType === 'scenery' || data.subjectType === 'provided_images') {
            data.choice = data.subjectType === 'scenery' ? 'not_needed' : 'provided_images'; await writeProject(data);
            return { projectId: data.id, status: 'prepared', duration: data.duration, choice: data.choice };
          }
          const gate = await characterChoiceGate(ctx, config, { ...exec, name: 'video_generate' }, { projectId: data.id, preparation: true, resetCharacterChoice: args.resetCharacterChoice });
          const saved = await readProject(data.id, exec);
          return { projectId: data.id, duration: data.duration, choice: saved.choice, status: saved.choice ? 'prepared' : 'pending', nextAction: gate?.reason || '编写脚本与分镜，完成后review。' };
        }
        const spec = args.specification;
        const allowed = new Set(Object.keys(args.toolName === 'video_extend' ? extensionProperties : generationProperties));
        if (spec && Object.keys(spec).some(k => !allowed.has(k))) throw new Error('specification只能包含对应生成工具的公开参数，禁止凭据或未知字段。');
        if (!spec || !spec.prompt || !spec.duration || !spec.ratio || !spec.resolution || spec.projectId) throw new Error('review需完整specification：prompt、duration、ratio、resolution，不能包含projectId。');
        if (!data.choice) throw new Error('角色图选择未完成，请先prepare。');
        if (['generate_first', 'provided_images'].includes(data.choice) && !hasProjectImages(spec)) throw new Error('先提供角色图并展示审核，再提交带图specification。');
        const name = args.toolName || 'video_generate';
        if (!['video_generate', 'video_extend'].includes(name)) throw new Error('未知生成工具');
        if (data.duration == null) throw new Error('视频总时长尚未确认，请先prepare询问用户，不得默认15秒。');
        if (name === 'video_extend') validateExtensionDuration(config, spec);
        const requestedTotal = name === 'video_extend' ? Number(spec.duration) * Number(spec.segments || 1) : Number(spec.duration);
        if (requestedTotal !== data.duration && !spec.resume) throw new Error('脚本时长与用户确认的总时长不一致，请先用prepare确认变更，再重新审核。');
        const scriptPath = path.resolve(exec.agent.session.header?.cwd || process.cwd(), String(args.scriptPath || ''));
        if (!/\.md$/i.test(scriptPath)) throw new Error('scriptPath需为Markdown脚本文件。');
        const scriptHash = await scriptDigest(scriptPath);
        const scriptBody = (await readFile(scriptPath, 'utf8')).replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '').trim();
        if (!scriptBody) throw new Error('脚本正文不能为空。');
        if (name === 'video_generate' && !spec.resume) resolveSegmentPrompts(spec.segmentPrompts, estimatePlan(config, name, spec).length);
        const fingerprint = productionFingerprint(config, name, spec);
        const gate = await reviewGuard.gate({ ...exec, name: 'ask_user_question', arguments: { requireStoryboard: true, requiredScriptText: scriptBody, questions: [{ id: 'script_review', question: '审核当前脚本' }] } });
        if (gate) return { projectId: data.id, status: 'blocked', reason: gate.reason };
        const service = ctx.get?.('userQuestions') || exec.agent?.ctx?.get?.('userQuestions');
        if (!service?.ask || approvalPolicy(ctx, exec) === 'never') return { projectId: data.id, status: 'pending', reason: '无法取得脚本审核答复，未生成。' };
        data.approved = null; await writeProject(data);
        const result = await service.ask({ agent: exec.agent, signal: exec.signal, ...(exec.callId ? { wait: { callId: exec.callId } } : {}), questions: [{ id: 'script_review', header: '脚本审核', question: '请审核刚展示的本版脚本、分镜、角色图及费用预估。是否通过？通过后仍会单独确认视频调用费用。', multiSelect: false, options: [{ label: '脚本通过', description: '使用本版材料，下一步确认视频制作费用。' }, { label: '需要修改', description: '先修改并重新展示审核，不生成。' }] }] });
        const answer = result?.answers?.find(a => a.id === 'script_review');
        if (exec.signal?.aborted || answer?.custom || answer?.selected?.length !== 1 || answer.selected[0] !== '脚本通过') return { projectId: data.id, status: 'draft', reason: '未取得审核通过，未生成。' };
        if (await scriptDigest(scriptPath) !== scriptHash || productionFingerprint(config, name, spec) !== fingerprint) throw new Error('等待审核期间材料或配置改变，请重新展示审核。');
        data.approved = { scriptPath, scriptHash, fingerprint, specification: spec, name, resumeDir: resumeDirOf(spec.resume), reviewedAt: new Date().toISOString() };
        await writeProject(data);
        return { projectId: data.id, status: 'approved', nextAction: `直接调用${name}并带projectId和本次specification；工具付费审批承担制作确认，不再另问一次。` };
      });
    },
  };
}
