import { characterChoiceGate } from './character-choice.js';
/** workflow/approval：从宿主入口拆出的独立职责模块。 */
import { isManualKey, connectionLabel, resolveRegisterApi, assertConfigured, resolveApiKey, resolveModel } from '../providers/connection.js';
import { SERVICE_MODE_AVAILABLE, SERVICE_UNAVAILABLE_MESSAGE } from '../connection-defaults.js';
import { estimateSteps, formatMoney, estimatePlan, estimateUsage } from './costs.js';
import { finiteNumber, clampInteger } from '../utils/validation.js';
import { ref, DEFAULT_USD_EXCHANGE_RATE, DEFAULT_REGISTER_TOKEN, PLUGIN_VERSION, MIN_SECONDS, MAX_SEGMENTS, DEFAULT_QUOTA_PER_UNIT, resolveResolution } from '../config.js';
import { sumStepSeconds, resolveSegmentSeconds, modelMaxSeconds } from './planning.js';
import { ffmpegInstallOptions, hasFfmpeg, resolveBinary } from '../media/ffmpeg.js';
import { resumeDirOf, readPauseFile, resumePlanFrom, assertResumeConnection } from './resume.js';
import {
  consumeWebpayOrder, consumeWalletForGeneration, createWebpayOrder, fetchWebpayStatus,
  fetchWalletStatus, fulfillWebpayOrder, releaseWebpayOrder,
} from '../payment/webpay.js';
import { lastWebpayEnabled } from '../payment/webpay-state.js';

/** 剩下这几段的预估费用文案（确认框里给用户看钱）。 */
export async function remainingCostText(config, exec, remainingSteps, inputVideoSeconds = undefined) {
  if (isManualKey(config)) return { cost: `${connectionLabel(config)}按实际调用计费`, remain: '' };
  try {
    const estimated = estimateSteps(
      config,
      remainingSteps.map((step, index) => ({ ...step, inputSeconds: index ? remainingSteps[index - 1].seconds : inputVideoSeconds })),
      resolveResolution(config, exec?.arguments || {}),
    );
    const groupRatio = finiteNumber(ref(config, 'estimateGroupRatio', 0.8)) ?? 1;
    const usd = estimated.segments.reduce((sum, item) => sum + item.usd, 0) * groupRatio;
    // MetaOnticVideo（服务端领 Key）这条接入方式不读额度：这次能不能做只由服务端的
    // 支付结果决定，余额是中转站自己的事，不该出现在确认框里、更不该挡生成。
    const quota = isManualKey(config) ? await fetchDeviceQuota(config, exec?.signal) : null;
    const data = quota?.status === 'ok' ? quota.data : {};
    const symbol = String(data.currency_symbol || '¥');
    const exchange = finiteNumber(data.usd_exchange_rate) ?? DEFAULT_USD_EXCHANGE_RATE;
    const remainAmount = finiteNumber(data.remain_amount);
    return {
      cost: `预估 ${formatMoney(usd * exchange, symbol)}`,
      remain: quota === null || remainAmount === null ? '' : `本机 Key 剩余 ${formatMoney(remainAmount, symbol)}`,
    };
  } catch (error) {
    return { cost: `预估费用没算出来（${error?.message || error}）`, remain: '' };
  }
}

/**
 * 续做入口（用户点「继续」之后、提交下一段之前）确认框里的「第几段 / 还差多少」说明。
 *
 * 每段生成完停下、等用户确认再 resume，是插件的既定时序；所以每段确认挂在 resume 入口，
 * 由 preflightGate 统一弹一次（同一份进度只出现一个确认框）。不在生成循环中间阻塞：
 * 工具内部卡在审批框时宿主拿不到工具输出，没法先把刚生成好的分段展示给用户，
 * 那样用户是「没看到成果就先被问要不要继续」。
 */
export function segmentContinueLine({ toolName = 'video_generate', done, lastSeconds, nextSeconds }) {
  const action = toolName === 'video_extend' ? '延长' : '生成';
  const finished = done > 0 ? `第 ${done} 段（${lastSeconds} 秒）已经生成好` : '还没有生成任何分段';
  return {
    zh: `${finished}。接下来${action}第 ${done + 1} 段（${nextSeconds} 秒）`,
    en: `${done > 0 ? `Segment ${done} (${lastSeconds}s) is done. ` : ''}Next up: `
      + `${toolName === 'video_extend' ? 'extend' : 'generate'} segment ${done + 1} (${nextSeconds}s)`,
  };
}

