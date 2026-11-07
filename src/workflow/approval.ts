import { estimateSegmentCosts } from '../tools/video-estimate.js';
import { characterChoiceGate } from './character-choice.js';
/** workflow/approval：从宿主入口拆出的独立职责模块。 */
import { isManualKey, connectionLabel, assertConfigured, resolveApiKey, resolveModel } from '../providers/connection.js';
import { estimatePlan } from './costs.js';
import { clampInteger } from '../utils/validation.js';
import { ref, MIN_SECONDS, MAX_SEGMENTS, resolveResolution } from '../config.js';
import { sumStepSeconds, resolveSegmentSeconds, modelMaxSeconds } from './planning.js';
import { ffmpegInstallOptions, hasFfmpeg, resolveBinary } from '../media/ffmpeg.js';
import { resumeDirOf, readPauseFile, resumePlanFrom, assertResumeConnection } from './resume.js';

/** 续做仍需明确确认当前渠道的实际调用费用。 */
export async function remainingCostText(config, exec, remainingSteps, inputVideoSeconds = undefined) {
  try {
    const estimate = estimateSegmentCosts(config, { ...(exec?.arguments || {}), resolution: resolveResolution(config, exec?.arguments || {}), inputVideoSeconds }, remainingSteps);
    return { cost: `剩余计划基础估价约¥${estimate.cny.toFixed(4)}`, remain: '' };
  } catch (error) { return { cost: `剩余计划无法可靠估价（${error?.message || error}）`, remain: '' }; }
}

export function segmentContinueLine({ toolName = 'video_generate', done, lastSeconds, nextSeconds }) {
  const action = toolName === 'video_extend' ? '延长' : '生成';
  const finished = done > 0 ? `第 ${done} 段（${lastSeconds} 秒）已经生成好` : '还没有生成任何分段';
  return {
    zh: `${finished}。接下来${action}第 ${done + 1} 段（${nextSeconds} 秒）`,
    en: `${done > 0 ? `Segment ${done} (${lastSeconds}s) is done. ` : ''}Next up: `
      + `${toolName === 'video_extend' ? 'extend' : 'generate'} segment ${done + 1} (${nextSeconds}s)`,
  };
}

export function approvalPolicy(ctx, exec) {
  try {
    const approval = ctx.get('approval');
    if (!approval) return 'missing';
    const session = exec?.agent?.session;
    const override = session && typeof approval.overrideOf === 'function'
      ? approval.overrideOf(session)
      : undefined;
    return override || approval.config?.policy || 'ask';
  } catch {
    return 'ask';
  }
}

/** 把秒数列表写成「15s + 5s」这样的紧凑形式，确认框只有一行文字，不能换行。 */
export function planSummary(estimate) {
  if (!estimate) return '时长未知';
  const sizes = estimate.segments.map((item) => `${item.seconds}s`).join(' + ');
  return `${estimate.segments.length} 段（${sizes}）共 ${estimate.seconds} 秒`;
}

/**
 * 装 ffmpeg 前的确认：安装命令要在本机跑，必须让用户先看清楚是什么、再决定装不装。
 * （只检查不安装的调用直接放行，不用打扰用户。）
 */
function setupGate(ctx, exec) {
  const args = exec.arguments && typeof exec.arguments === 'object' ? exec.arguments : {};
  if (args?.install !== true) return { kind: 'allow' };

  const { os, installs, bootstrap } = ffmpegInstallOptions();
  const command = String(args?.target || 'ffmpeg') === 'package-manager' && bootstrap
    ? bootstrap.command
    : installs[0].command;

  if (approvalPolicy(ctx, exec) === 'never') {
    return {
      kind: 'deny',
      reason: '当前权限模式关闭了审批提示（完全访问），装环境这种会在本机跑命令的操作没法确认，已停止。'
        + '把权限切到「工作区写入」或「只读」后再让我装；也可以照着这条命令自己在终端执行：'
        + `${command}（${os}）。`,
    };
  }

  return {
    kind: 'ask',
    reason: `人工确认：在 ${os} 上执行安装命令「${command}」。`,
    displayReason: {
      zh: `准备在这台电脑上装 ffmpeg：${command}（${os}）。`
        + '点了「允许」才会执行，安装完成只验证工具；新生成仍需单独确认费用，已有任务按原进度恢复。',
      en: `About to install ffmpeg on this machine: ${command} (${os}). `
        + 'It runs only after you allow it; installation only verifies the tool; new video generation requires separate cost confirmation, while existing tasks should resume their saved progress.',
    },
  };
}

