/** workflow/execution：从宿主入口拆出的独立职责模块。 */
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

/**
 * 给会「接着暂停进度继续」的工具加一层互斥：只有传了 resume 的调用才需要锁，
 * 普通生成 / 延长之间互不影响（本来就是并发安全的）。
 */
let progressRecordModule;

export async function appendVideoExecution(exec, phase) {
  if (!exec?.agent?.session || !exec.callId) return;
  try {
    // Local linked plugins may resolve outside the host's node_modules tree.
    const resolver = createRequire(import.meta.url);
    const modulePath = resolver.resolve('@deepseek-ai/dsh-session', {
      paths: [path.dirname(process.argv[1] || process.execPath), path.dirname(fileURLToPath(import.meta.url))],
    });
    progressRecordModule ??= import(pathToFileURL(modulePath).href);
    const { appendPluginRecord } = await progressRecordModule;
    appendPluginRecord(exec.agent.session, 'plugin:metaontic-video/execution', { callId: exec.callId, phase });
  } catch {
    // A missing display capability must never fail or repeat a paid request.
  }
}

export function withVideoExecution(tool, onResult = undefined) {
  return {
    ...tool,
    async execute(args, exec) {
      await appendVideoExecution(exec, 'start');
      let value;
      try {
        value = await tool.execute(args, exec);
      } finally {
        await appendVideoExecution(exec, 'end');
      }
      // 记下这次真实交付了哪些分段与成片：present 提交前要用它校验成片排第一。
      // 记录会顺手量一遍文件大小（改名后的交付副本只能靠大小认领），因此这里要等它完成。
      try { await onResult?.(exec?.agent?.session, value); } catch { /* 记录失败不能影响交付 */ }
      return value;
    },
  };
}
