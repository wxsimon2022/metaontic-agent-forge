/**
 * workflow/script-tracking：把「脚本落盘」当成脚本设计阶段的真实终点。
 * 只观测会话事件，不改写文件、不拦截工具，失败也不影响生成。
 */
import { appendRequestLog } from '../utils/logging.js';
import { closePendingStage } from '../tools/video-stage.js';

const SCRIPT_FILE = /^script(?:[-_]?v?\d+)?\.md$/i;
const WRITE_TOOLS = new Set(['write', 'edit', 'multi_edit', 'multiedit', 'apply_patch']);
const PATCH_FILE_LINE = /^\*\*\* (?:Add|Update|Delete) File: (.+)$/gim;

/** Windows 会话事件给的是反斜杠路径，两平台都要取到文件名。 */
function fileBaseName(target) {
  return String(target ?? '').split(/[\\/]/).pop() || '';
}

function isScriptPath(target) {
  return SCRIPT_FILE.test(fileBaseName(target));
}

function toolArguments(value) {
  if (value && typeof value === 'object') return value;
  if (typeof value !== 'string') return {};
  try { return JSON.parse(value); } catch { return {}; }
}

/** 返回本次工具调用是否保存了脚本，以及它是新建还是改写。 */
function scriptSaveOf(event) {
  if (event?.type !== 'tool/call') return null;
  const data = event.data || {};
  const name = String(data.name || '');
  if (!WRITE_TOOLS.has(name)) return null;
  const args = toolArguments(data.arguments);
  const direct = args.file_path || args.path || args.filePath;
  if (isScriptPath(direct)) return { path: String(direct), tool: name, mode: name === 'write' ? 'create' : 'update' };
  if (name !== 'apply_patch') return null;
  const text = String(args.patch ?? args.input ?? '');
  for (const match of text.matchAll(PATCH_FILE_LINE)) {
    if (isScriptPath(match[1])) return { path: match[1].trim(), tool: name, mode: 'update' };
  }
  return null;
}

/** 脚本头里的版本标记只作日志参考，取不到就不写这条字段。 */
function scriptVersion(content) {
  const match = /版本[:：]\s*(第?\s*\d+\s*版)/.exec(String(content ?? ''));
  return match ? match[1].replace(/\s+/g, '') : undefined;
}

export function createScriptTracker({ closeStage = closePendingStage, log = appendRequestLog } = {}) {
  async function observe(session, event) {
    if (!session || typeof session !== 'object') return;
    const save = scriptSaveOf(event);
    if (!save) return;
    try {
      const content = toolArguments((event.data || {}).arguments).content;
      const text = typeof content === 'string' ? content : '';
      // 先收口：脚本已经落盘，此后助手做分镜、看图、提问都不该再算进脚本设计耗时。
      const closed = await closeStage('script_design', 'script_saved');
      await log({ event: 'script_saved', path: save.path, tool: save.tool, mode: save.mode,
        bytes: text ? Buffer.byteLength(text, 'utf8') : undefined, characters: text ? text.length : undefined,
        version: scriptVersion(text), turn: (event.data || {}).turn,
        closedSpanId: closed?.spanId, closedElapsedMs: closed?.elapsedMs });
    } catch {
      // 计时与日志都不影响脚本本身，失败时静默跳过。
    }
  }
  return { observe };
}