/**
 * 要合并的长视频遇上「本机没有 ffmpeg」：不往下走，把这次调用退回去，
 * 让模型在对话框里和用户确认「要不要现在装 ffmpeg」——同意就装（宿主会弹审批），
 * 不想装就带 merge:false 重发，只拿分段列表。
 *
 * 返回 null 表示不用拦（不需要合并、或本机已经能跑 ffmpeg）。
 */
export async function ffmpegConsentGate(config, exec, args) {
  if (exec.name !== 'video_generate' && exec.name !== 'video_extend') return null;
  // 用户已经明确说要「只返回分段」，就别再拦了。
  if (args?.merge === false) return null;

  let plan = null;
  // 续做时：合并的文件数 = 已经生成好的段 + 这次要跑的段，所以两边都要算进来。
  let doneSteps = [];
  try {
    const gateArgs = await estimateArgsFor(config, exec.name, args);
    if (gateArgs?.merge === false) return null;
    plan = gateArgs.remainingPlan ?? estimatePlan(config, exec.name, gateArgs);
    const dir = resumeDirOf(args?.resume);
    if (dir) {
      const data = await readPauseFile(dir);
      doneSteps = (data.steps || []).map((step) => ({ kind: step.kind, seconds: step.seconds }));
    }
  } catch {
    plan = null;
  }
  const allSteps = [...doneSteps, ...(plan || [])];
  if (!plan || allSteps.length < 2) return null;
  if (await hasFfmpeg(config, exec.signal)) return null;

  const { os, installs } = ffmpegInstallOptions();
  const command = installs[0].command;
  const sizes = allSteps.map((step) => `${step.seconds}s`).join(' + ');
  const binary = resolveBinary(config, 'ffmpegBinary', 'ffmpeg');
  const lines = [
    `本机没有 ${binary}，本次计划总时长是 ${allSteps.reduce((sum, step) => sum + step.seconds, 0)} 秒`
      + `（会拆成 ${allSteps.length} 段：${sizes}），没有 ffmpeg 就没法合并成一条，所以先停下来了，`
      + '还没有调用模型、没有产生费用。',
    '请在对话框里先和用户确认，不要自己绕过这一步：',
    `1) 问用户要不要现在装 ffmpeg —— 说清他的系统（${os}）和命令：${command}`,
    '   （装好后，已有任务用原resume重试下载或合并；尚未提交的新任务再确认生成费用）。',
    '2) 用户同意安装：调用 video_setup（install:true）——插件会执行上面的命令，'
      + '宿主会先把这条命令拿给用户确认；装完它会自己验证，成功后你按原 duration 重新调用 '
      + 'video_generate 继续生成即可（一般是先装包管理器：本机连 brew 都没有时，'
      + 'video_setup 会返回 nextStep，用 target:"package-manager" 再装一次）。',
    '3) 用户不想装、或者装不了：带 `merge:false` 重新调用 video_generate，'
      + '插件就只生成并返回分段列表（每段上游链接，不下载本地文件），这次不会再拦。',
    '已经装过但不在默认位置的话，把绝对路径填进插件设置里的「ffmpeg 路径」也一样管用；'
      + '安装包自带 ffprobe，分段时长探测会一起解决。',
  ];
  return {
    kind: 'deny',
    reason: lines.join('\n'),
    info: { ffmpegMissing: true, os, command, segments: allSteps.length },
  };
}

/**
 * 读取本次真实剩余计划；费用只估当前会执行的一段，环境预检检查完整计划。
 * 续做使用暂停记录，不把剩余秒数重新拆段。待查询任务和交付重试不新增生成费用。
 */
export async function estimateArgsFor(config, toolName, args) {
  const dir = resumeDirOf(args?.resume);
  if (!dir) return args;
  const data = await readPauseFile(dir);
  assertResumeConnection(data, config, args);
  const merged = { ...(data.options || {}), ...args };
  let plan;
  if (toolName === 'video_generate') {
    plan = resumePlanFrom(data, {
      askedTotal: args?.duration == null ? null : clampInteger(args.duration, MIN_SECONDS, Number.MAX_SAFE_INTEGER, 0),
      segmentSeconds: resolveSegmentSeconds(config, args?.segmentSeconds),
    }).plan;
  } else {
    const fullPlan = data.plan.map(step => ({ ...step }));
    if (args?.segments != null) {
      const count = clampInteger(args.segments, 1, MAX_SEGMENTS, 1);
      const seconds = clampInteger(args.duration, MIN_SECONDS, modelMaxSeconds(config), modelMaxSeconds(config));
      for (let n = 0; n < count && fullPlan.length < MAX_SEGMENTS; n++) fullPlan.push({ kind: 'extend', seconds });
    }
    plan = fullPlan.slice(Number(data.done) || 0);
  }
  const previous = (data.steps || []).at(-1);
  return { ...merged, inputVideoSeconds: previous?.durationSeconds ?? previous?.seconds ?? merged.inputVideoSeconds, remainingPlan: data.pendingTask || data.deliveryPending ? [] : plan,
    duration: sumStepSeconds(plan) };
}