/**
 * 问插件服务要「本机这把 Key 还剩多少额度」。
 * 服务端按设备凭据去中转站读密钥详情，只回剩余 / 已用额度。
 * 拿不到（没设备凭据、服务不可用）就回 unknown，由调用方决定怎么写进确认框。
 */
export async function fetchDeviceQuota(config, signal) {
  if (isManualKey(config)) return { status: 'unknown', reason: `${connectionLabel(config)}费用和余额请在渠道控制台查看` };
  if (!SERVICE_MODE_AVAILABLE) return { status: 'unknown', reason: SERVICE_UNAVAILABLE_MESSAGE };
  const api = resolveRegisterApi(config);
  const deviceId = String(ref(config, 'deviceId', '')).trim();
  const deviceSecret = String(ref(config, 'deviceSecret', '')).trim();
  if (!deviceId || !deviceSecret) {
    return {
      status: 'unknown',
      reason: '插件里没有本机设备凭据（在设置页点一次「登录」会写进来，之后就能自动校验额度）',
    };
  }
  const timeout = AbortSignal.timeout(15000);
  const requestSignal = signal ? AbortSignal.any([signal, timeout]) : timeout;
  try {
    const response = await fetch(`${api}/api/v1/register/quota`, {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        'X-Register-Token': String(ref(config, 'registerToken', '')).trim() || DEFAULT_REGISTER_TOKEN,
        ...(PLUGIN_VERSION ? { 'X-Plugin-Version': PLUGIN_VERSION } : {}),
      },
      body: JSON.stringify({ device_id: deviceId, device_secret: deviceSecret }),
      signal: requestSignal,
    });
    const text = await response.text();
    let body: any = {};
    if (text) {
      try {
        body = JSON.parse(text);
      } catch {
        body = { message: text.slice(0, 200) };
      }
    }
    if (!response.ok || (body && typeof body === 'object' && body.code)) {
      return {
        status: 'unknown',
        reason: (body && (body.message || body.detail)) || `HTTP ${response.status}`,
      };
    }
    return { status: 'ok', data: (body && body.data) || body || {} };
  } catch (error) {
    return { status: 'unknown', reason: error?.message || String(error) };
  }
}

/** 收银台链接 + 付款说明：这条正文要退给模型，让模型转达用户去付款。 */
function paymentInstruction(order, toolName, subject, money, what) {
  return [
    `本次生成需要先付款：${subject} ${money}（订单号 ${order.out_trade_no}）。`
      + (what ? `这次要调用：${what}，付过款就不再另弹确认框，直接调用。` : ''),
    '请把下面这条收银台链接原样发给用户，并说明：在浏览器里打开、用支付宝完成付款，'
      + '付完回来回复一声就能继续生成。不要代替用户跳过付款，也不要改用别的方式调用模型。',
    order.pay_url || '（收银台链接没拿到，请让用户在插件设置页点一次「登录」后重试）',
    `用户确认付完款后，用同样的参数重新调用 ${toolName}：插件会自己跟服务端核对这笔订单，`
      + '核对到已支付就兑换凭据并直接调用模型；没核对到还会返回这条说明，不要绕过它。',
  ].join('\n');
}

/**
 * 这次执行「用了哪笔已经付过的钱」：付过款那笔订单被兑换掉之后记在这里，
 * 由工具把这句话写进结果。用户在对话框里能看到「这次没重复扣费」，
 * 而不是只看到视频突然开始生成、以为支付被跳过了。
 */
const paidOrders = new WeakMap();

/** 兑换成功时记一笔：同一个执行对象后面在工具里取回来。 */
export function rememberPaidOrder(exec, info) {
  try {
    if (exec) paidOrders.set(exec, info);
  } catch {
    // 记不住只是少一句说明，不影响生成。
  }
}

/** 把服务端回的付款时间写成用户看得懂的本机时间；认不出来就留空。 */
export function paymentMoment(paidAt) {
  const text = String(paidAt || '').trim();
  if (!text) return '';
  const iso = text.includes('T') ? text : text.replace(' ', 'T');
  const utc = /([Zz]|[+-]\d{2}:?\d{2})$/.test(iso) ? iso : `${iso}Z`;
  const stamp = Date.parse(utc);
  if (!Number.isFinite(stamp)) return '';
  const at = new Date(stamp);
  const pad = value => String(value).padStart(2, '0');
  return `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())} ${pad(at.getHours())}:${pad(at.getMinutes())}`;
}

