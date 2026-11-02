import { initialCharacterReferences, approvedCharacterReferences } from '../workflow/character-references.js';
/** tools/video-generate：从宿主入口拆出的独立职责模块。 */
import { MAX_TOTAL_SECONDS, MAX_SEGMENTS, CONTENT_REJECTION_HINT, resolveResolution } from '../config.js';
import { modelMaxSeconds, resolveTargetPlan, resolveSegmentPrompts } from '../workflow/planning.js';
import { VIDEO_SEGMENT_OUTPUT_SCHEMA, renderVideoResult } from './results.js';
import { snapshotConfig, resolveApiKey, assertConfigured, isOmniExtendModel, resolveModel } from '../providers/connection.js';
import { assertResumeConnection, saveProgress, resumeDirOf, readPauseFile, resumePlanFrom, pickResumeOptions, resumeHint } from '../workflow/resume.js';
import { abortError } from '../utils/errors.js';
import { buildSegmentExecutionPrompt } from '../prompts/generation.js';
import { buildGenerationBody, buildRequestBody, runTask, normalizeReferenceUrl } from '../providers/seedance.js';
import { resolveOutputDir, allocateStamp, fileStamp } from '../utils/files.js';
import { appendRequestLog } from '../utils/logging.js';
import { downloadSegmentsAndMerge } from '../media/merge.js';

