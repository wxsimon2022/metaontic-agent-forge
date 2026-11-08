import { timedStage } from '../../../core/utils/timing.js';
/** media/merge：从宿主入口拆出的独立职责模块。 */
import { type RunOptions } from '../providers/types.js';
import { uniqueSuffix, exists, tail, formatSeconds } from '../utils/files.js';
import { runProcess, resolveBinary, probeMedia, hasFfmpeg, ffmpegInstallHint } from './ffmpeg.js';
import { rm, mkdir, writeFile, rename, stat, copyFile } from 'node:fs/promises';
import path from 'node:path';
import { ref, CUMULATIVE_TOLERANCE_MIN_SECONDS, CUMULATIVE_TOLERANCE_RATIO } from '../config.js';
import { isOmniExtendModel, resolveModel } from '../providers/connection.js';
import { downloadFile } from './download.js';
import { appendRequestLog } from '../../../core/utils/logging.js';

function evenNumber(value, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return fallback;
  const rounded = Math.round(number);
  const even = rounded % 2 === 0 ? rounded : rounded - 1;
  // 极小（1 这种）或异常值会算出 0，scale=0 会让 ffmpeg 直接失败，兜底成 2。
  return even >= 2 ? even : 2;
}

/**
 * 把分段合并成一个文件：先试无损拼接，需要时统一重编码（带音频，失败再退回只并视频）。
 */
/** 分段的音频比视频长出这么多帧时，认为封装补白会在接缝处留下空洞。 */
const AUDIO_PADDING_TOLERANCE_FRAMES = 1;

/**
 * 上游分段的音频常比视频长几十毫秒（封装补白）：concat 会按容器时长偏移，
 * 接缝处就留下 1-2 帧没有画面的空洞（看起来「缺了一小段」），重编码路径还会让音画逐段错位。
 * 这里把「非末段」的音频裁到与视频等长：视频轨保持 -c copy，只重编音频。
 * @returns 对齐后的文件列表、需要清理的临时文件、被裁齐的分段信息。
 */
async function alignSegmentAudio(
  config,
  files,
  probed,
  outPath,
  { signal, binary }: RunOptions = {},
) {
  const temps = [];
  const trimmed = [];
  const aligned = [];
  for (const [index, file] of files.entries()) {
    const media = probed?.[index];
    const fps = Math.max(1, Math.round(media?.fps || 30));
    const videoSeconds = Number(media?.videoDurationSeconds) || 0;
    const audioSeconds = Number(media?.audioDurationSeconds) || 0;
    const padding = audioSeconds - videoSeconds;
    const isLast = index === files.length - 1;
    if (isLast || !media?.hasAudio || videoSeconds <= 0
      || padding <= AUDIO_PADDING_TOLERANCE_FRAMES / fps) {
      aligned.push(file);
      continue;
    }
    // 文件名带唯一尾巴：并发的两次合并（比如同时 resume 同一个目录）不会互相覆盖中间产物。
    const temp = `${outPath}.${uniqueSuffix(`align${index + 1}`)}.mp4`;
    const { code } = await runProcess(
      binary || resolveBinary(config, 'ffmpegBinary', 'ffmpeg'),
      [
        '-y', '-i', file, '-map', '0:v', '-map', '0:a',
        '-c:v', 'copy', '-c:a', 'aac',
        '-af', `atrim=0:${videoSeconds.toFixed(3)}`,
        '-movflags', '+faststart', temp,
      ],
      { signal },
    );
    if (code === 0 && await exists(temp)) {
      temps.push(temp);
      trimmed.push({ index: index + 1, paddingSeconds: Number(padding.toFixed(3)) });
      aligned.push(temp);
    } else {
      await rm(temp, { force: true });
      aligned.push(file);
    }
  }
  return { files: aligned, temps, trimmed };
}

/** 合并结束后清理音频对齐用的临时分段。 */
export async function cleanupSegmentTemps(temps) {
  for (const temp of temps || []) await rm(temp, { force: true });
}