/** 取回这句说明：一次生成只说一次（记录留着，任务 ID 回写还要用）。 */
export function takePaidNote(exec) {
  let info = null;
  try {
    info = exec ? paidOrders.get(exec) : null;
    if (info?.noted) return '';
    if (info) info.noted = true;
  } catch {
    info = null;
  }
  if (!info) return '';
  if (info.fromBalance) {
    return `本次生成从账户余额里扣了 ${info.money}（${info.subject}，订单 ${info.outTradeNo}`
      + `${info.balanceBefore ? `，扣前余额 ${info.balanceBefore}` : ''}）：不用再付款，也不会有额外的确认步骤。`;
  }
  const moment = paymentMoment(info.paidAt);
  return `本次生成用的是此前已经付过款的订单 ${info.outTradeNo}（${info.subject} ${info.money}`
    + `${moment ? `，付款时间 ${moment}` : ''}）：这次不再重复收费，也不再有额外的确认步骤。`;
}

/** 读一次余额：读不到（老服务端没有钱包接口 / 网络不通）就当没有余额这条路。 */
async function readWallet(config, exec) {
  try {
    const result = await fetchWalletStatus(config, exec?.signal);
    if (result.status !== 'ok' || !result.data || result.data.enabled !== true) return null;
    return result.data;
  } catch {
    return null;
  }
}

/**
 * 一段都没生成成时把凭据还回去：余额扣减的会把钱退回余额，直付的留着下次重试用。
 * 只做一次（同一次执行里多段失败不重复调用），失败也不抛——用户已经拿到视频了。
 */
export async function releasePaidTicket(config, exec) {
  let info = null;
  try {
    info = exec ? paidOrders.get(exec) : null;
  } catch {
    info = null;
  }
  if (!info || info.released || info.taskId) return;
  info.released = true;
  try {
    await releaseWebpayOrder(config, info.outTradeNo, exec?.signal);
  } catch {
    // 还回去失败只影响对账，不影响已经交付的视频
  }
}

/**
 * 拿到视频任务 ID 后回写订单：服务端据此判定这次付款已经履约，控制台也按它对着任务查。
 *
 * 长视频分多段会产生多个任务 ID，每段的 ID 都会回写一次（服务端去重、追加）。
 * 回写失败不抛错：用户已经拿到视频，这里只影响对账；下一次分段还会再试一次。
 */
export async function reportPaidTaskId(config, exec, taskId) {
  const id = String(taskId || '').trim();
  if (!id) return;
  let info = null;
  try {
    info = exec ? paidOrders.get(exec) : null;
  } catch {
    info = null;
  }
  if (!info || info.taskId === id) return;
  info.taskId = id;
  try {
    const result = await fulfillWebpayOrder(config, info.outTradeNo, id, exec?.signal);
    // 回写没成功就把标记让出来：后面的分段、或者下一次生成还能补上这条履约。
    if (result.status !== 'ok') info.taskId = '';
  } catch {
    info.taskId = '';
  }
}

/**
 * 「确认生成视频的时候先付款」的卡口。
 *
 * 只对接入方式 A（服务端领 Key，也就是 MetaOnticVideo 这条接入方式）生效：
 * B MetaOntic AI / C 火山引擎用的是用户自己的 Key，不经过本服务，也就不收钱。
 * 收款由服务端开关控制：没开、或服务端没有这套接口时这里什么都不做，生成流程和以前完全一样。
 * 开着的时候只有两种结果：
 * - 服务端确认这笔已经付过、凭据还没兑换 -> 兑换掉，返回「已付款」标记，调用方直接放行；
 * - 还没付 -> 下单（服务端会复用同一设备那笔未付款订单）并把收银台链接退回给模型；
 *   没有兑换到凭据就绝不调用模型。
 */
