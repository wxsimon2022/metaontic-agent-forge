/** internal/hyperframes：从宿主入口拆出的独立职责模块。 */
import { spawn } from 'node:child_process';
import { resolveBinary } from '../media/ffmpeg.js';
import path from 'node:path';
import { createRequire } from 'node:module';
import { stat, mkdir } from 'node:fs/promises';

/** Hyperframes 使用宿主运行时启动，避免依赖客户的 node/npm/npx PATH。 */
export function runHyperframes(cli: string, args: string[], cwd: string, config: any, signal?: AbortSignal) {
  return new Promise<{ code: number; output: string }>((resolve, reject) => {
    if (signal?.aborted) return reject(new Error('Hyperframes 已取消。'));
    let output = '';
    const child = spawn(process.execPath, [cli, ...args], {
      cwd,
      env: {
        ...process.env,
        ELECTRON_RUN_AS_NODE: '1',
        CI: '1',
        HYPERFRAMES_NO_TELEMETRY: '1',
        ...Object.fromEntries([
          ['HYPERFRAMES_FFMPEG_PATH', resolveBinary(config, 'ffmpegBinary', 'ffmpeg')],
          ['HYPERFRAMES_FFPROBE_PATH', resolveBinary(config, 'ffprobeBinary', 'ffprobe')],
        ].filter(([, binary]) => path.isAbsolute(binary))),
      },
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });
    const collect = (data: Buffer) => { output = (output + data.toString()).slice(-24000); };
    child.stdout.on('data', collect);
    child.stderr.on('data', collect);
    let stopped: Error | undefined;
    let forceKill: ReturnType<typeof setTimeout> | undefined;
    const stop = (reason: string) => {
      if (stopped) return;
      stopped = new Error(reason);
      child.kill('SIGTERM');
      forceKill = setTimeout(() => child.kill('SIGKILL'), 5000);
      forceKill.unref();
    };
    const abort = () => stop('Hyperframes 已取消。');
    const timer = setTimeout(() => stop('Hyperframes 执行超过 20 分钟，已停止。'), 20 * 60 * 1000);
    const cleanup = () => {
      clearTimeout(timer);
      if (forceKill) clearTimeout(forceKill);
      signal?.removeEventListener('abort', abort);
    };
    signal?.addEventListener('abort', abort, { once: true });
    child.once('error', error => { cleanup(); reject(error); });
    child.once('close', code => {
      cleanup();
      if (stopped) reject(stopped);
      else resolve({ code: code ?? 1, output });
    });
  });
}

export function hyperframesTool(config: any, deps: Record<string, any>) {
  return {
    name: 'metaontic_agent_forge_video_hyperframes',
    description: '用 Hyperframes 将本地 HTML/CSS 动画、字幕和素材渲染成 MP4。action=check 检查环境；lint 校验项目；render 出片。项目目录须包含 index.html；先保存并展示完整脚本、通过脚本审核与制作确认，再 render。动画须可按时间定位，不能用实时时钟驱动。复用宿主 Node 运行时，无需客户运行 npm/npx。首次渲染可能下载 Chromium，需要网络。它不代替 Seedance 的实拍画面生成，不调用付费视频 API。',
    parameters: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['check', 'lint', 'render'], description: '默认 check。' },
        projectDir: { type: 'string', description: '已有 Hyperframes 项目目录，绝对路径或相对当前会话工作目录；lint/render 必填。' },
        output: { type: 'string', description: '相对项目目录的 MP4 输出路径；默认 renders/output-时间戳.mp4，已存在时拒绝覆盖。' },
        fps: { type: 'integer', enum: [24, 25, 30, 50, 60], description: '默认 30。' },
      },
    },
    output: {
      schema: { type: 'object', properties: {
        status: { type: 'string' }, action: { type: 'string' }, output: { type: 'string' },
        videoPath: { type: 'string' }, nodeVersion: { type: 'string' }, note: { type: 'string' },
      } },
      render(_args, value) { return [{ type: 'text', text: JSON.stringify(value, null, 2) }]; },
    },
    timeoutMs: 21 * 60 * 1000,
    isConcurrencySafe() { return false; },
    async execute(args: any, exec: any) {
      const action = args.action || 'check';
      if (!['check', 'lint', 'render'].includes(action)) throw new Error('不支持的 Hyperframes 操作。');
      const [major, minor] = process.versions.node.split('.').map(Number);
      if (major < 22 || (major === 22 && minor < 12)) return {
        status: 'runtime_unsupported', nodeVersion: process.versions.node,
        note: 'Hyperframes 及其浏览器依赖需要 Node 22.12+。请升级到提供兼容运行时的 Harness 桌面端；插件不会调用系统 node 或自动安装 Node。',
      };
      let cli: string;
      try {
        const require = createRequire(import.meta.url);
        cli = path.join(path.dirname(require.resolve('hyperframes/package.json')), 'bin/hyperframes.mjs');
      } catch {
        return { status: 'dependency_missing', note: 'Hyperframes 为内部开发能力，公开插件包不包含该依赖；需在开发环境单独准备。' };
      }
      let cwd = process.cwd();
      if (deps.workdir && exec?.agent) cwd = await deps.workdir.ensure(exec.agent, exec.signal) || cwd;
      const project = path.resolve(cwd, args.projectDir || '.');
      if (action !== 'check') {
        if (!args.projectDir) throw new Error('lint/render 必须指定 projectDir。');
        if (!(await stat(path.join(project, 'index.html'))).isFile()) throw new Error('项目缺少 index.html。');
      }
      let videoPath: string | undefined;
      let command = ['doctor', '--json'];
      if (action === 'lint') command = ['lint', project, '--json'];
      if (action === 'render') {
        if (args.fps !== undefined && ![24, 25, 30, 50, 60].includes(args.fps)) throw new Error('不支持的帧率。');
        const output = args.output || `renders/output-${Date.now()}.mp4`;
        videoPath = path.resolve(project, output);
        const relative = path.relative(project, videoPath);
        if (!relative || relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative) || path.extname(videoPath).toLowerCase() !== '.mp4') {
          throw new Error('输出必须是项目目录内的 .mp4 文件。');
        }
        try { await stat(videoPath); throw new Error('输出文件已存在，请换一个文件名。'); }
        catch (error) { if (error.code !== 'ENOENT') throw error; }
        await mkdir(path.dirname(videoPath), { recursive: true });
        command = ['render', project, '--output', videoPath, '--fps', String(args.fps || 30), '--workers', '1', '--strict'];
      }
      const result = await runHyperframes(cli, command, action === 'check' ? cwd : project, config, exec?.signal);
      if (result.code !== 0) return { status: 'failed', action, output: result.output, note: '检查输出中的环境或项目错误后重试；不会重复提交 Seedance 任务。' };
      if (videoPath && !(await stat(videoPath)).size) throw new Error('Hyperframes 未生成有效的 MP4 文件。');
      return { status: action === 'render' ? 'succeeded' : 'checked', action, output: result.output, ...(videoPath ? { videoPath } : {}) };
    },
  };
}
