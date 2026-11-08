import { dshHome } from '../../../core/paths.js';
export { dshHome } from '../../../core/paths.js';
/** media/references：从宿主入口拆出的独立职责模块。 */
import path from 'node:path';
import os from 'node:os';
import { stat, mkdir, rename, rm, open, readdir, readFile } from 'node:fs/promises';
import { probeMedia, runProcess, resolveBinary } from './ffmpeg.js';
import { uniqueSuffix } from '../utils/files.js';
import { isOmniExtendModel } from '../providers/connection.js';

/** 允许上传的图片类型：扩展名 → MIME。 */
const IMAGE_EXT_TO_MIME = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.bmp': 'image/bmp',
  '.gif': 'image/gif',
  '.tif': 'image/tiff',
  '.tiff': 'image/tiff',
};

/** 单张图片上限：内联成 base64 后请求体会涨约 1/3，压在这个大小比较稳。 */
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

/** 用文件头认图片，避免把改了扩展名的非图片文件读进去发走。 */
function sniffImageMime(buffer: Buffer): string | null {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg';
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buffer.length >= 6 && (buffer.subarray(0, 6).toString('latin1') === 'GIF87a' || buffer.subarray(0, 6).toString('latin1') === 'GIF89a')) return 'image/gif';
  if (buffer.length >= 2 && buffer[0] === 0x42 && buffer[1] === 0x4d) return 'image/bmp';
  if (buffer.length >= 12 && buffer.subarray(0, 4).toString('latin1') === 'RIFF' && buffer.subarray(8, 12).toString('latin1') === 'WEBP') return 'image/webp';
  if (buffer.length >= 4 && ((buffer[0] === 0x49 && buffer[1] === 0x49 && buffer[2] === 0x2a) || (buffer[0] === 0x4d && buffer[1] === 0x4d && buffer[2] === 0x00))) return 'image/tiff';
  return null;
}

/**
 * 目标画幅的像素尺寸：ratio + 720P 算出来，参考图适配画幅时用。
 * adaptive 表示「让模型按参考图自己决定画幅」，没有固定目标，不参与适配。
 */
const CANVAS_SIZES: Record<string, [number, number]> = {
  '16:9': [1280, 720],
  '9:16': [720, 1280],
  '4:3': [960, 720],
  '3:4': [720, 960],
  '1:1': [720, 720],
};

export function canvasSize(ratio) {
  return CANVAS_SIZES[String(ratio ?? '').trim()] || null;
}

/** 适配后的参考图放这里：同一张图反复提交时不必每次重跑 ffmpeg。 */
function referenceCacheDir() {
  return path.join(os.tmpdir(), 'metaontic-video-reference');
}

/**
 * 把本机参考图先适配到目标画幅再提交。
 *
 * i2v 会按参考图的比例出片：竖版定妆照配 16:9 的请求，拿回来的还是竖版。
 * 这里沿用 videoflow-ai 的做法——原图等比缩到目标画幅做模糊底、居中叠上原图，
 * 既不裁掉主体也不留黑边；尺寸本来就对得上就直接用原图。
 * 只有本机文件能这么处理（公网 URL 交给上游自己取），ffmpeg 缺失或适配失败
 * 都退回原图，不阻塞生成。
 */
/**
 * 缓存文件是不是「完整的、画幅也对」。
 * 以前只判断 `exists`：并发调用里另一个正在写同一个文件时，会命中写到一半的 jpg
 * （base64 发上去就是坏图）。这里要求文件存在且非空；探得出尺寸时再核对画幅。
 * 没有可用的 ffprobe 时只能按「存在且非空」放行，否则缓存永远命不中。
 */
async function isUsableFit(dest, width, height, config, signal) {
  const info = await stat(dest).catch(() => null);
  if (!info?.isFile() || info.size <= 0) return false;
  const media = await probeMedia(dest, config, signal);
  if (!media?.width || !media?.height) return true;
  return media.width === width && media.height === height;
}

/**
 * 参考图适配缓存只增不减：同一张图改一次就多一份 jpg，长期使用会把临时目录堆满。
 * 写入新缓存时顺手清理：超期的删掉，数量超上限时从最旧的开始删。
 * 正在被并发适配写入的临时文件（`.fit-…jpg`，5 分钟内）不动，避免删掉别人正在写的文件。
 */
const REFERENCE_CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const REFERENCE_CACHE_MAX_FILES = 200;
const REFERENCE_CACHE_FRESH_MS = 5 * 60 * 1000;
let lastCachePruneAt = 0;