export async function paymentGate(config, exec) {
  if (exec.name !== 'video_generate' && exec.name !== 'video_extend') return null;
  // 自带 Key 的接入方式（B / C）不走本服务，也就没有收款这回事。
  if (isManualKey(config)) return null;
  let status = null;
  try {
    status = await fetchWebpayStatus(config, exec.signal);
  } catch {
    status = null;
  }
  // 问不到「要不要收钱」时按不收钱处理：老服务端没有这套接口，不能把生成堵死。
  if (!status) return null;
  if (!status.enabled) {
    if (!status.offline) return null;
    // 服务端没答上来，但上次问到的结论是「这里收钱」：宁可不生成，也不白送一次。
    // 否则把收款接口打不通（改 hosts、断代理）就成了免费生成的通道。
    let known = false;
    try {
      known = await lastWebpayEnabled(resolveRegisterApi(config));
    } catch {
      known = false;
    }
    if (!known) return null;
    return {
      kind: 'deny',
      reason: `收款服务连不上（${status.reason || '服务端没有响应'}），已停止调用：这次没有调用模型、`
        + '没有产生费用。请确认这台机器能访问插件服务（设置页里的服务地址）后重试；'
        + '如果服务端已经关掉网站支付收款，这次拦截可以忽略，但仍需先恢复网络。',
    };
  }

  const symbol = String(status.currency || 'CNY').toUpperCase() === 'CNY' ? '¥' : `${status.currency} `;
  const subject = status.subject || 'AI 视频生成';
  // 先看余额：够就直接扣一次，不用把用户甩到浏览器里付款
  const wallet = await readWallet(config, exec);
  if (wallet && wallet.enabled) {
    const price = Number(wallet.price || status.amount || 0);
    const balance = Number(wallet.balance || 0);
    const priceText = formatMoney(price, wallet.currency_symbol || symbol);
    if (balance >= price) {
      const consumed = await consumeWalletForGeneration(config, exec.signal);
      if (consumed.status === 'ok' && consumed.data?.out_trade_no) {
        rememberPaidOrder(exec, {
          outTradeNo: consumed.data.out_trade_no,
          subject,
          money: priceText,
          paidAt: consumed.data.paid_at,
          fromBalance: true,
          balanceBefore: formatMoney(balance, wallet.currency_symbol || symbol),
        });
        return { kind: 'paid', outTradeNo: consumed.data.out_trade_no, subject, money: priceText };
      }
      // 余额刚好被别人用掉/扣减失败：往下走直付，不能让这次生成白等
    } else {
      return {
        kind: 'deny',
        reason: `余额不足：当前 ${formatMoney(balance, wallet.currency_symbol || symbol)}，`
          + `本次生成需要 ${priceText}。请在插件设置页的额度区点「充值」，把金额充上后重试；`
          + '（也可以选择单次直付：充值不可用时按提示重新发起一次生成。）',
      };
    }
  }
  let order = null;
  try {
    order = await createWebpayOrder(config, exec.signal);
  } catch (error) {
    order = null;
  }
  if (!order) {
    return {
      kind: 'deny',
      reason: '收款服务暂时不可用，已停止调用：请稍后重试；如果一直不可用，'
        + '请检查服务端网站支付配置（WEBPAY_*）与网络。这次没有调用模型、没有产生费用。',
    };
  }
  const money = formatMoney(Number(order.amount ?? status.amount ?? 0), symbol);
  if (order.status === 'PAID') {
    const consumed = await consumeWebpayOrder(config, order.out_trade_no, exec.signal);
    // 付过款就是这次调用的人工确认：调用方据此直接放行，不再弹一次费用确认框。
    if (consumed.status === 'ok') {
      rememberPaidOrder(exec, { outTradeNo: order.out_trade_no, subject, money, paidAt: order.paid_at });
      return { kind: 'paid', outTradeNo: order.out_trade_no, subject, money };
    }
    return {
      kind: 'deny',
      reason: `这笔订单的支付凭据没能兑换（${consumed.reason || '服务端没有确认'}），已停止调用，`
        + `没有调用模型、没有产生费用。订单号 ${order.out_trade_no}：请把这条原因告诉用户，`
        + '让用户在插件设置页点一次「登录」后重试；同一笔付款只能兑换一次，不要重复付款。',
    };
  }
  return {
    kind: 'deny',
    reason: paymentInstruction(
      order,
      exec.name,
      subject,
      money,
      `${resolveModel(config)} · ${resolveResolution(config, exec.arguments || {})}`,
    ),
    info: { webpayPending: true, out_trade_no: order.out_trade_no, pay_url: order.pay_url },
  };
}