export function videoTool(liveConfig, deps, ctx) {
  const config = liveConfig;
  // 结果里的「接着做要调哪个工具」和确认框里的工具名都用它
  const TOOL_NAME = 'video_generate';
  return {
    name: 'video_generate',
    description:
      '生成一段完整视频（视频生成的首选工具），duration 是目标总秒数：'
      + '不超过模型单段上限（2.0 为 15 秒、2.5 为 30 秒）时一次直出；'
      + '**硬规则：总时长 ≤ 单段上限的视频必须一次直出，禁止拆成多段 / 多镜 / 多次调用再拼接**'
      + '（例如「15 秒」不许拆成 8+7）；按故事选择一镜到底或少量有动机的切镜，并写入待审核脚本；叙事切镜不等于拆分生成任务。'
      + `更长时先直出首段，再把剩余时长按 4 至模型上限（2.0 为 15、2.5 为 30） 秒均分逐段续拍（默认吃满上限、段数最少，最长 `
      + `${MAX_TOTAL_SECONDS} 秒）——`
      + '这是连续剧情的续拍延长，生成分段本身不代表叙事切镜，'
      + '最后用 ffmpeg 合并成一个本地成片文件，默认落在会话工作目录下的 metaontic-video/，'
      + '文件名形如 20261027-201530-25s.mp4。20 秒、25 秒这类目标不用拆成多个任务：'
      + '直接传 duration=20 即可（20 秒 → 15+5，25 秒 → 15+10）。'
      + '**每段生成完先返回视频供预览**：先展示成果，再询问是否继续；未确认就停下，'
      + '先把已经生成的部分交付，结果里带 paused=true、resumeDir 和 remainingSeconds；'
      + '之后用户说「继续」时，把 resumeDir 原样传给 video_generate 的 resume 参数接着做'
      + '（前面几段不重新生成、不重复扣费），不要从头再生成一遍、也不要改用 video_extend 拼。'
      + '每次调用最多完成当前一段；后续必须使用resume，不重新创建首段任务。'
      + '返回每段任务 ID、上游链接和成片路径。生成通常需要几分钟（每段单独生成），'
      + '单次调用返回 timeout、或某段返回 unknown（查询失败、任务其实已提交）时，'
      + '都用返回的任务 ID 走 video_status 继续等，不要重复提交新任务——'
      + '重复提交会重复扣费，查询失败不代表没有生成。'
      + '**调用前必须先完整展示当前版脚本、再让用户审核通过，并确认开始制作**（两道确认缺一不可），不要跳过脚本直接生成。'
      + '合并需要本机有 ffmpeg。本机没装 ffmpeg 时，插件会**先把这次调用拦回来（不会调用模型、'
      + '不产生费用）**，返回的说明里带着按系统给的安装命令 ——这时要在对话框里和用户确认：'
      + '问他要不要现在装 ffmpeg（给出他系统的命令，说明装好重跑就会自动合并、分段不用重新生成），'
      + '同意就调用 video_setup（install:true），宿主确认后安装并自动验证，然后按同样的 duration 重发；'
      + '用户不想装就带 merge:false 重发，插件只返回分段列表（每段上游链接 + 本地文件）。'
      + '拿到 ffmpegMissing=true 的结果时也要照 installHint 引导安装，别只丢一句「已跳过合并」。'
      + '**人物形象 / 参考图**：公网图片 URL、base64（data URI 或纯 base64）、本机图片路径，'
      + '或简写 `latest` 都支持——要固定人物长相、服装、场景时传 referenceImages，按数组顺序逐张提交并以图片1、图片2等指代；'
      + '首帧 / 尾帧用 firstFrameUrl / lastFrameUrl 传。公网 URL 直接交给中转站取图；本地图片由插件读进来'
      + '（按 ratio 先适配画幅）内联成 image_url 发给中转站，用户不需要自己找图床。'
      + '**用户说「就用我刚上传/刚拖进来的那张图」时直接传 `latest`**（`latest:2` 取第 2 新的）：'
      + '插件会去 Harness 附件库里找最近 2 小时上传的图片——哪怕当前聊天模型不支持图片、'
      + '附件被 `MODEL_DOES_NOT_SUPPORT_IMAGES` 拦下，图片本身也已经落盘，照样能用。'
      + '别在这时说「我看不到图片」，也别让用户自己去找路径。',
    parameters: {
      type: 'object',
      properties: {
        characterReferenceImages: { type: 'array', items: { type: 'string' }, description: '已审核的最初角色参考图，按固定顺序用于每段续拍；未提供时沿用首段参考图或首帧。支持URL、本地图片或data URI。断点固定此套图，不自动重画或替换。真人转换仍需单独同意及结果审核。' },
        prompt: {
          type: 'string',
          description: '精简的本段内容或全片创意概要，不传完整剧本。超过模型上限时必须另传segmentPrompts，每段分别写新动作与对白。',
        },
        duration: {
          type: 'integer',
          minimum: 4,
          maximum: 120,
          description:
            '目标总时长（秒）。不超过模型单段上限（2.0 为 15、2.5 为 30）时就一次直出（整条视频只生成一次，'
            + '禁止拆成多段/多镜再拼）；超过就先直出上限长度再逐段延长，最后合并。'
            + `单条成片最长 ${MAX_TOTAL_SECONDS} 秒（最多 ${MAX_SEGMENTS} 段），更长的目标按 `
            + `${MAX_TOTAL_SECONDS} 秒执行并在 note 里说明，不要反复重试更大的时长。`,
        },
        firstFrameUrl: {
          type: 'string',
          description: '可选：首帧图，公网 URL、base64 或本机图片路径（含对话里 @ 引用的上传文件）都行，'
            + '作为生成的首帧参考；本机图片会按 ratio 先适配到目标画幅再提交。',
        },
        lastFrameUrl: {
          type: 'string',
          description: '可选：尾帧图，公网 URL、base64 或本机图片路径都行，作为生成的尾帧参考。',
        },
        segmentPrompts: {
          type: 'array', items: { type: 'string', minLength: 1 },
          description: '多段生成必须提供：按完整计划顺序，每段一条独立提示词，含稳定主体标签、动作起止状态、本段新对白和运镜。2.0按事件顺序；2.5可用本段从0秒起的连续时间区间。续拍段另含单行【过渡画面】描述上一段到本段的动作、镜头与声音交接；续做默认沿用原数组，不传整份剧本替代每段。',
        },
        referenceImages: {
          type: 'array',
          items: { type: 'string' },
          description:
            '可选：人物形象 / 主体参考图（每项是公网 URL、base64（data URI 或纯 base64）、本机图片路径，'
            + '或 `latest` / `latest:2` 这种「用户最近上传的图片」简写）。'
            + '想把某个人的长相、发型、服装固定下来时用它，图片以 role=reference_image 传给上游。'
            + '三种接入方式均按顺序提交全部参考图：2.0最多9张、2.5最多30张，不能与首尾帧混用；中转需支持原生content角色格式。C火山直连另支持asset://素材。'
            + '本地图片单张不超过 8 MB，支持 jpg/jpeg/png/webp/bmp/gif/tiff。',
        },
        segmentSeconds: {
          type: 'integer',
          minimum: 4,
          maximum: modelMaxSeconds(config),
          description:
            '仅在超过单段上限时才用：每段延长多少秒，默认用配置里的每段秒数；'
            + '4 至模型上限（2.0 为 15、2.5 为 30） 的整数（如 5/8/10/14），默认按模型上限：按上限拆、段数最少。',
        },
        transitionDescription: {
          type: 'string',
          description: '已审核的续拍过渡描述：视频1接缝状态→本段动作/镜头衔接→声音延续，直接使用“视频1”，不写“参考视频1”。多段共用时作为通用描述；video_generate 可在各条 segmentPrompts 内用单行【过渡画面】指定该段过渡并优先采用。仅作用于续拍，首次直出不引用视频1。',
        },
        mode: {
          type: 'string',
          enum: ['continuous', 'closeup'],
          description: '由已审核脚本决定本次续拍：continuous=同机位连续（未指定时）；closeup=按脚本在完整对白或动作结束后切镜，具体景别以过渡描述为准。',
        },
        ratio: {
          type: 'string',
          enum: ['16:9', '9:16', '4:3', '3:4', '1:1', 'adaptive'],
          description: '画面比例；seedance 2.5 延长时会自动改用 adaptive。',
        },
        generateAudio: {
          type: 'boolean',
          description: '是否生成音频，默认 true。',
        },
        watermark: {
          type: 'boolean',
          description: '是否添加水印，默认 false。',
        },
        resolution: { type: 'string', enum: ['480p', '720p'], description: '视频清晰度，可选 480P 或 720P；按用户确认的脚本显式传入，续做未指定时沿用原清晰度。' },
        referenceImagesReviewed: { type: 'boolean', description: '仅当上一轮返回 review_required，已实际展示所有转换图片且用户明确确认非真人效果并同意视频重试后传 true；首次调用不得预先设置。' },
        resumeWithCurrentConfig: { type: 'boolean', description: '仅在用户明确确认更换原进度的模型或接入渠道后设为true；有待查询任务时必须恢复原渠道。' },
        resume: {
          type: 'string',
          description:
            '接着上一次暂停的长视频继续生成：传上一次结果里的 resumeDir（那个分段目录）。'
            + '插件会沿用暂停记录里的提示词、分段计划和已经生成好的前几段，只把剩下的秒数生成完再合并；'
            + 'prompt 可以省略（要改剧情再传），duration 传更大的数可以顺手把总时长加长。'
            + '同一份暂停进度同时只允许一次 resume 在跑：已经有别的调用在续做时会直接报错，'
            + '等它跑完再继续，别重复发（重复会把剩下的段提交两遍、重复扣费）。',
        },
        merge: {
          type: 'boolean',
          description: '是否下载分段并用 ffmpeg 合并成一个本地成片，默认 true；'
            + '本机没有 ffmpeg 时，长视频会被先拦回来让用户决定要不要装（见 description）；'
            + '显式传 false 表示只返回分段列表，不再拦。',
        },
        keepSegments: {
          type: 'boolean',
          description: '旧参数兼容；无论取值如何，原始分段始终保留。',
        },
      },
      required: [],
    },
    output: {
      schema: {
        type: 'object',
        properties: {
          status: { type: 'string' },
          mode: { type: 'string' },
          plannedSeconds: { type: 'integer' },
          totalSeconds: { type: 'integer' },
          videoUrl: { type: 'string' },
          videoPath: { type: 'string' },
          actualSeconds: { type: 'number' },
          seamCuts: { type: 'array', items: { type: 'object', properties: { index: { type: 'integer' }, seconds: { type: 'number' }, tailSeconds: { type: 'number' } } } },
          merged: { type: 'boolean' },
          seamTrimSeconds: { type: 'string', description: '预览确认后裁剪各接缝：如 0.5,0 表示仅裁第2段开头0.5秒；留空时2.0裁前段尾6帧和后段头1帧，2.5不裁；填0关闭。音视频同步裁剪，实际时长缩短。' },
        mergeMode: { type: 'string' },
          segmentsDir: { type: 'string' },
          ffmpegMissing: { type: 'boolean' },
          installHint: { type: 'string' },
          partial: { type: 'boolean' },
          paused: { type: 'boolean' },
          nextAction: { type: 'string' },
          previewPath: { type: 'string' },
          resumeDir: { type: 'string' },
          remainingSeconds: { type: 'integer' },
          pendingTaskId: { type: 'string' },
          deliveryError: { type: 'string' },
          images: { type: 'array' },
          note: { type: 'string' },
          error: { type: 'string' },
          errorCode: { type: 'string' },
          submissionId: { type: 'string' },
          convertedReferences: { type: 'array', items: { type: 'object', properties: { role: { type: 'string' }, imageUrl: { type: 'string' } } } },
          segments: { type: 'array', items: VIDEO_SEGMENT_OUTPUT_SCHEMA },
        },
      },
      render(_args, value) {
        return renderVideoResult(value);
      },
    },
    timeoutMs: 3600000,
    isConcurrencySafe() {
      return true;
    },
    async execute(args, exec) {
      const config = snapshotConfig(liveConfig);
      const apiKey = resolveApiKey(config);
      assertConfigured(config, apiKey);

      // 接着上一次暂停的进度继续做（循环迭代的第二轮起）：计划、游标、参考视频都从暂停记录里来。
      const resumeDir = resumeDirOf(args?.resume);
      const resume = resumeDir ? await readPauseFile(resumeDir) : null;
      assertResumeConnection(resume, config, args);
      if (resume?.toolName && resume.toolName !== TOOL_NAME) throw new Error(`这份进度请使用 ${resume.toolName} 继续。`);
      args = { ...(resume?.options || {}), ...args };
      args.mode = args.mode || 'continuous';
      args.resolution = resolveResolution(config, args);
      if (args.transitionDescription !== undefined && typeof args.transitionDescription !== 'string') {
        throw new Error('过渡描述必须是文字。');
      }

      const prompt = String(args?.prompt ?? '').trim() || String(resume?.prompt ?? '').trim();
      if (!prompt) {
        throw new Error(resumeDir
          ? '这次是接着上一次暂停的视频继续，但暂停记录里没有提示词：请把 prompt 补上。'
          : '提示词 prompt 不能为空。');
      }

      const target = resolveTargetPlan(config, args);
      const { singleMax, segmentSeconds, cap, asked } = target;
      const restarted = resume
        ? resumePlanFrom(resume, {
          askedTotal: args?.duration == null ? null : asked,
          segmentSeconds,
        })
        : null;
      const plan = resume?.deliveryPending ? [] : restarted ? restarted.plan : target.plan;
      const fullPlan = restarted ? restarted.fullPlan : target.plan;
      const total = restarted ? restarted.total : target.total;
      const doneBefore = restarted ? (Number(resume.done) || 0) : 0;
      const plannedTotal = plan.reduce((sum, step) => sum + step.seconds, 0);

      const notes = [];
      if (restarted) {
        notes.push(
          `接着上一次暂停的进度继续：前面 ${doneBefore} 段（${restarted.cursor} 秒）不重新生成，`
          + `这次还要生成 ${plan.length} 段共 ${plannedTotal} 秒。`,
        );
      } else if (asked > total) {
        notes.push(
          `目标 ${asked} 秒超过单条成片上限 ${cap} 秒（首段最长 ${singleMax} 秒 + 每段最多 `
          + `${segmentSeconds} 秒 × ${MAX_SEGMENTS - 1}），本次按 ${total} 秒执行。`,
        );
      }
      if (!restarted && plannedTotal < total) {
        notes.push(
          `目标 ${total} 秒排不满（每段上限 ${segmentSeconds} 秒 × ${MAX_SEGMENTS} 段），`
          + `本次按 ${plannedTotal} 秒执行。`,
        );
      } else if (!restarted && plannedTotal > total) {
        notes.push(
          `目标 ${total} 秒拆不出完全等长的分段（每段 4 至模型上限（2.0 为 15、2.5 为 30） 秒），本次按 ${plannedTotal} 秒执行。`,
        );
      }

      const segments = [];
      if (restarted) {
        // 上一次暂停前生成好的段：文件就在同样的分段目录里（序号 + 类型就是文件名），
        // 放进结果里，续做后的时间线、合并、成片时长才是完整的。
        for (const step of (resume.steps || [])) {
          segments.push({
            index: step.index,
            kind: step.kind,
            seconds: step.seconds,
            taskId: step.taskId,
            status: 'succeeded',
            videoUrl: step.videoUrl,
          });
        }
      }
      const resultImages = [];
      let submissionId;
      let convertedReferences;
      let status = 'succeeded';
      let error;
      let errorCode;
      let referenceUrl = restarted ? String(resume.lastVideoUrl || '') : '';
      let cursor = restarted ? restarted.cursor : 0;
      // 用户选择先不继续（确认框里点了拒绝/取消）：先交付已经生成的部分。
      let paused = false;
      // 上次那轮用的参数（续做时调用方可以只传 resume）
      const resumeOptions = restarted ? (resume.options || {}) : {};
      const suppliedPrompts = resolveSegmentPrompts(
        args?.segmentPrompts ?? resumeOptions.segmentPrompts, fullPlan.length,
      );

      // 被用户停止 / 宿主超时时，别把已经生成好的分段丢掉：按「暂停」收尾，留暂停记录给 resume。
      const outDir = await resolveOutputDir(config, exec, deps);
      const { stamp, segmentsDir } = resume
        ? { stamp: String(resume.stamp || fileStamp()), segmentsDir: resumeDir }
        : await allocateStamp(outDir, fileStamp());
      let pendingTask = resume?.pendingTask || null;
      const operationState = resume?.operationState || {};
      let characterReferences = await initialCharacterReferences(config, args, resume, exec?.signal);
      const checkpoint = async () => saveProgress(segmentsDir, {
        config, toolName: TOOL_NAME, stamp, prompt, fullPlan, cursor, referenceUrl,
        options: pickResumeOptions(args), segments, pendingTask, operationState, characterReferences,
      });
      if (resume?.deliveryPending) await checkpoint();
      let interrupted = false;
      try {
      for (const [offset, step] of plan.entries()) {
        if (exec?.signal?.aborted) throw abortError();
        const position = doneBefore + offset;

        const focusedPrompt = suppliedPrompts
          ? buildSegmentExecutionPrompt({ prompt: suppliedPrompts[position], kind: step.kind, index: position, count: fullPlan.length })
          : prompt;
        const stepArgs = {
          ...resumeOptions,
          ...args,
          characterReferences,
          prompt: focusedPrompt,
          duration: step.seconds,
          // 这条流程是「先直出再向后续拍」，分段的拼接顺序固定为向后延长。
          direction: 'backward',
          startAt: step.kind === 'extend' && isOmniExtendModel(resolveModel(config)) ? cursor : undefined,
        };
        let body;
        let seconds;
        if (operationState[position]?.originalBody) {
          body = operationState[position].originalBody;
          seconds = step.seconds;
        } else if (step.kind === 'generate') {
          const initialArgs = { ...stepArgs };
          if (characterReferences.length) {
            if (!stepArgs.firstFrameUrl && (!stepArgs.referenceImages || args.characterReferenceImages === undefined)) initialArgs.referenceImages = characterReferences.map(item => item.image_url.url);
            else if (stepArgs.firstFrameUrl && args.characterReferenceImages === undefined) initialArgs.firstFrameUrl = characterReferences[0].image_url.url;
          }
          const generated = await buildGenerationBody(config, initialArgs, step.seconds, {
            signal: exec?.signal,
          });
          body = generated.body;
          seconds = generated.seconds;
          if (generated.images?.length) resultImages.push(...generated.images);
          if (generated.notes?.length) notes.push(...generated.notes);
        } else {
          ({ body, seconds } = buildRequestBody(config, stepArgs, referenceUrl));
        }

        const final = await runTask(config, body, exec?.signal, {
          ctx, exec,
          state: operationState[position] ||= {},
          saveState: checkpoint,
          scope: `${segmentsDir}:${position}`,
          referenceImagesReviewed: args?.referenceImagesReviewed === true,
          taskId: pendingTask?.taskId,
          onCreated: async (taskId) => {
            pendingTask = { taskId, index: position + 1, kind: step.kind, seconds };
            await checkpoint();
          },
        });
        if (final.status === 'succeeded') {
          characterReferences = approvedCharacterReferences(characterReferences, operationState[position]);
          await checkpoint();
        }
        if (final.submissionId) submissionId = final.submissionId;
        if (final.convertedReferences) convertedReferences = final.convertedReferences;
        pendingTask = ['unknown', 'timeout'].includes(final.status)
          ? { taskId: final.taskId, index: position + 1, kind: step.kind, seconds } : null;
        const detail = final.errorCode === 'content_rejected'
          ? `${CONTENT_REJECTION_HINT}上游详情：${final.error || ''}`
          : final.error;

        segments.push({
          index: position + 1,
          kind: step.kind,
          seconds,
          taskId: final.taskId,
          status: final.status,
          videoUrl: final.videoUrl,
          error: detail,
        });

        if (final.status !== 'succeeded' || !final.videoUrl) {
          await checkpoint();
          status = final.status;
          errorCode = final.errorCode;
          error = detail;
          break;
        }
        referenceUrl = normalizeReferenceUrl(final.videoUrl);
        cursor += seconds;

        await checkpoint();

        // 先结束本次调用并交付视频，让助手展示成果后再询问是否继续。
        // 工具内部阻塞在审批框时，宿主尚拿不到输出，无法展示刚完成的分段。
        if (plan[offset + 1]) {
          paused = true;
          notes.push('本段已完成：请先展示本次视频成果，让用户预览；用户确认继续后再用 resume 接着生成下一段。');
          break;
        }
      }
      } catch (failure) {
        const doneYet = segments.some((segment) => segment.status === 'succeeded' && segment.videoUrl);
        if (failure?.code !== 'ABORTED' || !doneYet) throw failure;
        // 中断/超时：已经生成的部分照常下载合并交付，剩下的交给 resume。
        interrupted = true;
        paused = true;
        notes.push(
          '这次调用被中断了（用户点了停止，或者等超时了）：已经生成好的部分会先下载、合并、交付，'
          + '剩下的秒数不用重头再来——用 resume 就能接着做。',
        );
      }

      const completed = segments.filter((segment) => segment.status === 'succeeded' && segment.videoUrl);
      // 结果字段随流程追加（合并信息、备注等），显式声明成可扩展对象
      const result: Record<string, any> = {
        status,
        mode: fullPlan.length > 1 ? 'extended' : 'direct',
        plannedSeconds: restarted ? total : plannedTotal,
        totalSeconds: completed.reduce((sum, segment) => sum + segment.seconds, 0),
        segments,
        videoUrl: completed.at(-1)?.videoUrl,
        error,
        errorCode,
        submissionId,
        convertedReferences,
        ...(convertedReferences ? { nextAction: 'present_reference_images_then_wait_for_user' } : {}),
      };
      if (resume?.deliveryPending && doneBefore < fullPlan.length) paused = true;
      if (paused) {
        result.paused = true;
        result.remainingSeconds = Math.max(0, fullPlan.reduce((sum, step) => sum + step.seconds, 0) - completed.reduce((sum, step) => sum + step.seconds, 0));
      }
      result.resumeDir = segmentsDir;
      result.segmentsDir = segmentsDir;
      if (pendingTask) {
        result.pendingTaskId = pendingTask.taskId;
        result.note = '任务已提交，请用 resume 查询并接回原进度，或用 video_status 查询；不要重复提交。';
      }

      if (resultImages.length) {
        // 只回「用了哪些图、来自哪里」，不回 base64 正文（太长）
        result.images = resultImages.map((item) => ({
          role: item.role,
          source: item.source,
          localPath: item.localPath,
          bytes: item.bytes,
          originalPath: item.originalPath,
          fittedTo: item.fittedTo,
          uploadedAt: item.uploadedAt,
          recentUploads: item.recentUploads,
        }));
      }

      const deliveredSeconds = completed.reduce((sum, segment) => sum + segment.seconds, 0);
      // 没成功的那一段：区分「确实失败」和「只是没查到」。后者任务已经提交、大概率还在生成，
      // 必须把任务 ID 交给用户/模型，用 video_status 事后补拉，而不是当成没生成。
      if (status !== 'succeeded') {
        const last = segments.at(-1) || {};
        if (status === 'unknown' || status === 'timeout') {
          result.pendingTaskId = last.taskId;
          notes.push(
            `第 ${last.index ?? segments.length} 段的查询没拿到结果（${status}），但任务已提交：`
            + `${last.taskId || '（无任务 ID）'}。它可能仍在生成——用 video_status 按这个 ID 复查，`
            + '拿到链接就能补上这一段，不用重新提交、不会重复扣费。',
          );
        } else {
          notes.push(`第 ${last.index ?? segments.length} 段没有成功（${status}）。`);
        }
        if (completed.length) {
          notes.push(
            `已把成功的 ${completed.length} 段（${deliveredSeconds} 秒）下载并合并交付，可作为残片使用。`,
          );
          result.partial = true;
        } else {
          result.note = notes.join('\n');
          return result;
        }
      }

      if (args?.merge === false) {
        if (paused) {
          result.paused = true;
          result.nextAction = 'present_video_then_wait_for_user';
          result.remainingSeconds = Math.max(0, total - deliveredSeconds);
          notes.push(resumeHint(segmentsDir, result.remainingSeconds, TOOL_NAME));
        }
        result.note = [...notes, '按参数要求只返回上游链接，没有下载合并。'].join('\n');
        return result;
      }

      const delivery = await downloadSegmentsAndMerge(config, {
        segments: completed,
        segmentsDir,
        outDir,
        stamp,
        notes,
        // 暂停时只有一段的话，这一段的文件要留在分段目录里给之后续做用。
        keepSingleFile: paused,
        // 被中断时请求信号已经 abort：收尾（下载 + 合并）不能被它打断，否则等于白生成。
        signal: interrupted || exec?.signal?.aborted ? undefined : exec?.signal,
      });
      if (delivery.error) {
        result.deliveryError = delivery.error;
        if (delivery.ffmpegMissing) { result.ffmpegMissing = true; result.installHint = delivery.installHint; }
        result.nextAction = 'resume_delivery_without_regeneration';
        result.segmentsDir = delivery.segmentsDir;
        result.note = [...notes, delivery.error].join('\n');
        return result;
      }
      if (delivery.ffmpegMissing) {
        result.segmentsDir = delivery.segmentsDir;
        result.merged = false;
        result.ffmpegMissing = true;
        result.installHint = delivery.installHint;
        result.note = notes.join('\n');
        return result;
      }
      if (!delivery.files.length) return result;
      if (delivery.merged) {
        result.merged = true;
        result.videoPath = delivery.videoPath;
        result.mergeMode = delivery.mergeMode;
        if (delivery.actualSeconds) result.actualSeconds = delivery.actualSeconds;
        if (delivery.seamCuts?.length) result.seamCuts = delivery.seamCuts;
      }

      if (paused) {
        // 暂停：分段要留着（接着做时当前几段用），并写下「生成到哪一步」的暂停记录。
        result.segmentsDir = segmentsDir;
        result.resumeDir = segmentsDir;
        result.paused = true;
        result.nextAction = 'present_video_then_wait_for_user';
        result.previewPath = completed.at(-1)?.localPath || result.videoPath;
        await appendRequestLog({ event: 'preview_required', previewPath: result.previewPath, resumeDir: result.resumeDir });
        result.remainingSeconds = Math.max(0, total - deliveredSeconds);
        notes.push(`已交付的成片是从头到第 ${segments.length} 段，分段仍保留在 ${segmentsDir}。`);
        notes.push(resumeHint(segmentsDir, result.remainingSeconds, TOOL_NAME));
        result.note = notes.join('\n');
        return result;
      }

      // 所有生成分段永久保留；合并、裁剪仅使用副本。
      result.segmentsDir = segmentsDir;
      if (notes.length) result.note = notes.join('\n');
      return result;
    },
  };
}
