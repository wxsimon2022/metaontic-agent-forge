import { initialCharacterReferences, approvedCharacterReferences } from '../workflow/character-references.js';
/** tools/video-extend：从宿主入口拆出的独立职责模块。 */
import { modelMaxSeconds } from '../workflow/planning.js';
import { SEGMENT_OUTPUT_SCHEMA, renderResult } from './results.js';
import { snapshotConfig, resolveApiKey, assertConfigured } from '../providers/connection.js';
import { assertResumeConnection, saveProgress, resumeDirOf, readPauseFile, pickResumeOptions } from '../workflow/resume.js';
import { clampInteger } from '../utils/validation.js';
import { MAX_SEGMENTS, MIN_SECONDS, resolveResolution } from '../config.js';
import { getTask } from '../providers/transport.js';
import { extractVideoUrl, extractStatus } from '../providers/response.js';
import { normalizeReferenceUrl, buildRequestBody, runTask } from '../providers/seedance.js';
import { abortError } from '../utils/errors.js';
import { formatSeconds, resolveOutputDir, fileStamp, allocateStamp } from '../utils/files.js';
import {
  SEGMENT_PAUSE_NOTE, absorbSegmentInterruption, describeIncompleteRun,
  recordSegmentResult, runSegmentDelivery, skipMergeDelivery,
} from '../workflow/segment-run.js';

