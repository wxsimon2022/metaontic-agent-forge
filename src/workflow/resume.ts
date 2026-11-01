/** workflow/resume：从宿主入口拆出的独立职责模块。 */
import path from 'node:path';
import { readFile, open, rm, mkdir, writeFile, rename } from 'node:fs/promises';
import { ref, MAX_SEGMENT_SECONDS, MAX_SEGMENTS, MIN_SECONDS, MAX_TOTAL_SECONDS } from '../config.js';
import { uniqueSuffix } from '../utils/files.js';
import os from 'node:os';
import { requestLogContext, appendRequestLog } from '../utils/logging.js';
import { isMetaontic, isVolcengine, resolveModel, resolveBaseUrl, resolveSubmitPath, resolveQueryPath } from '../providers/connection.js';
import { sumStepSeconds, modelMaxSeconds } from './planning.js';

/* ---------------- 长视频的循环迭代：分段之间的人工确认 + 暂停后接着做 ---------------- */

/**
 * 暂停记录文件名。长视频是「先直出、再逐段延长」，每段生成完都先问用户要不要继续；
 * 用户点了「先不继续」就把「已经生成到哪一步」写进这个文件，随时能用 resume 接着做。
 */
export const PAUSE_FILE = 'paused-plan.json';

/** resume 参数：目录路径字符串，或上次结果里那个 resumeDir 对象。 */
export function resumeDirOf(value) {
  const raw = typeof value === 'string'
    ? value
    : (value?.dir ?? value?.path ?? value?.resumeDir ?? value?.token ?? '');
  const dir = String(raw ?? '').trim();
  return dir ? path.resolve(dir) : '';
}

export async function readPauseFile(dir) {
  const file = path.join(dir, PAUSE_FILE);
  let text;
  try {
    text = await readFile(file, 'utf8');
  } catch {
    throw new Error(
      `没有找到暂停记录：${file}。resume 要传上一次结果里的 resumeDir`
      + '（用户选择先不继续时，结果里给的那个分段目录），不要自己拼路径。',
    );
  }
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`暂停记录不是合法 JSON：${file}。`);
  }
  if (data?.plugin !== 'metaontic-video' || !Array.isArray(data.plan) || !data.plan.length) {
    throw new Error(`暂停记录内容不对（不是本插件写的）：${file}。`);
  }
  return data;
}

/* ---------------- 暂停目录的「续做锁」：同一份进度只能有一次 resume 在跑 ---------------- */

export const RESUME_LOCK = 'resume.lock';

/** 锁过期时间：0 / 负数表示永不过期（配置成 0 的人就是不想让后来者抢）。 */
export function resumeLockStaleMs(config) {
  const minutes = Number(ref(config, 'resumeLockStaleMinutes', 60));
  if (!Number.isFinite(minutes) || minutes <= 0) return 0;
  return minutes * 60 * 1000;
}

/** 锁文件是不是「过期残留」（进程被杀 / 宿主放弃调用，没来得及删）：只有过期才允许抢过来。 */
export async function resumeLockExpired(file, staleMs) {
  const raw = await readFile(file, 'utf8').catch(() => null);
  if (raw === null) return true;              // 刚好被删掉：当成可以重试
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    return true;                              // 内容坏了（崩在写锁中途）：当过期
  }
  const started = Date.parse(String(data?.startedAt || ''));
  if (!Number.isFinite(started)) return true;
  if (!staleMs) return false;
  return Date.now() - started > staleMs;
}

/** 读锁文件里「谁拿着」，只用来写一句清楚的报错。 */
export async function describeResumeLock(file) {
  const raw = await readFile(file, 'utf8').catch(() => null);
  if (!raw) return '';
  try {
    const data = JSON.parse(raw);
    const bits = [data?.tool, data?.startedAt && `${data.startedAt} 开始`, data?.pid && `pid ${data.pid}`]
      .filter(Boolean);
    return bits.length ? `（${bits.join('，')}）` : '';
  } catch {
    return '';
  }
}

/**
 * 拿到「续做锁」：用 `wx` 独占创建锁文件，这个操作是原子的，同进程 / 跨进程都拦得住。
 * 用户连点两次「继续」、或两个会话同时去续做同一份暂停进度时，只有第一个能进，
 * 第二个直接报错——否则双方各自把剩下的段提交一遍，同样的段生成两遍、钱花两遍。
 * @returns { file, release } —— release 只删自己写的那把锁（目录可能已经换人用了）。
 */
