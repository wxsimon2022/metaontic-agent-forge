import type { AgentRegistry } from './agent-registry.js';
/** Native spawn owns task execution, persistence and completion delivery. This guard restricts delegation routes. */
export function delegationDecision(registry: AgentRegistry, ctx: any, exec: any): DshPreExecuteDecision | null {
  const names = new Set(['subagent', 'subagent_fork', ...registry.list().flatMap(agent => agent.delegation ? [agent.delegation.toolName] : [])]);
  if (!names.has(exec?.name) && !/^subagent(?:_|$)/.test(exec?.name || '')) return null;
  const agent = registry.resolve({ agent: exec?.agent }, ctx);
  if (!agent) return null; // Leave the host's standard mode unchanged.
  const policy = agent.delegation;
  const deny = (reason: string): DshPreExecuteDecision => ({ kind: 'deny', reason });
  if (!policy || exec.name !== policy.toolName) return deny('当前助手不提供此委派入口；专业助手不能继续委派，请由总控助手分配任务。');
  const headerDepth = exec.agent?.session?.header?.delegationDepth ?? 0;
  const runtimeDepth = exec.agent?.options?.subagentDepth ?? 0;
  if (![headerDepth, runtimeDepth].every(value => Number.isSafeInteger(value) && value >= 0 && !Object.is(value, -0))) return deny('无法确认当前委派层级，已停止创建子任务。');
  if (Math.max(headerDepth, runtimeDepth) >= policy.maxDepth) return deny('已达到委派深度上限；仅允许总控助手调用一层专业助手。');
  let args = exec.arguments || {};
  if (typeof args === 'string') { try { args = JSON.parse(args); } catch { return deny('委派参数无效，未创建子任务。'); } }
  if (!args || typeof args !== 'object' || Array.isArray(args)) return deny('委派参数无效，未创建子任务。');
  const target = args.agent_preset === undefined ? policy.defaultAgent : args.agent_preset;
  if (!policy.allowedAgents.includes(target) || !registry.get(target) || target === agent.id) return deny('目标助手不在可调用白名单中，未创建子任务。');
  return null;
}