export function extendTool(liveConfig, deps, ctx) {
  const config = liveConfig;
  const TOOL_NAME = 'video_extend';
  return {
    name: 'video_extend',
    description:
      '把一段已有的视频向前或向后延长：以公网视频 URL 作为输入素材，调用 Seedance 生成衔接片段，'
      + '保持人物、服装、场景光线和声音连续；可一次连续延长多段，每段都用上一段的结果继续延长。'
      + '提示词规则：以「向后延长视频1」或「向前延长视频1」开头（也可写「生成视频1之后的内容：」），'
      + '全程用「视频1」指代输入素材，不要写成「参考视频1」（会被当成参考生视频，不是延长）；'
      + '内容写清延长方向、剧情发展、主体状态、镜头运动和声音延续'
      + '（背景音乐要接着视频1结尾往下走，禁止从头播放/换曲），减少接缝。'
      + '每段 4 至模型上限（2.0 为 15、2.5 为 30） 秒，默认按所选模型上限拆、段数最少；上游对卡满 15 秒敏感时再调小。'
      + '返回每段的任务 ID 和最终视频下载链接（有效期以上游为准）；生成通常需要几分钟，'
      + '单次调用返回 timeout、或某段返回 unknown（查询失败、任务其实已提交）时，'
      + '都用返回的任务 ID 走 video_status 继续等，不要重复提交同一段。'
      + '每段延长完先返回成果供展示，用户预览并确认继续后再用resume续做；未确认时停在当前成果，'
      + '结果里带 paused=true、resumeDir、remainingSeconds；之后用户说「继续」时把 resumeDir '
      + '原样传给 video_extend 的 resume 参数接着做（前面几段不重新生成；新增剩余分段仍需确认费用并计费）。'
      + '多段默认会下载分段并在本机合并成一条成片（需要 ffmpeg）：没有 ffmpeg 时会先拦下来问用户，'
      + '结果里也会带 ffmpegMissing 与安装引导。'
      + '中途被停止 / 等超时同理：已经延长好的段先交付，剩下的用 resume 接着做。',
    parameters: {
      type: 'object',
      properties: {
        projectId: { type: 'string', description: 'video_project返回的项目ID。新建生成/延长前须prepare并review通过；续做默认沿用。' },
        cumulativePreview: { type: 'boolean', description: '默认暂停只下载展示新段，最终再合并；明确需要累计预览时传true，不新增生成费用。' },
        characterReferenceImages: { type: 'array', items: { type: 'string' }, description: '已审核的最初角色参考图，按固定顺序用于每段续拍；未提供时沿用首段参考图或首帧。支持URL、本地图片或data URI。断点固定此套图，不自动重画或替换。真人转换仍需单独同意及结果审核。' },
        prompt: {
          type: 'string',
          description: '本段要续拍的剧情内容与人物设定；不要在提示词里重复已发生的情节。',
        },
        inputVideoSeconds: { type: 'number', minimum: 0.001, description: '已有输入视频的真实时长（秒），用于费用预估；须核实素材，不猜测。续做自动读取上一段时长。' },
        videoUrl: {
          type: 'string',
          description: '参考视频的公网 URL（https:// 或 http://）。与 taskId 二选一。',
        },
        taskId: {
          type: 'string',
          description:
            '已有的 video_generate / video_extend 任务 ID，用该上游任务返回的视频作为输入素材（不是本地合并成片）。与 videoUrl 二选一。',
        },
        duration: {
          type: 'integer',
          minimum: 4,
          maximum: modelMaxSeconds(config),
          description:
            '每段新增的秒数上限，4 至模型上限（2.0 为 15、2.5 为 30） 的整数（如 5/8/10/14，默认按模型上限）；'
            + '刚好卡 15 秒容易因封装略超被上游拒绝。省略时按当前模型单段上限规划。',
        },
        direction: {
          type: 'string',
          enum: ['backward', 'forward'],
          description:
            'backward=向后延长，续拍视频1之后的内容（默认）；forward=向前延长，生成视频1之前的前置剧情。',
        },
        wording: {
          type: 'string',
          enum: ['extend', 'after'],
          description:
            '提示词开头写法：extend=「向后延长视频1」/「向前延长视频1」（默认）；'
            + 'after=「生成视频1之后的内容：」（仅向后延长）。',
        },
        segments: {
          type: 'integer',
          minimum: 1,
          maximum: 10,
          description: '连续延长几段，默认 1；每段都引用上一段的结果，适合做出更长的成片。',
        },
        transitionDescription: {
          type: 'string',
          description: '已审核的续拍过渡描述：视频1接缝状态→本段动作/镜头衔接→声音延续，直接使用“视频1”，不写“参考视频1”。多段共用时作为通用描述；video_generate 可在各条 segmentPrompts 内用单行【过渡画面】指定该段过渡并优先采用。仅作用于续拍，首次直出不引用视频1。',
        },
        mode: {
          type: 'string',
          enum: ['continuous', 'closeup'],
          description:
            '由已审核脚本决定本次续拍：continuous=同机位连续（未指定时）；closeup=按脚本切换近景或反应镜头，具体安排以过渡描述为准。',
        },
        startAt: {
          type: 'number',
          minimum: 0,
          description:
            '视频1已有的秒数；给了就按「整片第 X–Y 秒」描述本段。'
            + '向后延长时逐段累加，向前延长时逐段前移。',
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
        merge: { type: 'boolean', description: '默认true：下载分段并在本机合并；false只返回上游链接。续做默认沿用原设置。' },
        resolution: { type: 'string', enum: ['480p', '720p'], description: '视频清晰度，可选 480P 或 720P；按用户确认的脚本显式传入，续做未指定时沿用原清晰度。' },
        referenceImagesReviewed: { type: 'boolean', description: '仅当上一轮返回 review_required，已实际展示所有转换图片且用户明确确认非真人效果并同意视频重试后传 true；首次调用不得预先设置。' },
        resumeWithCurrentConfig: { type: 'boolean', description: '仅在用户明确确认更换原进度的模型或接入渠道后设为true；有待查询任务时必须恢复原渠道。' },
        resume: {
          type: 'string',
          description:
            '接着上一次暂停的延长继续：传上一次结果里的 resumeDir。'
            + '插件会沿用暂停记录里的提示词、延长方向和剩下的段数，只把没做的部分生成完再合并；'
            + 'prompt / videoUrl / direction 都可以省略。'
            + '想顺手多延长几段就再传 segments（表示在剩下的基础上「再加」几段）。'
            + '同一份暂停进度同时只允许一次 resume 在跑：已经有别的调用在续做时会直接报错，'
            + '等它跑完再继续，别重复发（并发续做会被拦截；请勿绕过锁重复提交）。',
        },
      },
      required: [],
    },
    output: {
      schema: {
        type: 'object',
        properties: {
          status: { type: 'string' },
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
          totalSeconds: { type: 'integer' },
          pendingTaskId: { type: 'string' },
          deliveryError: { type: 'string' },
          error: { type: 'string' },
          errorCode: { type: 'string' },
          note: { type: 'string' },
          submissionId: { type: 'string' },
          convertedReferences: { type: 'array', items: { type: 'object', properties: { role: { type: 'string' }, imageUrl: { type: 'string' } } } },
          segments: { type: 'array', items: SEGMENT_OUTPUT_SCHEMA },
        },
      },
      render(_args, value) {
        return renderResult(value);
      },
    },
    timeoutMs: 1800000,
    isConcurrencySafe() {
      return true;
    },
    async execute(args, exec) {
      const config = snapshotConfig(liveConfig);
      const apiKey = resolveApiKey(config);
      assertConfigured(config, apiKey);

      // 接着上一次暂停的延长继续（长视频循环迭代的第二轮起）
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
          ? '这次是接着上一次暂停的延长继续，但暂停记录里没有提示词：请把 prompt 补上。'
          : '提示词 prompt 不能为空。');
      }

      const lastOptions = resume ? (resume.options || {}) : {};
      const direction = (args?.direction ?? lastOptions.direction) === 'forward' ? 'forward' : 'backward';
      const wording = (args?.wording ?? lastOptions.wording) === 'after' ? 'after' : 'extend';
      const requestedSegments = clampInteger(args?.segments, 1, MAX_SEGMENTS, 1);
      const secondsPerSegment = clampInteger(
        args?.duration ?? modelMaxSeconds(config),
        MIN_SECONDS,
        modelMaxSeconds(config),
        modelMaxSeconds(config),
      );

      let referenceUrl = String(args?.videoUrl ?? '').trim();
      if (!referenceUrl && args?.taskId) {
        const sourceId = String(args.taskId).trim();
        let source;
        try {
          source = await getTask(config, sourceId, exec?.signal);
        } catch (failure) {
          if (failure?.code === 'ABORTED') throw failure;
          // 查不到源视频 ≠ 源任务没生成：给一个明确的说法，别抛原始 401。
          throw new Error(
            `读取参考视频任务 ${sourceId} 失败：${failure?.message || failure}。`
            + '这不代表该任务没有生成——稍后重试，或直接把成片的公网链接用 videoUrl 传进来。',
          );
        }
        referenceUrl = extractVideoUrl(source) || '';
        if (!referenceUrl) {
          throw new Error(
            `任务 ${args.taskId} 没有可用的视频链接（状态：${
              extractStatus(source) || '未知'
            }）。`,
          );
        }
      }
      // 接着做时，参考视频是上次最后一段的链接（暂停记录里有）
      if (!referenceUrl && resume) referenceUrl = String(resume.lastVideoUrl ?? '').trim();
      referenceUrl = normalizeReferenceUrl(referenceUrl);

      // 计划：续做时先把暂停记录里剩下的段跑完；再传 segments 就是「再追加这么多段」
      const doneBefore = resume ? (Number(resume.done) || 0) : 0;
      const fullPlan = resume ? (resume.plan || []).map((step) => ({ ...step })) : [];
      if (!resume) {
        for (let index = 0; index < requestedSegments; index += 1) {
          fullPlan.push({ kind: 'extend', seconds: secondsPerSegment });
        }
      } else if (args?.segments != null) {
        for (let index = 0; index < requestedSegments && fullPlan.length < MAX_SEGMENTS; index += 1) {
          fullPlan.push({ kind: 'extend', seconds: secondsPerSegment });
        }
      }
      const plan = (resume?.deliveryPending || (resume && args.cumulativePreview === true)) ? [] : fullPlan.slice(doneBefore);
      const plannedSeconds = plan.reduce((sum, step) => sum + step.seconds, 0);

      let cursor = resume
        ? (resume.cursor ?? null)
        : (args?.startAt == null ? null : Math.max(0, Math.round(Number(args.startAt))));
      const notes = [];
      const segments = [];
      if (resume) {
        // 上次暂停前生成好的延长段：文件就在同样的分段目录里（序号 + extend 就是文件名）
        for (const step of (resume.steps || [])) {
          segments.push({
            index: step.index,
            kind: 'extend',
            seconds: step.seconds,
            taskId: step.taskId,
            status: 'succeeded',
            videoUrl: step.videoUrl,
          });
        }
      }
      let submissionId;
      let convertedReferences;
      let status = 'succeeded';
      let error;
      let errorCode;
      // 用户选择先不继续（确认框里点了拒绝/取消）：先把已经延长好的部分交付
      let paused = Boolean(resume && args.cumulativePreview === true && fullPlan.length > (Number(resume.done) || 0));

      // 被停止 / 超时也一样：已经延长好的部分先交付，留暂停记录给 resume。
      const outDir = await resolveOutputDir(config, exec, deps);
      const { stamp, segmentsDir } = resume
        ? { stamp: String(resume.stamp || fileStamp()), segmentsDir: resumeDir }
        : await allocateStamp(outDir, fileStamp());
      let pendingTask = resume?.pendingTask || null;
      const operationState = resume?.operationState || {};
      let characterReferences = await initialCharacterReferences(config, args, resume, exec?.signal);
      const checkpoint = async () => saveProgress(segmentsDir, {
        config, toolName: TOOL_NAME, stamp, prompt, fullPlan, cursor, referenceUrl,
        options: { ...pickResumeOptions(args), direction, wording, startAt: cursor }, segments, pendingTask, operationState, characterReferences,
      });
      if (resume?.deliveryPending) await checkpoint();
      let interrupted = false;
      try {
      for (const [offset, step] of plan.entries()) {
        if (exec?.signal?.aborted) throw abortError();
        const position = doneBefore + offset;

        const { body, seconds } = buildRequestBody(
          config,
          {
            ...lastOptions,
            ...args,
            characterReferences,
            prompt,
            duration: step.seconds,
            startAt: cursor,
            direction,
            wording,
          },
          referenceUrl,
        );
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
        const outcome = recordSegmentResult({
          final, segments, segment: { index: position + 1, kind: 'extend', seconds }, submissionId, convertedReferences,
        });
        ({ submissionId, convertedReferences, pendingTask } = outcome);
        if (!outcome.ok) {
          await checkpoint();
          status = outcome.status;
          errorCode = outcome.errorCode;
          error = outcome.error;
          break;
        }
        referenceUrl = normalizeReferenceUrl(final.videoUrl);
        if (cursor != null) {
          cursor = direction === 'forward' ? cursor - seconds : cursor + seconds;
          if (cursor < 0) cursor = null;
        }

        await checkpoint();

        // 先结束本次调用并交付视频，让助手展示成果后再询问是否继续。
        // 工具内部阻塞在审批框时，宿主尚拿不到输出，无法展示刚完成的分段。
        if (plan[offset + 1]) {
          paused = true;
          notes.push(SEGMENT_PAUSE_NOTE);
          break;
        }
      }
      } catch (failure) {
        absorbSegmentInterruption(failure, {
          segments,
          notes,
          message:
            '这次调用被中断了（用户点了停止，或者等超时了）：已经延长好的部分会尝试下载并交付；是否合并以返回结果为准，'
            + '剩下的段不用重头再来——用 resume 就能接着做。',
        });
        interrupted = true;
        paused = true;
      }

      const completed = segments.filter((segment) => segment.status === 'succeeded' && segment.videoUrl);
      const deliveredSeconds = completed.reduce((sum, segment) => sum + (segment.seconds || 0), 0);
      const result: Record<string, any> = {
        status,
        error,
        errorCode,
        submissionId,
        convertedReferences,
        ...(convertedReferences ? { nextAction: 'show_reference_images_then_wait_for_user' } : {}),
        segments,
        videoUrl: completed.at(-1)?.videoUrl,
        totalSeconds: deliveredSeconds,
      };
      if (resume?.deliveryPending && doneBefore < fullPlan.length) paused = true;
      // 延长没有「目标总时长」这一层，计划总长就是剩下的秒数口径。
      const remainingSeconds = Math.max(0, fullPlan.reduce((sum, step) => sum + step.seconds, 0) - deliveredSeconds);
      if (paused) {
        result.paused = true;
        result.remainingSeconds = remainingSeconds;
      }
      result.resumeDir = segmentsDir;
      result.segmentsDir = segmentsDir;
      if (pendingTask) {
        result.pendingTaskId = pendingTask.taskId;
        result.note = '任务已提交，请用 resume 查询并接回原进度，或用 video_status 查询；不要重复提交。';
      }

      if (!completed.length && status === 'succeeded') {
        // 没有可交付的分段（例如只是重试交付）：直接返回，不触发合并。
        if (notes.length) result.note = notes.join('\n');
        return result;
      }
      if (describeIncompleteRun({ result, status, segments, notes, completed, deliveredSeconds })) {
        result.note = notes.join('\n');
        return result;
      }
      if (resume) {
        notes.push(
          `接着上一次暂停的进度继续：前面 ${doneBefore} 段（${formatSeconds(resume.cursor ?? 0)}）不重新生成，`
          + `这次还要延长 ${plan.length} 段共 ${plannedSeconds} 秒。`,
        );
      }

      if (args?.merge === false) {
        return skipMergeDelivery({ result, paused, remainingSeconds, notes, segmentsDir, toolName: TOOL_NAME });
      }
      return runSegmentDelivery({
        config, exec, interrupted, completed, segments, segmentsDir, outDir, stamp, notes, result, cumulativePreview: args.cumulativePreview === true,
        paused,
        remainingSeconds,
        pauseNote: `本次累计预览包含已完成的 ${segments.length} 段，不是整条最终成片，分段仍保留在 ${segmentsDir}。`,
        toolName: TOOL_NAME,
      });
    },
  };
}
