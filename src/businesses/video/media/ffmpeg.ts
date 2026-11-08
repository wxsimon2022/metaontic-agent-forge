/** media/ffmpeg：从宿主入口拆出的独立职责模块。 */
import { ref } from '../config.js';
import { type RunOptions } from '../providers/types.js';
import { spawn } from 'node:child_process';
import { abortError } from '../utils/errors.js';

/* ---------------- 分段下载与 ffmpeg 合并 ---------------- */

export function resolveBinary(config, key, fallback) {
  return String(ref(config, key, '')).trim() || fallback;
}

/** 跑一个子进程并收全输出；找不到可执行文件时归一化成 ffmpeg_missing。 */
export async function runProcess(
  binary: string,
  args: string[],
  { signal, timeoutMs = 1800000, shell = false }: RunOptions = {},
): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    let child;
    try {
      child = spawn(binary, args, { stdio: ['ignore', 'pipe', 'pipe'], ...(shell ? { shell: true } : {}) });
    } catch (error) {
      reject(Object.assign(new Error(`${binary} 无法启动：${error?.message || error}`), {
        code: 'ffmpeg_missing',
      }));
      return;
    }

    let stdout = '';
    let stderr = '';
    let done = false;

    function cleanup() {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
    }
    function settle(error: Error | null = null, value: any = undefined) {
      if (done) return;
      done = true;
      cleanup();
      if (error) reject(error);
      else resolve(value);
    }
    function onAbort() {
      child.kill('SIGKILL');
      settle(abortError());
    }

    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      settle(Object.assign(new Error(`${binary} 执行超时。`), { code: 'ffmpeg_timeout' }));
    }, timeoutMs);

    if (signal?.aborted) {
      onAbort();
      return;
    }
    signal?.addEventListener('abort', onAbort, { once: true });
    child.on('error', (error) => settle(Object.assign(
      new Error(`${binary} 无法启动：${error.message}`),
      { code: error.code === 'ENOENT' ? 'ffmpeg_missing' : 'ffmpeg_failed' },
    )));
    child.stdout?.on('data', (chunk) => { stdout += chunk; });
    child.stderr?.on('data', (chunk) => { stderr += chunk; });
    child.on('close', (code) => settle(null, { code, stdout, stderr }));
  });
}

/**
 * 本机能不能调用 ffmpeg：不能就不要去合成，直接返回分段列表。
 * 只做一次轻量 `-version`，不缓存结果——用户装好 ffmpeg 后重跑应立即生效。
 */
export async function hasFfmpeg(config, signal) {
  const binary = resolveBinary(config, 'ffmpegBinary', 'ffmpeg');
  try {
    const { code } = await runProcess(binary, ['-version'], { signal, timeoutMs: 20000 });
    return code === 0;
  } catch {
    return false;
  }
}

/** 本机操作系统名，只用来挑安装命令；取不到就按 Linux 处理。 */
function currentPlatform(): string {
  try {
    return (typeof process !== 'undefined' && process.platform) || 'linux';
  } catch {
    return 'linux';
  }
}

/** macOS 上连 Homebrew 都没有时的第一步。 */
const HOMEBREW_BOOTSTRAP = '/bin/bash -c "$(curl -fsSL '
  + 'https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"';

/**
 * 按操作系统给出 ffmpeg 的安装方式。
 * 只给「装一次就完事」的官方渠道：macOS 走 Homebrew，Windows 走 winget（备选 choco），
 * Linux 同时给 Debian 系与 Fedora 系——用户照着抄一行就行。
 */
export function ffmpegInstallOptions(platform = currentPlatform()) {
  if (platform === 'darwin') {
    return {
      os: 'macOS',
      installs: [
        { label: 'macOS（Homebrew）', command: 'brew install ffmpeg' },
        {
          label: 'macOS（还没装 Homebrew 就先装它）',
          command: HOMEBREW_BOOTSTRAP,
        },
      ],
      // 连包管理器都没有时的前置步骤（macOS 才有）
      bootstrap: { label: 'macOS（先装 Homebrew）', command: HOMEBREW_BOOTSTRAP },
    };
  }
  if (platform === 'win32') {
    return {
      os: 'Windows',
      installs: [
        { label: 'Windows（winget）', command: 'winget install --id Gyan.FFmpeg -e' },
        { label: 'Windows（Chocolatey）', command: 'choco install ffmpeg' },
      ],
      bootstrap: null,
    };
  }
  return {
    os: 'Linux',
    installs: [
      {
        label: 'Linux（Debian / Ubuntu）',
        command: 'sudo apt update && sudo apt install -y ffmpeg',
      },
      { label: 'Linux（Fedora / RHEL / CentOS）', command: 'sudo dnf install -y ffmpeg' },
    ],
    bootstrap: null,
  };
}