export async function mergeClips(config, files: string[], outPath: string, { signal }: RunOptions = {}) {
  const binary = resolveBinary(config, 'ffmpegBinary', 'ffmpeg');
  await mkdir(path.dirname(outPath), { recursive: true });
  // 所有 ffmpeg 产物先写这个唯一的工作文件，成功后再原子 rename 到 outPath：
  // 并发合并同一个目标路径时，读者要么看到旧文件、要么看到完整的新文件，不会拿到半截 mp4。
  const work = `${outPath}.${uniqueSuffix('work')}.mp4`;
  let copyError = '';
  let audioError = '';

  const probed = [];
  for (const file of files) probed.push(await probeMedia(file, config, signal));
  const videos = probed.filter((media) => media && media.width && media.height);
  // 分辨率/尺寸不一致时无损拼接会得到坏文件，直接走重编码。
  const paramsMatch = videos.length !== probed.length
    || videos.every((media) => media.width === videos[0].width && media.height === videos[0].height);

  // 先裁齐音频，接缝才不会有空洞；后面的拼接统一用对齐后的分段。
  const { files: aligned, temps, trimmed } = await alignSegmentAudio(
    config, files, probed, work, { signal, binary },
  );
  files = aligned;
  try {

    // 旧seamless配置兼容为直接拼接，避免xfade叠加人物造成双影。
    const mergeMode = ref(config, 'mergeMode', 'copy');

    if (mergeMode !== 'reencode' && paramsMatch) {
      const listPath = `${work}.concat.txt`;
      const lines = files.map((file) => `file '${file.replace(/'/g, "'\\''")}'`).join('\n');
      await writeFile(listPath, `${lines}\n`, 'utf8');
      try {
        const { code, stderr } = await runProcess(binary, [
          '-y', '-f', 'concat', '-safe', '0', '-i', listPath,
          '-c', 'copy', '-movflags', '+faststart', work,
        ], { signal });
        if (code === 0 && await exists(work)) {
          await rename(work, outPath);
          return { path: outPath, mode: 'copy', trimmed };
        }
        copyError = stderr.trim().slice(-400);
      } finally {
        await rm(listPath, { force: true });
      }
    } else if (!paramsMatch) {
      copyError = '分段分辨率不一致，跳过无损拼接。';
    }

    const first = probed.find((media) => media && media.width && media.height) || {};
    const width = evenNumber(first.width, 1280);
    const height = evenNumber(first.height, 720);
    const fps = Math.min(60, Math.max(24, Math.round(first.fps || 30)));
    const withAudio = probed.length > 0 && probed.every((media) => media?.hasAudio);

    const videoParts = files.map((_, index) => (
      `[${index}:v]scale=${width}:${height}:force_original_aspect_ratio=decrease,`
      + `pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=${fps}[v${index}]`
    ));
    const videoInputs = files.map((_, index) => `[v${index}]`).join('');

    async function encode(filter, maps, withAudioTrack) {
      await rm(work, { force: true });
      const args = ['-y'];
      for (const file of files) args.push('-i', file);
      args.push('-filter_complex', filter, ...maps, '-c:v', 'libx264', '-preset', 'veryfast', '-pix_fmt', 'yuv420p');
      if (withAudioTrack) args.push('-c:a', 'aac', '-b:a', '192k');
      args.push('-movflags', '+faststart', work);
      return runProcess(binary, args, { signal });
    }

    if (withAudio) {
      // concat 的输入按 (视频, 音频) 成对排列：v0,a0,v1,a1…
      const audioParts = files.map((_, index) => (
        `[${index}:a]aresample=48000,`
        + 'aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo'
        + `[a${index}]`
      ));
      const pairedInputs = files.map((_, index) => `[v${index}][a${index}]`).join('');
      const filter = [
        ...videoParts,
        ...audioParts,
        `${pairedInputs}concat=n=${files.length}:v=1:a=1[v][a]`,
      ].join(';');
      const { code, stderr } = await encode(filter, ['-map', '[v]', '-map', '[a]'], true);
      if (code === 0 && await exists(work)) {
        await rename(work, outPath);
        return { path: outPath, mode: 'reencode', trimmed };
      }
      audioError = stderr.trim().slice(-400);
    }

    const filter = [...videoParts, `${videoInputs}concat=n=${files.length}:v=1:a=0[v]`].join(';');
    const { code, stderr } = await encode(filter, ['-map', '[v]'], false);
    if (code === 0 && await exists(work)) {
      await rename(work, outPath);
      return { path: outPath, mode: withAudio ? 'reencode-video-only' : 'reencode', trimmed };
    }
    const detail = [copyError, audioError, stderr.trim().slice(-400)].filter(Boolean).join(' | ');
    throw Object.assign(new Error(`ffmpeg 合并失败：${detail || '未知错误'}`), { code: 'ffmpeg_failed' });
  } finally {
    await cleanupSegmentTemps([...temps, work]);
  }
}

