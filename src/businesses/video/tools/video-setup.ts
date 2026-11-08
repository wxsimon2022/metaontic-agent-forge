/** tools/video-setup：从宿主入口拆出的独立职责模块。 */
import { resolveBinary, ffmpegInstallOptions, probeBinaryVersion, runProcess, findInstalledFfmpeg } from '../media/ffmpeg.js';
import { tail } from '../utils/files.js';

/**
 * `video_setup` —— 检查本机跑不跑得动 ffmpeg，缺了就由插件来装。
 *
 * 存在的意义：长视频合并要 ffmpeg，而「在对话框里问一句要不要装」光靠模型没法落地
 * （模型不一定有终端工具、也不一定敢自己跑安装命令）。所以给一个工具：
 * 用户同意后由插件执行安装（install=true 会走审批卡口，让用户先看到完整命令），
 * 安装完成验证工具；已有任务按原resume恢复，新任务仍须生成费用确认。
 */
export function setupTool(config) {
  return {
    name: 'video_setup',
    description:
      '检查本机有没有 ffmpeg（生成超过模型单次上限的视频时，合并成一条要用它），缺了就装。'
      + 'install=true 表示「用户已经同意安装」，插件会执行安装命令并验证——'
      + '命令会先拿给用户确认，用户点了允许才执行。'
      + '装不上（例如本机连包管理器都没有）会返回手动安装步骤和一个 nextStep。'
      + '用户说「帮我装 ffmpeg」「检查一下环境」时用它；只有确实要装才传 install=true。',
    parameters: {
      type: 'object',
      properties: {
        install: {
          type: 'boolean',
          description: '是否执行安装，默认 false（只检查、只汇报，不动本机）。',
        },
        target: {
          type: 'string',
          enum: ['ffmpeg', 'package-manager'],
          description: 'install=true 时装什么：ffmpeg（默认）或先装包管理器（macOS 的 Homebrew）。',
        },
      },
    },
    output: {
      schema: {
        type: 'object',
        properties: {
          status: { type: 'string' },
          os: { type: 'string' },
          ffmpegVersion: { type: 'string' },
          ffmpegPath: { type: 'string' },
          ffprobeVersion: { type: 'string' },
          installCommand: { type: 'string' },
          manualSteps: { type: 'array', items: { type: 'string' } },
          output: { type: 'string' },
          note: { type: 'string' },
        },
      },
      render(_args, value) {
        const {
          status, os, ffmpegVersion, ffmpegPath, ffprobeVersion, installCommand, output, note,
        } = value || {};
        const lines = [];
        if (status === 'ready') {
          lines.push('本机环境没问题：ffmpeg 已经能用了，长视频可以直接合并成一条。');
        } else if (status === 'installed') {
          lines.push('ffmpeg 装好了，长视频现在可以合并成一条。');
        } else if (status === 'missing') {
          lines.push('本机还没有 ffmpeg：生成超过模型单次上限的视频时只能给分段，没法合并成一条。');
          lines.push(`装一下就好（${os || '当前系统'}）：${installCommand || ''}`);
          lines.push('用户同意的话，我可以用 video_setup（install=true）直接帮他装。');
        } else if (status === 'failed') {
          lines.push('ffmpeg 没装成功，得手动装一下。');
          lines.push(`手动步骤：${note || installCommand || ''}`);
        } else {
          lines.push(`环境检查结果：${status || '未知'}。`);
        }
        if (ffmpegVersion) lines.push(`ffmpeg：${ffmpegVersion}`);
        if (ffmpegPath) lines.push(`ffmpeg 路径：${ffmpegPath}（可以填进插件设置里的「ffmpeg 路径」）`);
        if (ffprobeVersion) lines.push(`ffprobe：${ffprobeVersion}`);
        if (status !== 'ready' && status !== 'installed' && installCommand && status === 'failed') {
          lines.push(`命令：${installCommand}`);
        }
        if (output) lines.push(`安装输出（末尾）：${output}`);
        if (note) lines.push(note);
        return [{ type: 'text', text: lines.filter(Boolean).join('\n') }];
      },
    },
    // 装 ffmpeg 可能要下载几十 MB，给足时间；装完还要再验证一次。
    timeoutMs: 20 * 60 * 1000,
    isConcurrencySafe() {
      return false;
    },
    async execute(args, exec) {
      const signal = exec?.signal;
      const binary = resolveBinary(config, 'ffmpegBinary', 'ffmpeg');
      const probeBinary = resolveBinary(config, 'ffprobeBinary', 'ffprobe');
      const { os, installs, bootstrap } = ffmpegInstallOptions();
      const wantsInstall = args?.install === true;
      const target = String(args?.target || 'ffmpeg');
      const manualSteps = installs.map((item) => `${item.label}：${item.command}`);
      const installCommand = target === 'package-manager' && bootstrap
        ? bootstrap.command
        : installs[0].command;

      const ffmpegVersion = await probeBinaryVersion(binary, signal);
      const ffprobeVersion = await probeBinaryVersion(probeBinary, signal);
      const base = { os, installCommand, manualSteps, ffmpegVersion, ffprobeVersion };

      // 已经能用了：只汇报，顺便提醒 ffprobe 的情况（分段时长探测用它）
      if (ffmpegVersion) {
        const note = ffprobeVersion
          ? 'ffmpeg 与 ffprobe 都可用，长视频会正常合并成一条。'
          : 'ffmpeg 可用；没有 ffprobe，分段时长探测会被跳过（不影响合并）。';
        return { status: 'ready', ...base, ffmpegPath: binary, note };
      }

      // 只检查：把安装方式交出去，等用户点头
      if (!wantsInstall) {
        return {
          status: 'missing',
          ...base,
          note: `本机 ${binary} 跑不起来。用户同意后可以 install=true 让我来装；`
            + '也有可能是路径不对：已经装过就把绝对路径填进插件设置里的「ffmpeg 路径」。',
        };
      }

      // 用户已经同意：真的执行安装命令，跑完再验证一次
      let output = '';
      try {
        const shellCommand = target === 'package-manager' && bootstrap
          ? bootstrap.command
          : (target === 'package-manager' && !bootstrap
            ? null
            : installs[0].command);
        if (!shellCommand) {
          return {
            status: 'failed',
            ...base,
            note: `${os} 不需要另外装包管理器，直接用系统自带的包管理器装 ffmpeg 就行。`,
          };
        }
        const result = await runProcess(shellCommand, [], {
          signal,
          shell: true,
          timeoutMs: 18 * 60 * 1000,
        });
        output = tail(String(result.stdout || '') + String(result.stderr || ''), 800);
      } catch (error) {
        output = tail(error?.message || String(error), 800);
      }

      const afterVersion = await probeBinaryVersion(binary, signal);
      if (afterVersion) {
        return {
          status: 'installed',
          ...base,
          ffmpegVersion: afterVersion,
          ffmpegPath: binary,
          output,
          note: '已验证ffmpeg可用。已有任务用原resume重试下载或合并；尚未提交的新任务仍需单独确认生成费用。',
        };
      }

      // PATH 还没刷新时，ffmpeg 往往已经落在常见位置里，找出来让用户填配置
      const found = await findInstalledFfmpeg(signal);
      if (found) {
        return {
          status: 'installed',
          ...base,
          ffmpegVersion: await probeBinaryVersion(found, signal),
          ffmpegPath: found,
          output,
          note: `装好了，但没进 PATH：把 ${found} 填进插件设置里的「ffmpeg 路径」`
            + '，保存后用原resume恢复已有任务。',
        };
      }

      const needsBootstrap = Boolean(bootstrap) && !ffmpegVersion
        && /command not found|not found|不是内部或外部命令|未找到/i.test(output);
      return {
        status: 'failed',
        ...base,
        installCommand: needsBootstrap ? bootstrap.command : installs[0].command,
        manualSteps: needsBootstrap
          ? [`先装包管理器：${bootstrap.command}`, ...manualSteps]
          : manualSteps,
        output,
        note: needsBootstrap
          ? `本机没有 ${os} 的包管理器，得先装它：${bootstrap.command}；装好之后再装 ffmpeg。`
            + '这两步都可以让我来做 —— 说一声就行。'
          : '安装命令没成功（可能是没权限、没联网或被安全策略拦下）。'
            + '上面是手动步骤，照着在终端里跑一遍即可。',
      };
    },
  };
}
