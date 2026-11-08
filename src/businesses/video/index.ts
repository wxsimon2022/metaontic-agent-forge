import type { BusinessModule, BusinessRuntime } from '../../core/runtime.js';
import { withMediaPreview } from './workflow/media-preview.js';
import { createSegmentReview, assertSegmentReviewed } from './workflow/segment-review.js';
import { isVideoDirector } from './prompts/scope.js';
import { projectTool } from './tools/video-project.js';
import { assertProjectApproved, withProjectApproval } from './workflow/project.js';
import { createStoryboardReviewGuard } from './workflow/storyboard-review.js';
import { createDeliveryOrderGuard } from './workflow/delivery-order.js';
import { createScriptTracker } from './workflow/script-tracking.js';
import { stageTool } from './tools/video-stage.js';
/** Harness 插件入口：注册工具、动态提示词与可选宿主服务。 */
import { withActualCost } from './workflow/actual-cost.js';
import { withVideoExecution } from './workflow/execution.js';
import { withResumeLock } from './workflow/resume.js';
import { jsonSafeTool } from '../../core/utils/json.js';
import { submissionTool } from './tools/media-submission.js';
import { prepareImageTool } from './tools/video-prepare-image.js';
import { videoTool } from './tools/video-generate.js';
import { extendTool } from './tools/video-extend.js';
import { taskTool } from './tools/video-status.js';
import { setupTool } from './tools/video-setup.js';
import { hyperframesTool } from './internal/hyperframes.js';
import { estimateTool } from './tools/video-estimate.js';
import { configTool } from './tools/video-config.js';
import { buildPromptGuidance } from './prompts/guidance.js';
import { GATED_TOOLS } from './config.js';
import { preflightGate } from './workflow/approval.js';
import { ffmpegInstallOptions } from './media/ffmpeg.js';
import { isManualKey, connectionLabel } from './providers/connection.js';


/**
 * 宿主注入回调的清理函数：只有真的是函数才交给公共生命周期。
 * （宿主没有那项服务时 inject 不跑回调，返回值可能是 undefined。）
 */
function asDisposer(value: unknown): (() => void) | undefined {
  return typeof value === 'function' ? (value as () => void) : undefined;
}