async function pruneReferenceCache(dir, { now = Date.now(), force = false } = {}) {
  // 每台机器一天适配不了几次，一小时扫一次足够，别让清理变成新的热路径开销。
  if (!force && now - lastCachePruneAt < 60 * 60 * 1000) return;
  lastCachePruneAt = now;
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
  const files = [];
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const file = path.join(dir, entry.name);
    const info = await stat(file).catch(() => null);
    if (!info) continue;
    const inFlight = entry.name.includes('.fit-') && now - info.mtimeMs < REFERENCE_CACHE_FRESH_MS;
    if (inFlight) continue;
    files.push({ file, mtimeMs: info.mtimeMs, stale: now - info.mtimeMs > REFERENCE_CACHE_MAX_AGE_MS });
  }
  for (const item of files) if (item.stale) await rm(item.file, { force: true }).catch(() => {});
  const rest = files.filter((item) => !item.stale);
  if (rest.length <= REFERENCE_CACHE_MAX_FILES) return;
  rest.sort((a, b) => a.mtimeMs - b.mtimeMs);
  for (const item of rest.slice(0, rest.length - REFERENCE_CACHE_MAX_FILES)) {
    if (now - item.mtimeMs <= REFERENCE_CACHE_FRESH_MS) continue;
    await rm(item.file, { force: true }).catch(() => {});
  }
}

/** 同一张图的适配任务：并发调用共用同一个 Promise，避免同时开 N 个 ffmpeg 写同一个文件。 */
const fitInFlight = new Map();

async function fitImageToCanvas(absPath, size, config, signal) {
  const [width, height] = size;
  const media = await probeMedia(absPath, config, signal);
  if (media?.width === width && media?.height === height) return absPath;
  const info = await stat(absPath).catch(() => null);
  const key = `${path.basename(absPath, path.extname(absPath))}-${info?.size ?? 0}`
    + `-${Math.round(info?.mtimeMs ?? 0)}-${width}x${height}.jpg`;
  const dest = path.join(referenceCacheDir(), key);
  if (await isUsableFit(dest, width, height, config, signal)) return dest;

  // 已经有一次适配在跑（并发调用同一张图）：等它，而不是再跑一遍 ffmpeg 写同一个文件。
  const running = fitInFlight.get(dest);
  if (running) {
    await running.catch(() => {});
    if (await isUsableFit(dest, width, height, config, signal)) return dest;
    // 那一次没成（比如它的调用被中断了）：自己再试一次；这次也被取消就直接用原图。
    if (signal?.aborted) return absPath;
  }

  const task = (async () => {
    await mkdir(referenceCacheDir(), { recursive: true });
    const graph = `[0:v]scale=${width}:${height}:force_original_aspect_ratio=increase,`
      + `crop=${width}:${height},gblur=sigma=24[bg];`
      + `[0:v]scale=${width}:${height}:force_original_aspect_ratio=decrease[fg];`
      + `[bg][fg]overlay=(W-w)/2:(H-h)/2,setsar=1`;
    // 先写唯一的临时文件、验过画幅再 rename 顶上：并发读者永远看不到写了一半的 jpg。
    // 尾巴要留在扩展名前面——ffmpeg 按扩展名挑封装器，`.jpg.fit-…` 这种名字它会直接报错。
    const temp = `${dest.replace(/\.jpg$/, '')}.${uniqueSuffix('fit')}.jpg`;
    try {
      const { code } = await runProcess(resolveBinary(config, 'ffmpegBinary', 'ffmpeg'), [
        '-y', '-i', absPath, '-filter_complex', graph, '-frames:v', '1', '-q:v', '2', temp,
      ], { signal, timeoutMs: 120000 });
      if (code !== 0) return;
      const fitted = await probeMedia(temp, config, signal);
      if (fitted?.width === width && fitted?.height === height) {
        await rename(temp, dest);
        await pruneReferenceCache(referenceCacheDir());
      }
    } catch {
      // 没装 ffmpeg、或这张图 ffmpeg 处理不了：按原图提交
    } finally {
      await rm(temp, { force: true }).catch(() => {});
    }
  })();
  fitInFlight.set(dest, task);
  try {
    await task;
  } finally {
    fitInFlight.delete(dest);
  }
  return (await isUsableFit(dest, width, height, config, signal)) ? dest : absPath;
}

/** 用户说「我刚上传的那张图」时的简写：latest / latest:2（第 2 新的）等。 */
const UPLOAD_ALIAS_PATTERN = /^(?:latest|newest|recent|最近上传(?:的图片)?|最新上传(?:的图片)?|刚上传(?:的图片)?|最新图片|刚拖进来的图片)$/i;

/** 「最近上传」只看这个时间窗内的附件：窗口太长容易挑到无关的旧图。 */
const UPLOAD_WINDOW_MS = 2 * 60 * 60 * 1000;

/** DSH 主目录（`DSH_HOME`，默认 `~/.dsh`）。 */


/** Harness 的对话附件库：内容寻址存的是原始图片字节（无扩展名）。 */
function attachmentObjectsDir() {
  return path.join(dshHome(), 'attachments', 'v1', 'objects');
}