/** 宿主当前的审批策略：never 表示「审批提示被关掉」，这时候没法人工确认。 */
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
        + '点了「允许」才会执行，装完会自动接着把视频生成出来。',
      en: `About to install ffmpeg on this machine: ${command} (${os}). `
        + 'It runs only after you allow it; the video generation continues right after.',
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
    `本机没有 ${binary}，这条成片是 ${allSteps.reduce((sum, step) => sum + step.seconds, 0)} 秒`
      + `（会拆成 ${allSteps.length} 段：${sizes}），没有 ffmpeg 就没法合并成一条，所以先停下来了，`
      + '还没有调用模型、没有产生费用。',
    '请在对话框里先和用户确认，不要自己绕过这一步：',
    `1) 问用户要不要现在装 ffmpeg —— 说清他的系统（${os}）和命令：${command}`,
    '   （装好后重跑这次生成就会自动合并成一条，分段不用重新生成）。',
    '2) 用户同意安装：调用 video_setup（install:true）——插件会执行上面的命令，'
      + '宿主会先把这条命令拿给用户确认；装完它会自己验证，成功后你按原 duration 重新调用 '
      + 'video_generate 继续生成即可（一般是先装包管理器：本机连 brew 都没有时，'
      + 'video_setup 会返回 nextStep，用 target:"package-manager" 再装一次）。',
    '3) 用户不想装、或者装不了：带 `merge:false` 重新调用 video_generate，'
      + '插件就只生成并返回分段列表（每段链接 + 本地文件），这次不会再拦。',
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
 * 真正调用模型前的卡口：只做人工确认，余额仅用于展示，不再阻断调用。
 *
 * - 审批提示被关掉（完全访问模式）：拒绝，并说明怎么打开；
 * - 读不到剩余额度：照常弹确认框，把「读不到额度」的原因写清楚；
 * - 其余情况：返回 ask，宿主弹审批面板给用户看预估费用，点「允许」才会执行。
 */
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
    return { kind: 'ask', reason: '调用 Seedream 将真人参考图转为非真人风格；图片生成单独按实际调用计费，视频费用另计。', displayReason: { zh: '将调用 Seedream 处理参考图，图片调用单独计费，视频费用另计。确认后开始处理。', en: 'Use Seedream to stylize the reference. Image calls are billed separately from video. Confirm to proceed.' } };
  }

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
      const measured = await remainingCostText(config, exec, resumeSegment.remainingSteps, resumeSegment.inputVideoSeconds);
      rest += `（${measured.cost}${measured.remain ? `；${measured.remain}` : ''}）`;
    } catch { /* 估价失败不影响确认框 */ }
    resumeLead = {
      zh: `${line.zh}，${rest}。`,
      en: `${line.en}; about ${resumeSegment.remainingSeconds}s left in the whole video. `,
      tailZh: '点「允许」继续往下做；点「拒绝」就先不继续，已经生成好的分段不用重做，之后随时能接着做（不用重头再来）。',
      tailEn: ' Allow to continue; reject to stop here — the segments already generated are kept and you can continue later.',
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
  // A 服务端方式停用期间先拦住：不让用户走完脚本审核和确认，再在提交阶段失败。
  if (!SERVICE_MODE_AVAILABLE && !isManualKey(config)) return { kind: 'deny', reason: SERVICE_UNAVAILABLE_MESSAGE };
  const characterChoice = await characterChoiceGate(ctx, config, exec, args);
  if (characterChoice) return characterChoice;

  // 长视频要在本机合并，缺 ffmpeg 就先停下来：把这次调用退回去，
  // 让模型在对话框里问用户「要不要授权我装 ffmpeg」，而不是闷头生成再丢一堆分段。
  const consent = await ffmpegConsentGate(config, exec, args);
  if (consent) return consent;
  // 服务端开着网站支付时，先收钱再谈别的：没拿到已支付凭据就不调用模型。
  const payment = await paymentGate(config, exec);
  if (payment && payment.kind !== 'paid') return payment;
  // 已经付过这次生成的钱：付款本身就是这次调用的人工确认，不再弹一次费用确认框。
  if (payment) return { kind: 'allow' };
  if (isManualKey(config)) {
    assertConfigured(config, resolveApiKey(config));
    return {
      kind: 'ask',
      reason: `${resumeLead ? resumeLead.zh : ''}调用${connectionLabel(config)} ${resolveModel(config)} · ${resolveResolution(config, effectiveArgs)}，按渠道账户实际用量计费。`,
      displayReason: {
        zh: `${resumeLead ? resumeLead.zh : ''}本次将通过${connectionLabel(config)}生成 ${resolveResolution(config, effectiveArgs)} 视频，按渠道账户实际用量计费。确认后开始。${resumeLead ? resumeLead.tailZh : ''}`,
        en: `${resumeLead ? resumeLead.en : ''}Generate ${resolveResolution(config, effectiveArgs)} video via ${connectionLabel(config)}, billed to your channel account. Confirm to continue.${resumeLead ? resumeLead.tailEn : ''}`,
      },
    };
  }
  let estimate = null;
  try {
    const prepared = await estimateArgsFor(config, exec.name, args);
    const plan = prepared.remainingPlan ?? estimatePlan(config, exec.name, prepared);
    estimate = estimateUsage(config, exec.name, prepared, plan.slice(0, 1));
  } catch {
    estimate = null;
  }

  // 自带 Key 的接入方式才显示额度；MetaOnticVideo 接入不查余额（见上）。
  const showsQuota = isManualKey(config);
  const quota = showsQuota ? await fetchDeviceQuota(config, exec.signal) : null;
  const data = quota?.status === 'ok' ? quota.data : {};
  const symbol = String(data.currency_symbol || '¥');
  const perUnit = finiteNumber(data.quota_per_unit) ?? DEFAULT_QUOTA_PER_UNIT;
  const exchange = finiteNumber(data.usd_exchange_rate) ?? DEFAULT_USD_EXCHANGE_RATE;

  const needQuota = estimate ? Math.round(estimate.usd * perUnit) : null;
  const needMoney = estimate ? formatMoney(estimate.usd * exchange, symbol) : null;

  const remainQuota = finiteNumber(data.remain_quota);
  const remainAmount = finiteNumber(data.remain_amount);

  // 用户看到的只有钱：额度数字（「约 65.7 万额度」这种）是内部口径，确认框里不显示。
  const costText = needMoney === null ? '这次调用的费用没法预估' : `预估 ${needMoney}`;
  const remainMoneyText = `${formatMoney(remainAmount === null ? 0 : remainAmount, symbol)}`;
  // 用户看的只有钱；额度数字只留在下面那条审计文本里
  const remainZh = !showsQuota
    ? '费用按插件服务的支付与用量结算'
    : remainQuota === null
      ? `本机 Key 的额度读不到（${quota.reason || '服务端没回额度'}）`
      : `本机 Key 剩余 ${remainMoneyText}`;
  const remainEn = !showsQuota
    ? 'billing follows the plugin service payment and usage'
    : remainQuota === null
      ? `this key's quota could not be read (${quota.reason || 'the service returned none'})`
      : `this key has ${remainMoneyText} left`;

  const total = estimate
    ? `${estimate.model} · ${estimate.resolution} · ${planSummary(estimate)}`
    : `${resolveModel(config)} · ${resolveResolution(config, effectiveArgs)}`;
  // 审计那条（模型看）保留 token / 额度这类内部口径，方便对着中转站日志核对
  const auditTax = estimate
    ? `预估消耗 ${estimate.tokens.toLocaleString('en-US')} token ≈ ${needMoney ?? '无法预估'}`
      + `（${!showsQuota ? 'MetaOnticVideo 接入不看额度' : needQuota === null ? '额度未知' : `${needQuota.toLocaleString('en-US')} 额度`}）`
    : '这次调用的费用无法预估';
  return {
    kind: 'ask',
    reason: `${resumeLead ? resumeLead.zh : ''}人工确认：调用视频模型（${total}）。${auditTax}；`
      + (showsQuota
        ? `本机 Key 剩余 ${remainQuota === null ? '额度读不到' : `${remainMoneyText} / ${remainQuota.toLocaleString('en-US')} 额度`}。`
        : '费用按插件服务端的支付与用量结算。'),
    displayReason: {
      zh: `${resumeLead ? resumeLead.zh : ''}本次会调用视频模型：${total}；${costText}，${remainZh}。点了「允许」才会真正调用。${resumeLead ? resumeLead.tailZh : ''}`,
      en: `${resumeLead ? resumeLead.en : ''}This will call the video model: ${total}. Estimated cost `
        + `${needMoney === null ? 'unknown' : needMoney}; ${remainEn}. `
        + 'The call runs only after you allow it.' + (resumeLead ? resumeLead.tailEn : ''),
    },
  };
}