export async function preflightGate(ctx, config, exec) {
  // 装环境：只有真要装的时候才拦（让用户先看到命令）；纯检查放行。
  if (exec.name === 'video_setup') return setupGate(ctx, exec);

  if (exec.name === 'media_submission') {
    if (exec.arguments?.action === 'get') return { kind: 'allow' };
    if (approvalPolicy(ctx, exec) === 'never') return { kind: 'deny', reason: '需要用户确认原提交的核对结果。' };
    return { kind: 'ask', reason: exec.arguments?.taskId ? '确认将防重记录关联到渠道侧核对出的原任务 ID，不重新生成。' : '请确认已经在渠道侧核对：原请求没有创建任务。解锁后再生成会产生新费用；若原任务实际存在，可能重复扣费。' };
  }
  if (exec.name === 'video_prepare_image') {
    const creating = exec.arguments?.operation === 'create_character';
    if (String(exec.arguments?.taskId || '').trim()) return { kind: 'allow' }; // 只查询和取件，不创建新的付费任务。
    if (approvalPolicy(ctx, exec) === 'never') return { kind: 'deny', reason: '当前权限模式无法进行图片调用确认。' };
    if (!creating && exec.arguments?.characterType === 'realistic') return { kind: 'deny', reason: '真人限制转换必须使用非真人风格，不能转换为真人写实。' };
    const characterLabel = exec.arguments?.characterType === 'realistic' ? '真人写实' : '非真人';
    if (creating) return { kind: 'ask', reason: '调用Seedream按文字生成角色参考图，图片单独计费。完成后先展示并核对角色和风格，确认后才用于视频；视频生成另行确认和计费。', displayReason: { zh: `先生成一张${characterLabel}角色参考图，图片调用单独计费。生成后先看图确认，再用于视频；现在不会生成视频。是否同意？`, en: `Generate one ${exec.arguments?.characterType === 'realistic' ? 'photorealistic' : 'stylized'} character reference image, billed separately. Review it before any separately confirmed video generation.` } };
    return { kind: 'ask', reason: '调用 Seedream 将真人参考图转为非真人风格；图片生成单独按实际调用计费，视频费用另计。', displayReason: { zh: `将调用 Seedream 处理参考图，图片调用单独计费，视频费用另计。确认后开始处理。`, en: `Use Seedream to stylize the reference. Image calls are billed separately from video. Confirm to proceed.` } };
  }

  if (exec.arguments?.resume && exec.arguments?.cumulativePreview === true) return { kind: 'allow' };
  const rawArgs = exec.arguments && typeof exec.arguments === 'object' ? exec.arguments : {};
  let effectiveArgs = rawArgs;
  // 续做入口就是「每段确认」那一关：这一步拿到暂停记录里的进度，确认框才说得清是第几段。
  let resumeSegment = null;
  if (resumeDirOf(rawArgs.resume)) {
    try {
      const saved = await readPauseFile(resumeDirOf(rawArgs.resume));
      if (Object.values(saved.operationState || {}).some((state: any) => state.phase === 'review')) {
        if (rawArgs.referenceImagesReviewed !== true) return { kind: 'allow' }; // 只返回图片预览，不能提交视频。
        if (approvalPolicy(ctx, exec) === 'never') return { kind: 'deny', reason: '需要确认转换图片效果与视频重试。' };
        return { kind: 'ask', reason: '请确认已看过转换后的全部图片，图片已呈现非真人风格且符合要求，并同意使用这些图片重试视频一次。视频重试按实际调用计费；图片不合适请拒绝，插件不会自动重画。' };
      }

      effectiveArgs = await estimateArgsFor(config, exec.name, rawArgs);
      const remaining = effectiveArgs.remainingPlan;
      if (remaining?.length === 0) return { kind: 'allow' };
      const lastStep = (saved.steps || []).at(-1);
      resumeSegment = {
        toolName: exec.name,
        done: Number(saved.done) || 0,
        lastSeconds: lastStep?.durationSeconds ?? lastStep?.seconds ?? 0,
        nextSeconds: remaining?.[0]?.seconds ?? 0,
        remainingSeconds: sumStepSeconds(remaining || []),
        remainingSteps: remaining || [],
        inputVideoSeconds: Number(effectiveArgs.inputVideoSeconds) || undefined,
      };
    } catch (error) { return { kind: 'deny', reason: error?.message || String(error) }; }
  }

  // 续做确认框的前半句：第几段做完了、接下来第几段、整条还差多少、还要花多少。
  // 算不出钱就只报秒数，确认框照常弹（不能让估价失败挡住已经确认过的续做）。
  let resumeLead = null;
  if (resumeSegment) {
    const line = segmentContinueLine(resumeSegment);
    let rest = `整条还差 ${resumeSegment.remainingSeconds} 秒`;
    try {
      const measured = await remainingCostText(config, { ...exec, arguments: effectiveArgs }, resumeSegment.remainingSteps, resumeSegment.inputVideoSeconds);
      rest += `（${measured.cost}${measured.remain ? `；${measured.remain}` : ''}）`;
    } catch { /* 估价失败不影响确认框 */ }
    resumeLead = {
      zh: `${line.zh}，${rest}。`,
      en: `${line.en}; about ${resumeSegment.remainingSeconds}s left in the whole video. `,
      tailZh: '点「允许」继续往下做；点「拒绝」就先不继续，已经生成好的分段不用重做，之后可用原进度恢复；上游链接过期且本地文件缺失时需先核对取件状态。',
      tailEn: ' Allow to continue; reject to stop here — the segments already generated are kept and you can resume saved progress later if the local files or upstream results remain available.',
    };
  }

  if (approvalPolicy(ctx, exec) === 'never') {
    return {
      kind: 'deny',
      reason: '当前权限模式关闭了审批提示（完全访问），无法做人工确认，已停止调用。'
        + '把权限切到「工作区写入」或「只读」后再生成视频。',
    };
  }

  const args = exec.arguments && typeof exec.arguments === 'object' ? exec.arguments : {};
  const characterChoice = await characterChoiceGate(ctx, config, exec, args);
  if (characterChoice) return characterChoice;

  // 长视频要在本机合并，缺 ffmpeg 就先停下来：把这次调用退回去，
  // 让模型在对话框里问用户「要不要授权我装 ffmpeg」，而不是闷头生成再丢一堆分段。
  const consent = await ffmpegConsentGate(config, exec, args);
  if (consent) return consent;
  if (isManualKey(config)) {
    assertConfigured(config, resolveApiKey(config));
    const plan = effectiveArgs.remainingPlan ?? estimatePlan(config, exec.name, effectiveArgs);
    const ratio = effectiveArgs.ratio ?? ref(config, 'ratio', '9:16');
    const resolution = resolveResolution(config, effectiveArgs);
    const audio = effectiveArgs.generateAudio ?? ref(config, 'generateAudio', true);
    let costZh, costEn;
    try {
      const measured = estimateSegmentCosts(config, { ...effectiveArgs, ratio, resolution }, plan);
      costZh = `本段基础估价约¥${measured.segments[0].cny.toFixed(4)}，剩余计划${plan.length}段合计约¥${measured.cny.toFixed(4)}（价目日期${measured.priceDate}，倍率1，最低用量补足未计入）`;
      costEn = `This segment ~CNY ${measured.segments[0].cny.toFixed(4)}; remaining ${plan.length} segments ~CNY ${measured.cny.toFixed(4)} (base estimate, multiplier 1; minimum billing excluded)`;
    } catch (error) { costZh = `无法可靠估价（${error?.message || error}）`; costEn = 'A reliable cost estimate is unavailable'; }
    const summary = `${resolveModel(config)} · ${ratio} · ${resolution} · ${audio ? '有音频' : '无音频'} · 本段${plan[0]?.seconds ?? '未知'}秒 · 剩余${plan.map(s => s.seconds).join('+')}秒`;
    return {
      kind: 'ask',
      reason: `${resumeLead?.zh || ''}制作确认：${connectionLabel(config)} ${summary}；${costZh}。按当前 API密钥在渠道的实际用量计费。`,
      displayReason: {
        zh: `${resumeLead?.zh || ''}${summary}；${costZh}。图片及重做另计，按当前 API密钥在渠道的实际用量计费。点「允许」开始本段制作，拒绝则保留已有成果。`,
        en: `${resumeLead?.en || ''}${summary}. ${costEn}. Images and retries cost extra; billed by actual usage. Allow to start this segment; reject to keep existing results.`,
      },
    };
  }
  throw new Error('请在设置页选择有效接入方式并保存。');
}