/** ffmpeg 装完常常不立刻进 PATH；这几个常见位置也找一遍，好让用户直接填进 ffmpegBinary。 */
function commonFfmpegPaths(platform = currentPlatform()) {
  if (platform === 'darwin') return ['/opt/homebrew/bin/ffmpeg', '/usr/local/bin/ffmpeg'];
  if (platform === 'win32') return [];
  return ['/usr/bin/ffmpeg', '/usr/local/bin/ffmpeg', '/snap/bin/ffmpeg'];
}

/** 探一次可执行文件版本，返回首行（拿不到返回 null）。 */
export async function probeBinaryVersion(binary, signal) {
  try {
    const { code, stdout, stderr } = await runProcess(binary, ['-version'], { signal, timeoutMs: 20000 });
    if (code !== 0) return null;
    const line = String(stdout || stderr).split('\n').map((item) => item.trim()).filter(Boolean)[0];
    return line || 'ok';
  } catch {
    return null;
  }
}

/** 装完之后在常见位置里找一次 ffmpeg：找到就把绝对路径交出去。 */
export async function findInstalledFfmpeg(signal) {
  for (const candidate of commonFfmpegPaths()) {
    if (await probeBinaryVersion(candidate, signal)) return candidate;
  }
  return null;
}

/**
 * ffmpeg 缺失时给用户看的引导：为什么需要它、现在该怎么装、装完怎么让合并生效。
 * 结果里的 installHint 会原样带进工具返回值，让模型照着念给用户听，
 * 不是只说一句「已跳过合并」——这一步的目的就是把人引到安装上。
 */
export function ffmpegInstallHint(config) {
  const binary = resolveBinary(config, 'ffmpegBinary', 'ffmpeg');
  const { os, installs } = ffmpegInstallOptions();
  const lines = [
    `本机没有找到可用的 ffmpeg（${binary}），所以「把多段合并成一条」这步暂时没做，`
      + '已生成结果以返回的分段列表为准；本地文件是否齐全请核对各段路径。',
    `装一下 ffmpeg 就能合并（你当前是 ${os}）：`,
    ...installs.map((item) => `  · ${item.label}：${item.command}`),
    '装好后使用原resume恢复已有任务的下载或合并，不重新提交生成任务；'
      + '如果 ffmpeg 已经装了但不在默认位置，把它的绝对路径填到插件设置里的「ffmpeg 路径」也一样管用。',
    'ffmpeg 的安装包里自带 ffprobe，装完分段探测也一起好了。',
    '想让我来装就说一声 —— 我会用 metaontic_agent_forge_video_setup 执行安装（执行前宿主会先让你确认命令）。',
  ];
  return { binary, os, installs, hint: lines.join('\n') };
}

/** 探测分段的时长/尺寸；ffprobe 缺失或失败都返回 null，不影响主流程。 */
export async function probeMedia(file, config, signal) {
  try {
    const { code, stdout } = await runProcess(resolveBinary(config, 'ffprobeBinary', 'ffprobe'), [
      '-v', 'error',
      '-show_entries', 'format=duration:stream=codec_type,width,height,r_frame_rate,duration',
      '-of', 'json',
      file,
    ], { signal, timeoutMs: 60000 });
    if (code !== 0) return null;
    const parsed = JSON.parse(stdout);
    const streams = Array.isArray(parsed?.streams) ? parsed.streams : [];
    const video = streams.find((stream) => stream.codec_type === 'video') || {};
    const audio = streams.find((stream) => stream.codec_type === 'audio') || {};
    const [num, den] = String(video.r_frame_rate || '').split('/').map(Number);
    const duration = Number(parsed?.format?.duration);
    const videoDuration = Number(video.duration);
    const audioDuration = Number(audio.duration);
    return {
      durationSeconds: Number.isFinite(duration) && duration > 0 ? duration : 0,
      videoDurationSeconds: Number.isFinite(videoDuration) && videoDuration > 0 ? videoDuration : 0,
      audioDurationSeconds: Number.isFinite(audioDuration) && audioDuration > 0 ? audioDuration : 0,
      width: Number(video.width) || 0,
      height: Number(video.height) || 0,
      fps: Number.isFinite(num) && Number.isFinite(den) && den > 0 ? num / den : 0,
      hasAudio: streams.some((stream) => stream.codec_type === 'audio'),
    };
  } catch {
    return null;
  }
}