/** 接缝裁剪：2.0 默认裁前段尾6帧和后段头1帧；2.5 默认不裁。显式值覆盖默认策略，不覆盖原始分段。 */
export async function prepareSeamTrims(config, files, outPath, { signal }: RunOptions = {}) {
  const requested = ref(config, 'seamTrimSeconds', '');
  const trims = String(requested || '').trim()
    ? String(requested).split(',').map((value) => Number(value.trim())) : [];
  if (trims.some((value) => !Number.isFinite(value) || value < 0 || value > 3)) {
    throw new Error('seamTrimSeconds 必须为逗号分隔的 0–3 秒数值，例如 0.5,0；分别对应第 2、3 段开头。');
  }
  const prepared = [...files];
  const temps = [];
  const cuts = [];
  try {
    for (let index = 0; index < files.length; index++) {
      // 官方 2.0 接缝建议：前段尾部 6 帧、后段头部 1 帧。2.5 不套用该经验值。
      const official = !isOmniExtendModel(resolveModel(config)) && files.length > 1 && !trims.length;
      const secondsRequested = index > 0 ? trims[index - 1] || 0 : 0;
      if (!official && !secondsRequested) continue;
      const media = await probeMedia(files[index], config, signal);
      const duration = Number(media?.videoDurationSeconds || media?.durationSeconds);
      const fps = Number(media?.fps) || 24;
      const seconds = official ? (index > 0 ? 1 / fps : 0) : secondsRequested;
      const tailSeconds = official && index < files.length - 1 ? 6 / fps : 0;
      const keptSeconds = duration - seconds - tailSeconds;
      if (!(keptSeconds > 0.5)) throw new Error(`第 ${index + 1} 段裁剪后不足 0.5 秒，已停止合并。`);
      const temp = `${outPath}.${uniqueSuffix(`cut${index + 1}`)}.mp4`;
      temps.push(temp);
      // 输出端 seek 重编码，避免关键帧 seek 保留重复画面；音视频一起裁剪并从零计时。
      const result = await runProcess(resolveBinary(config, 'ffmpegBinary', 'ffmpeg'), [
        '-y', '-i', files[index], '-ss', String(seconds), '-t', String(keptSeconds),
        '-map', '0:v:0', '-map', '0:a:0?', '-c:v', 'libx264', '-preset', 'veryfast',
        '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-movflags', '+faststart', temp,
      ], { signal });
      if (result.code !== 0) throw new Error(`第 ${index + 1} 段接缝裁剪失败：${tail(result.stderr)}`);
      prepared[index] = temp;
      cuts.push({ index: index + 1, seconds, tailSeconds });
    }
    return { files: prepared, temps, cuts };
  } catch (error) {
    await cleanupSegmentTemps(temps);
    throw error;
  }
}

/** 分段下载/探测的并发上限：够快，又不至于一次对上游和磁盘同时开太多连接。 */
const SEGMENT_TASK_CONCURRENCY = 4;

/** 简易并发闸：最多同时跑 limit 个任务，按原下标返回结果；有任务抛错就整体抛出（其余任务停跑）。 */
async function mapLimit(items, limit, worker) {
  const results = new Array(items.length);
  let cursor = 0;
  let failure;
  const runner = async () => {
    while (cursor < items.length && !failure) {
      const index = cursor++;
      try {
        results[index] = await worker(items[index], index);
      } catch (error) {
        failure ??= error;
      }
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, runner));
  if (failure) throw failure;
  return results;
}