export async function acquireResumeLock(dir, { toolName, callId, staleMs }) {
  const empty = { file: null, async release() {} };
  const file = path.join(dir, RESUME_LOCK);
  const token = uniqueSuffix('lock');
  const record = {
    tool: toolName,
    callId: callId || null,
    pid: process.pid,
    host: os.hostname(),
    startedAt: new Date().toISOString(),
    token,
  };
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const handle = await open(file, 'wx');
      try {
        await handle.writeFile(`${JSON.stringify(record, null, 2)}\n`, 'utf8');
      } finally {
        await handle.close();
      }
      return {
        file,
        async release() {
          const raw = await readFile(file, 'utf8').catch(() => null);
          if (raw) {
            try {
              if (JSON.parse(raw)?.token !== token) return;   // 已经被别人接手了，别删
            } catch {
              return;
            }
          }
          await rm(file, { force: true }).catch(() => {});
        },
      };
    } catch (failure) {
      // 目录都还没有（resume 传错路径）：不拦，交给下面「没找到暂停记录」的提示去说清楚
      if (failure?.code === 'ENOENT') return empty;
      if (failure?.code !== 'EEXIST') throw failure;
      if (attempt === 0 && await resumeLockExpired(file, staleMs)) {
        await rm(file, { force: true }).catch(() => {});
        continue;
      }
      const holder = await describeResumeLock(file);
      const minutes = staleMs ? Math.round(staleMs / 60000) : 0;
      throw Object.assign(new Error(
        `这份暂停进度已经有一次「继续」在跑了${holder}，先别同时续做：两份请求会把剩下的段各提交一遍、`
        + '重复扣费。等它跑完再用 resume（结果里会说完成片在哪）。'
        + (minutes
          ? `如果确认那一次已经中断了，等 ${minutes} 分钟锁会自动过期，也可以把 ${file} 删掉再试。`
          : `确认那一次已经中断了就删掉 ${file} 再试。`),
      ), { code: 'resume_locked' });
    }
  }
  throw new Error(`拿不到 ${file} 的锁（同名文件一直被抢），稍后重试。`);
}

export function withResumeLock(tool, toolName, config) {
  return {
    ...tool,
    async execute(args, exec) {
      return requestLogContext.run({ callId: exec?.callId || uniqueSuffix('call'), tool: toolName }, async () => {
        const started = Date.now();
        const dir = resumeDirOf(args?.resume);
        let lock;
        await appendRequestLog({ event: 'tool_started', provider: isMetaontic(config) ? 'metaontic' : isVolcengine(config) ? 'volcengine' : 'service',
          model: resolveModel(config), duration: args?.duration, segmentSeconds: args?.segmentSeconds,
          resuming: Boolean(dir), resumeDir: dir || undefined });
        try {
          if (dir) {
            lock = await acquireResumeLock(dir, { toolName, callId: exec?.callId, staleMs: resumeLockStaleMs(config) });
            await appendRequestLog({ event: 'resume_lock_acquired', resumeDir: dir });
          }
          const result = await tool.execute(args, exec);
          if (result?.resumeDir) {
            const record = await readPauseFile(result.resumeDir);
            record.deliveryPending = Boolean(result.deliveryError || result.ffmpegMissing);
            await writePauseFile(result.resumeDir, record);
          }
          await appendRequestLog({ event: 'tool_completed', elapsedMs: Date.now() - started,
            status: result?.status, paused: result?.paused, videoPath: result?.videoPath,
            segmentsDir: result?.segmentsDir, segmentCount: result?.segments?.length,
            actualSeconds: result?.actualSeconds, errorCode: result?.errorCode });
          return result;
        } catch (error) {
          await appendRequestLog({ event: 'tool_failed', elapsedMs: Date.now() - started, errorCode: String(error?.code || 'tool_error') });
          throw error;
        } finally {
          if (lock) { await lock.release(); await appendRequestLog({ event: 'resume_lock_released', resumeDir: dir }); }
        }
      });
    },
  };
}