/** 只读文件头认图片，附件库里的对象没有扩展名，只能靠文件头。 */
async function sniffFileImage(file) {
  let handle;
  try {
    handle = await open(file, 'r');
    const head = Buffer.alloc(32);
    const { bytesRead } = await handle.read(head, 0, head.length, 0);
    return sniffImageMime(head.subarray(0, bytesRead));
  } catch {
    return null;
  } finally {
    await handle?.close().catch(() => {});
  }
}

/**
 * 找出用户在对话里最近上传的图片，按上传时间从新到旧排。
 *
 * 用户把图片拖进对话框时，Harness 会先把原始字节收进附件库
 * （`$DSH_HOME/attachments/v1/objects/<xx>/<sha256>`）——**即使当前模型不支持图片、
 * 消息被 `MODEL_DOES_NOT_SUPPORT_IMAGES` 拦下来，文件也已经落盘了**。
 * 所以插件可以直接按时间从这里面取图，用户不必再自己找路径：模型看不看得见图都不影响出片。
 */
async function findRecentUploadedImages(windowMs = UPLOAD_WINDOW_MS) {
  const root = attachmentObjectsDir();
  const shards = await readdir(root, { withFileTypes: true }).catch(() => []);
  const cutoff = Date.now() - windowMs;
  const found = [];
  for (const shard of shards) {
    if (!shard.isDirectory()) continue;
    const dir = path.join(root, shard.name);
    const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      const abs = path.join(dir, entry.name);
      const info = await stat(abs).catch(() => null);
      if (!info || info.mtimeMs < cutoff) continue;
      const mime = await sniffFileImage(abs);
      if (mime) found.push({ abs, mime, bytes: info.size, mtimeMs: info.mtimeMs });
    }
  }
  return found.sort((a, b) => b.mtimeMs - a.mtimeMs);
}

/**
 * 报错里回显用户输入时截断：base64 动辄几十万字符，原样带进错误信息会把结果撑爆。
 */
function brief(value, limit = 80) {
  const text = String(value ?? '');
  return text.length > limit ? `${text.slice(0, limit)}…（共 ${text.length} 字符）` : text;
}

/**
 * 纯 base64（不带 `data:` 前缀）也认：
 * - 解开能认出图片头 → 补 `data:` 前缀内联；
 * - 明显是一大坨 base64 但解出来不是图片 → 直接报错，别退回「当路径」让人一头雾水；
 * - 短的、或不像 base64 的 → 返回 null，交给路径那条分支。
 */
function inlineBase64Image(raw, label) {
  const compact = String(raw ?? '').replace(/\s+/g, '');
  if (compact.length < 64 || !/^[A-Za-z0-9+/]+={0,2}$/.test(compact)) return null;
  const buffer = Buffer.from(compact, 'base64');
  if (buffer.length > MAX_IMAGE_BYTES) {
    throw new Error(
      `${label} 解出来有 ${(buffer.length / 1048576).toFixed(1)} MB，`
      + `请压到 ${MAX_IMAGE_BYTES / 1048576} MB 以内再传。`,
    );
  }
  const mime = sniffImageMime(buffer);
  if (mime) return { url: `data:${mime};base64,${compact}`, source: 'inline', bytes: buffer.length };
  // 长到不可能是文件名的长度，还解不出图片头：按「base64 传错了」报，不退回路径
  if (compact.length >= 256) {
    throw new Error(
      `${label} 看着是 base64，但解出来的内容不是图片（只认 jpg/png/webp/bmp/gif/tiff 的文件头）。`,
    );
  }
  return null;
}

/**
 * 把用户给的图片统一成请求里能用的 `image_url.url`，四种入参都收：
 * - `https://` / `http://`：照原样用（上游自己取图，最省事）；
 * - `data:image/...;base64,...`：原样内联；
 * - 纯 base64：认出图片头就补上 `data:` 前缀内联（`Buffer` 能解、文件头是图片才算）；
 * - 本机路径（含对话里 @ 引用的上传文件、`~` 开头的路径）：读进来内联成
 *   `data:<mime>;base64,...`——上游取不到本机地址，这是这条线路上唯一可行的形态
 *   （videoflow-ai 的 `image_ref_to_payload` 也这么干，中转站的图片接口同样把上传文件
 *   在网关侧转成同名 data URI）。
 * 本机图片在确定画幅（ratio 不是 adaptive）时会先适配画幅再内联；URL / base64 已经是字节流，原样交给上游。
 */