/**
 * 下载分段 + 合并成一条成片（metaontic_agent_forge_video_generate 与 metaontic_agent_forge_video_extend 共用）。
 * 只负责「把已经生成好的段落盘、再拼成一条」；暂停 / 保留分段 / 写暂停记录这些策略由调用方决定。
 * @param notes - 调用方的说明数组，函数会往里追加接缝、音频裁齐、缺 ffmpeg 之类的提示。
 * @param keepSingleFile - 只有一段时不要把它改名搬走（暂停时那段还要留着续做）。
 * @param signal - 下载/合并用的信号；中断收尾时可以传 undefined，让收尾不被中断打断。
 * @returns files / segmentsDir / deliveredSeconds，以及下面几种结果之一：
 *   error（下载或合并失败，说明已写进 notes）、ffmpegMissing + installHint（缺 ffmpeg 且不止一段）、
 *   merged + videoPath + mergeMode（成功）。
 */
export async function downloadSegmentsAndMerge(config, {
  segments, segmentsDir, outDir, stamp, notes = [], keepSingleFile = false, signal,
}) {
  const files = [];
  const deliveredSeconds = segments.reduce((sum, item) => sum + (item.seconds || 0), 0);
  // 多段才需要合成；本机没有 ffmpeg 就早点说清楚，别白跑一遍合并再报错。
  const ffmpegReady = segments.length > 1 ? await hasFfmpeg(config, signal) : true;
  let probeWarned = false;

  const destOf = (segment) => path.join(
    segmentsDir,
    `${String(segment.index).padStart(2, '0')}-${segment.kind}.mp4`,
  );

  // 各段文件互相独立，下载与探测都可以并发：串行时 4 段要等 4 轮「下载完成 + ffprobe 完成」，
  // 长视频的收尾时间几乎都花在这里。并发跑完后再按段号顺序处理结果，保证下面的判定语义不变。
  const downloaded = await mapLimit(segments, SEGMENT_TASK_CONCURRENCY, async (segment) => {
    const dest = destOf(segment);
    try {
      // 已经下过的分段（接着做时复用）直接用现成文件：上游链接可能已经过期。
      if (!(await exists(dest))) {
        await timedStage('segment_download', () => downloadFile(segment.videoUrl, dest, { signal }));
      }
      return { dest };
    } catch (failure) {
      if (failure?.code === 'ABORTED') throw failure;
      return { failure };
    }
  });
  // mapLimit 按原下标返回，取到的就是段号最靠前的失败，报错内容和串行时一致。
  const failed = downloaded.find((item) => item.failure);
  if (failed) {
    // 已经下好的分段照样记进结果（正文里能显示本地文件），只是这次交付没完成。
    for (const [index, item] of downloaded.entries()) {
      if (!item?.dest) continue;
      segments[index].localPath = item.dest;
      files.push(item.dest);
    }
    const reason = `分段已生成，但下载失败：${failed.failure?.message || failed.failure}`;
    notes.push(reason);
    return { files, segmentsDir, deliveredSeconds, error: reason };
  }
  const dests = downloaded.map((item) => item.dest);
  const probed = await mapLimit(dests, SEGMENT_TASK_CONCURRENCY,
    (dest) => timedStage('segment_probe', () => probeMedia(dest, config, signal)));

  for (const [index, segment] of segments.entries()) {
    const dest = dests[index];
    segment.localPath = dest;
    await appendRequestLog({ event: 'segment_saved', index: segment.index, taskId: segment.taskId, path: dest,
      bytes: (await stat(dest)).size });

    const media = probed[index];
    if (media?.durationSeconds) {
      segment.durationSeconds = Number(media.durationSeconds.toFixed(2));
      const cumulative = segments.slice(0, index + 1)
        .reduce((sum, item) => sum + (item.seconds || 0), 0);
      const tolerance = Math.max(
        CUMULATIVE_TOLERANCE_MIN_SECONDS,
        cumulative * CUMULATIVE_TOLERANCE_RATIO,
      );
      const looksCumulative = files.length > 0
        && Math.abs(media.durationSeconds - cumulative) <= tolerance
        && Math.abs(media.durationSeconds - segment.seconds) > tolerance;
      if (looksCumulative) {
        await appendRequestLog({ event: 'cumulative_output_detected', index: segment.index, duration: media.durationSeconds, plannedCumulative: cumulative });
        files.length = 0;
        notes.push(
          `第 ${segment.index} 段实测 ${formatSeconds(media.durationSeconds)} 秒，`
          + `接近累计时长 ${cumulative} 秒，按「上游返回的是累计成片」处理。`,
        );
      }
    } else if (!probeWarned) {
      probeWarned = true;
      notes.push('没有可用的 ffprobe，无法探测分段时长，按「每段都是增量片段」直接拼接。');
    }
    files.push(dest);
  }

  if (!files.length) return { files, segmentsDir, deliveredSeconds };

  if (!ffmpegReady && files.length > 1) {
    // 缺 ffmpeg 不是失败：分段照样交付，但必须把「怎么装」交出去。
    const guide = ffmpegInstallHint(config);
    notes.push(`分段文件都已下载到 ${segmentsDir}。`);
    notes.push(guide.hint);
    return {
      files, segmentsDir, deliveredSeconds, merged: false,
      ffmpegMissing: true, installHint: guide.hint,
    };
  }

  const finalPath = path.join(outDir, `${stamp}-${deliveredSeconds}s.mp4`);
  try {
    if (files.length === 1 && keepSingleFile) {
      return { files, segmentsDir, deliveredSeconds, merged: true, mergeMode: 'segment', videoPath: files[0] };
    }
    if (files.length === 1) {
      await mkdir(path.dirname(finalPath), { recursive: true });
      // 交付副本先写临时文件，失败保留已有成片；Windows占用时rename失败也不先删原件。
      const copy = `${finalPath}.${uniqueSuffix('copy')}.mp4`;
      try { await copyFile(files[0], copy); await rename(copy, finalPath); }
      finally { await rm(copy, { force: true }).catch(() => {}); }
      await appendRequestLog({ event: 'delivery_copied', sourcePath: files[0], videoPath: finalPath });
      return { files, segmentsDir, deliveredSeconds, merged: true, mergeMode: 'single', videoPath: finalPath };
    }
    await appendRequestLog({ event: 'merge_started', inputPaths: files, videoPath: finalPath });
    const prepared = await timedStage('seam_prepare', () => prepareSeamTrims(config, files, finalPath, { signal }));
    await appendRequestLog({ event: 'seam_trims_prepared', cuts: prepared.cuts });
    let merged;
    try {
      merged = await timedStage('video_merge', () => mergeClips(config, prepared.files, finalPath, { signal }));
    } finally {
      await cleanupSegmentTemps(prepared.temps);
    }
    if (prepared.cuts.length) {
      notes.push(`已按${String(ref(config, 'seamTrimSeconds', '')).trim() ? '手动设置' : '模型默认策略'}裁剪接缝：${prepared.cuts.map((cut) => `第 ${cut.index} 段：头部 ${cut.seconds.toFixed(3)} 秒、尾部 ${cut.tailSeconds.toFixed(3)} 秒`).join('；')}。原始分段未改动；实际成片会缩短，不补帧凑时长。`);
    }
    const actual = await probeMedia(finalPath, config, signal);
    await appendRequestLog({ event: 'merge_completed', videoPath: finalPath, mode: merged.mode,
      actualSeconds: actual?.durationSeconds, sourceCount: segments.length });
    if (merged.trimmed?.length) {
      notes.push(
        `第 ${merged.trimmed.map((item) => item.index).join('、')} 段的音频比视频长`
        + `（最长 ${Math.max(...merged.trimmed.map((item) => item.paddingSeconds))} 秒），`
        + '已裁齐后再拼接，避免接缝处缺一小段画面。',
      );
    }
    return { files, segmentsDir, deliveredSeconds, merged: true, mergeMode: merged.mode, videoPath: finalPath, seamCuts: prepared.cuts, actualSeconds: actual?.durationSeconds };
  } catch (failure) {
    if (failure?.code === 'ABORTED') throw failure;
    let reason = `分段已生成，但合并失败：${failure?.message || failure}`;
    let installHint;
    if (failure?.code === 'ffmpeg_missing') {
      const guide = ffmpegInstallHint(config);
      installHint = guide.hint;
      reason = guide.hint;
    }
    notes.push(reason);
    await appendRequestLog({ event: 'merge_failed', errorCode: String(failure?.code || 'merge_error'), segmentsDir });
    return { files, segmentsDir, deliveredSeconds, error: reason, ffmpegMissing: Boolean(installHint), installHint };
  }
}