export async function writePauseFile(dir, data) {
  await mkdir(dir, { recursive: true, mode: 0o700 });
  const file = path.join(dir, PAUSE_FILE);
  // 先写唯一的临时文件、再原子 rename 顶上：并发读（另一次 resume）不会读到写到一半的 JSON。
  const temp = `${file}.${uniqueSuffix('part')}`;
  try {
    await writeFile(temp, `${JSON.stringify(data, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
    await rename(temp, file);
  } catch (failure) {
    await rm(temp, { force: true }).catch(() => {});
    throw failure;
  }
}

/**
 * 接着跑：默认沿用原计划剩下的段；这次传了更大的 duration 就按每段上限往后补延伸段。
 * @returns fullPlan 整条视频从头到尾的计划（暂停时写回记录用）、plan 这次要跑的部分、
 *   cursor 已经生成好的秒数、total 整条的总秒数。
 */
export function resumePlanFrom(data, { askedTotal, segmentSeconds }) {
  const done = Number(data.done) || 0;
  const cursor = Number(data.cursor) || 0;
  const fullPlan = (data.plan || []).map((step) => ({ ...step }));
  const remaining = fullPlan.slice(done).map((step) => ({ ...step }));
  const wanted = Number.isFinite(askedTotal) ? Math.min(askedTotal, MAX_TOTAL_SECONDS) : 0;
  const cap = segmentSeconds > 0 ? segmentSeconds : MAX_SEGMENT_SECONDS;
  let total = cursor + sumStepSeconds(remaining);
  while (wanted > total && fullPlan.length < MAX_SEGMENTS && total + MIN_SECONDS <= wanted) {
    const seconds = Math.max(MIN_SECONDS, Math.min(cap, wanted - total));
    fullPlan.push({ kind: 'extend', seconds });
    remaining.push({ kind: 'extend', seconds });
    total += seconds;
  }
  return { fullPlan, plan: remaining, cursor, total };
}

/** 续做时要沿用的参数：调用方只传 resume 时，靠这份记录还原上次的口径。 */
export function pickResumeOptions(args) {
  const keys = [
    'mode', 'ratio', 'generateAudio', 'watermark', 'segmentPrompts', 'transitionDescription', 'merge',
    // 这几个是 video_extend 的口径（延长方向、提示词写法、整片时间轴位置）
    'direction', 'wording', 'startAt', 'inputVideoSeconds',
    'firstFrameUrl', 'lastFrameUrl', 'referenceImages', 'resolution', 'seed', 'user', 'returnLastFrame',
  ];
  const options = {};
  for (const key of keys) {
    if (args?.[key] !== undefined) options[key] = args[key];
  }
  return options;
}

/** 暂停时写进分段目录的记录：接着做时照它恢复计划、进度和最后一段的链接。 */
export function pauseRecordAt({ stamp, prompt, fullPlan, done, cursor, lastVideoUrl, options, segments }) {
  return {
    plugin: 'metaontic-video',
    kind: 'paused-plan',
    version: 1,
    createdAt: new Date().toISOString(),
    stamp,
    prompt,
    plan: fullPlan,
    done,
    cursor,
    lastVideoUrl,
    options,
    steps: segments.map((segment) => ({
      index: segment.index,
      kind: segment.kind,
      seconds: segment.seconds,
      taskId: segment.taskId,
      videoUrl: segment.videoUrl,
    })),
  };
}

/** 暂停后怎么接着做：这段说明会交到模型手里，正是「循环迭代」的续做入口。 */
export function resumeHint(dir, remainingSeconds, toolName = 'video_generate') {
  return `要接着做就把 resume="${dir}" 再调一次 ${toolName}（prompt 可以省略，其余参数照旧）：`
    + `插件会接着已经生成的分段继续，剩下的 ${remainingSeconds} 秒不用重头生成、不会重复扣费。`;
}

/** Non-secret connection identity. Never copy API keys into progress files. */
export function progressConnection(config) {
  return {
    provider: isMetaontic(config) ? 'metaontic' : isVolcengine(config) ? 'volcengine' : 'service',
    model: resolveModel(config), baseUrl: resolveBaseUrl(config),
    submitPath: resolveSubmitPath(config), queryPath: resolveQueryPath(config, '{task_id}'),
  };
}

export function assertResumeConnection(data, config, args) {
  if (!data?.connection) return; // Old records predate connection snapshots.
  if (JSON.stringify(data.connection) === JSON.stringify(progressConnection(config))) return;
  if (data.pendingTask || Object.values(data.operationState || {}).some((state: any) => state.phase === 'converting' || state.phase === 'review' || (state.retryUsed && !state.retryResult))) throw new Error('这份进度还有已提交的任务，请恢复原模型和接入渠道后查询，不能切换渠道重复提交。');
  if (args?.resumeWithCurrentConfig === true) {
    if (data.plan.slice(Number(data.done) || 0).some(step => step.seconds > modelMaxSeconds(config))) {
      throw new Error('原进度中的分段超过当前模型单段上限，请恢复原模型后继续，不自动缩短已审核分段。');
    }
    return;
  }
  throw new Error('当前模型或接入渠道与原进度不一致。请恢复原配置；如需更换，先向用户说明变化并确认，再传 resumeWithCurrentConfig:true。');
}

/** Persist before delivery, including pending task IDs and the final completed cursor. */
export async function saveProgress(dir, { config, toolName, stamp, prompt, fullPlan, cursor, referenceUrl, options, segments, pendingTask, operationState = {} }) {
  const completed = segments.filter(step => step.status === 'succeeded' && step.videoUrl);
  const record = pauseRecordAt({ stamp, prompt, fullPlan, done: completed.length, cursor,
    lastVideoUrl: referenceUrl, options, segments: completed });
  Object.assign(record, { toolName, connection: progressConnection(config),
    deliveryPending: !pendingTask && completed.length > 0,
    state: pendingTask ? 'pending' : completed.length >= fullPlan.length ? 'completed' : 'paused',
    pendingTask: pendingTask || null, operationState });
  await writePauseFile(dir, record);
}