function applyVideoBusiness(runtime: BusinessRuntime) {
  const { ctx, config } = runtime;
  // 可选服务的宿主对象（会话工作目录等），拿到就放进来
  const deps: Record<string, any> = {};
  const segmentReview = createSegmentReview(ctx);
  const segmentObserver = (ctx as any).on('session/event', segmentReview.observe);
  runtime.defer(segmentObserver);
  const storyboardReview = createStoryboardReviewGuard();
  const deliveryOrder = createDeliveryOrderGuard();
  const storyboardObserver = (ctx as any).on('session/event', storyboardReview.observe);
  runtime.defer(storyboardObserver);
  // 交付顺序同样只看会话事件：成片本轮是否已经登记过，决定分段能不能单独展示。
  const deliveryObserver = (ctx as any).on('session/event', deliveryOrder.observe);
  runtime.defer(deliveryObserver);
  // 脚本落盘就是脚本设计阶段的真实终点：由插件收口，助手不必再补一次计时标记。
  const scriptObserver = (ctx as any).on('session/event', createScriptTracker().observe);
  runtime.defer(scriptObserver);
  let confirmationReady = false;
  const register = (tool) => {
    const guarded = !GATED_TOOLS.includes(tool.name) ? tool : { ...tool, async execute(args, exec) {
      if (!confirmationReady) throw new Error('人工确认服务未就绪，已停止操作；请恢复插件确认能力后重试，未提交付费任务。');
      return tool.execute(args, exec);
    } };
    return runtime.tools.register('video', withMediaPreview(guarded));
  };
  register(jsonSafeTool(stageTool()));
  register(jsonSafeTool(projectTool(config, ctx, storyboardReview, videoTool(config, deps, ctx).parameters.properties, extendTool(config, deps, ctx).parameters.properties, segmentReview)));
  register(jsonSafeTool(estimateTool(config)));
  register(jsonSafeTool(submissionTool(config)));
  register(jsonSafeTool(prepareImageTool(config)));
  register(withVideoExecution(withResumeLock(jsonSafeTool(withActualCost(withProjectApproval(videoTool(config, deps, ctx), config), config)), 'video_generate', config), deliveryOrder.remember));
  register(withVideoExecution(withResumeLock(jsonSafeTool(withActualCost(withProjectApproval(extendTool(config, deps, ctx), config), config)), 'video_extend', config), deliveryOrder.remember));
  register(withVideoExecution(jsonSafeTool(withActualCost(taskTool(config), config))));
  register(jsonSafeTool(setupTool(config)));
  // 雪藏功能：默认不注册，不进入对外技能和提示词，仅供内部显式启用。
  if (process.env.METAONTIC_VIDEO_INTERNAL_HYPERFRAMES === '1') {
    runtime.defer(register(jsonSafeTool(hyperframesTool(config, deps))));
  }
  // 配置工具依赖宿主的 settings 服务；没有该服务时插件其余功能照常可用。
  const cleanup = ctx.inject(['settings'], settingsCtx =>
    runtime.tools.register('video', jsonSafeTool(configTool(config, settingsCtx.settings)), settingsCtx));
  for (const dispose of [asDisposer(cleanup)]) if (dispose) runtime.defer(dispose);
  // 会话工作目录也是可选的：宿主不提供时合并结果落在进程 cwd 下。
  const workdirCleanup = ctx.inject(['workingDirectory'], (workdirCtx) => {
    deps.workdir = workdirCtx.workingDirectory;
    return () => { deps.workdir = undefined; };
  });
  for (const dispose of [asDisposer(workdirCleanup)]) if (dispose) runtime.defer(dispose);
  // 每次调用视频模型前由宿主弹人工费用确认。
  // 注册或预检本身出问题都不该把生成堵死：那样退回「没有预估数字」的人工确认。
  let gateCleanup;
  try {
    gateCleanup = ctx.on('tools/pre-execute', async (exec, next) => {
      if (!runtime.tools.allowed('video', exec)) {
        if (runtime.tools.owner(exec.name) === 'video') return { kind: 'deny', reason: '当前助手未启用视频业务，请切换到视频助手后重试。' };
        return next();
      }
      const storyboardGate = isVideoDirector({ agent: exec.agent }, ctx) ? await storyboardReview.gate(exec) : null;
      if (storyboardGate) return storyboardGate;
      const orderGate = await deliveryOrder.gate(exec);
      if (orderGate) return orderGate;
      if (!GATED_TOOLS.includes(exec.name)) return next();
      if (['video_generate', 'video_extend'].includes(exec.name)) {
        try { await assertSegmentReviewed(exec, exec.arguments || {}); await assertProjectApproved(config, exec, exec.arguments || {}); }
        catch (error) { return { kind: 'deny', reason: error?.message || String(error) }; }
      }
      try {
        return await preflightGate(ctx, config, exec);
      } catch (error) {
        const message = error?.message || String(error);
        if (exec.name === 'video_prepare_image') return { kind: 'deny', reason: '图片费用确认未能完成，请先恢复确认能力；未取得同意不生成图片。' };
        if (exec.name === 'video_setup') {
          const command = ffmpegInstallOptions().installs[0].command;
          return {
            kind: 'ask',
            reason: `人工确认：准备执行安装命令「${command}」（预检本身出错：${message}）。`,
            displayReason: {
              zh: `准备在这台电脑上装 ffmpeg：${command}。点了「允许」才会执行。`,
              en: `About to install ffmpeg on this machine: ${command}. It runs only after you allow it.`,
            },
          };
        }
        if (isManualKey(config)) return {
          kind: 'ask',
          reason: `人工确认：调用${connectionLabel(config)}（预检异常：${message}）。`,
          displayReason: { zh: `本次通过${connectionLabel(config)}调用视频模型，按实际调用计费。预检异常：${message}。确认后继续。`, en: `Call the video model with actual usage billing. Preflight error: ${message}. Confirm to continue.` },
        };
        return {
          kind: 'ask',
          reason: `人工确认：调用视频模型（预估费用没算出来：${message}）。`,
          displayReason: {
            zh: `本次会调用视频模型，但预估费用没算出来（${message}）。`
              + '点了「允许」才会真正调用。',
            en: 'This will call the video model, but the cost estimate failed. '
              + 'The call runs only after you allow it.',
          },
        };
      }
    });
    confirmationReady = true;
  } catch (error) {
    ctx.logger?.warn?.(
      `metaontic-video: 调用前的人工确认卡口注册失败：${error?.message || error}`,
    );
  }
  if (typeof gateCleanup === 'function') runtime.defer(gateCleanup);
}

export const videoBusiness: BusinessModule = { id: 'video', apply: applyVideoBusiness, prompt: buildPromptGuidance };