export async function resolveImageInput(value, label, fit = null) {
  const raw = String(value ?? '').trim().replace(/^@/, '');
  if (!raw) throw new Error(`${label} 不能为空。`);
  if (/^https?:\/\//i.test(raw)) return { url: raw, source: 'url' };
  if (/^data:image\//i.test(raw)) return { url: raw, source: 'inline' };
  const inlined = inlineBase64Image(raw, label);
  if (inlined) return inlined;

  let abs;
  let info;
  let upload = null;
  // 「我刚上传的那张图」：latest / latest:2（第 2 新的）/ 最近上传 等简写
  const aliasParts = /^([^\s:]+)(?::(\d+))?$/.exec(raw);
  const aliasName = aliasParts ? aliasParts[1] : '';
  const uploadIndex = aliasParts && aliasParts[2] ? Math.max(1, Number(aliasParts[2])) : 1;
  if (UPLOAD_ALIAS_PATTERN.test(aliasName)) {
    const index = uploadIndex;
    const uploads = await findRecentUploadedImages();
    const picked = uploads[index - 1];
    if (!picked) {
      throw new Error(
        `${label} 写的是「最近上传的图片」${index > 1 ? `（第 ${index} 新）` : ''}，但 Harness 附件库里`
        + `最近 ${UPLOAD_WINDOW_MS / 3600000} 小时只有 ${uploads.length} 张图片，取不到。`
        + '请直接把图片路径或公网 URL 发过来。',
      );
    }
    abs = picked.abs;
    info = { size: picked.bytes };
    upload = {
      uploadedAt: new Date(picked.mtimeMs).toISOString(),
      recentUploads: uploads.length,
      uploadIndex: index,
    };
  } else {
    abs = path.resolve(raw.startsWith('~/') || raw === '~' ? path.join(os.homedir(), raw.slice(1)) : raw);
    const ext = path.extname(abs).toLowerCase();
    if (!IMAGE_EXT_TO_MIME[ext]) {
      throw new Error(
        `${label} 既不是 http(s) 链接、base64，也不是支持的图片文件：${brief(raw)}。`
        + `本机图片请用 ${Object.keys(IMAGE_EXT_TO_MIME).join(' / ')} 之一，`
        + '用户刚在对话里上传的图直接写 latest。',
      );
    }
    info = await stat(abs).catch(() => null);
    if (!info?.isFile()) {
      throw new Error(`${label} 找不到文件：${abs}（用户刚在对话里上传的图可以直接写 latest）`);
    }
  }

  // 先适配画幅，再按「真正要发出去的那张图」做大小与格式校验
  const submitPath = fit?.size
    ? await fitImageToCanvas(abs, fit.size, fit.config, fit.signal)
    : abs;
  let size = info.size;
  if (submitPath !== abs) {
    const fittedInfo = await stat(submitPath).catch(() => null);
    if (!fittedInfo?.isFile()) throw new Error(`${label} 读不出来：${abs}`);
    size = fittedInfo.size;
  }
  if (size > MAX_IMAGE_BYTES) {
    throw new Error(
      `${label} 太大（${(size / 1048576).toFixed(1)} MB），请压到 `
      + `${MAX_IMAGE_BYTES / 1048576} MB 以内再传：${abs}`,
    );
  }
  const buffer = await readFile(submitPath);
  const mime = sniffImageMime(buffer);
  if (!mime) throw new Error(`${label} 不是有效的图片文件（读到的内容不是 jpg/png/webp/bmp/gif/tiff）：${abs}`);
  const resolved: Record<string, unknown> = {
    url: `data:${mime};base64,${buffer.toString('base64')}`,
    source: upload ? 'upload' : 'file',
    localPath: submitPath,
    bytes: buffer.length,
    ...(upload || {}),
  };
  if (submitPath !== abs) {
    resolved.originalPath = abs;
    resolved.fittedTo = `${fit.size[0]}x${fit.size[1]}`;
  }
  return resolved;
}

/**
 * 直出请求体：文本 + 可选参考图（首帧 / 尾帧 / 人物形象参考），沿用 contents-generation 的原生格式。
 *
 * 三种接入方式都按模型限制提交全部参考图，保持输入顺序与角色标记。
 */
/** 官方图片任务互斥校验在读取或转换素材之前执行。 */
export function validateImageRoles(args, model) {
  const refs = Array.isArray(args.referenceImages) ? args.referenceImages
    : (args.referenceImages ? [args.referenceImages] : []);
  if (args.lastFrameUrl && !args.firstFrameUrl) throw new Error('尾帧必须与首帧一起传入。');
  if (refs.length && (args.firstFrameUrl || args.lastFrameUrl)) {
    throw new Error('首尾帧与参考图模式互斥，请选择一种；如需组合，用参考图模式并在提示词指定首尾画面。');
  }
  const limit = isOmniExtendModel(model) ? 30 : 9;
  if (refs.length > limit) throw new Error(`当前模型最多支持 ${limit} 张参考图。`);
  if (refs.some((value) => typeof value !== 'string' || !value.trim())) throw new Error('每张参考图必须是非空字符串。');
  return { refs, limit };
}
