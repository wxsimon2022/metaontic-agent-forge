import type { AgentRegistry } from './agent-registry.js';
import { withUsageAnalytics } from './telemetry/reporter.js';
import { withStageTiming } from './utils/timing.js';
/** 公共工具装配负责命名冲突、Agent 业务边界和旁路统计；审批由业务提供。 */
export function createToolRegistry(ctx: DshContext, agents: AgentRegistry, analytics: any, defer: (dispose: unknown) => void = () => {}) {
  const owners = new Map<string, string>();
  function allowed(business: string, exec: any) {
    const agent = agents.resolve({ agent: exec?.agent }, ctx);
    // 标准/宿主其他预设保留手动工具能力，不注入业务身份；明确注册的 Agent 只使用所依赖业务。
    return !agent || agent.businesses.includes(business);
  }
  function register(business: string, tool: DshToolDefinition, registrationContext: DshContext = ctx) {
    if (!/^metaontic_agent_forge_[a-z0-9_]+$/.test(tool.name) || tool.name.length > 64) throw new Error('平台工具名称必须使用 metaontic_agent_forge_ 固定前缀，且不超过64字符。');
    if (owners.has(tool.name)) throw new Error(`工具名称重复：${tool.name}`);
    owners.set(tool.name, business);
    const guarded = { ...tool, async execute(args: any, exec: any) {
      if (!allowed(business, exec)) throw new Error('当前助手未启用此业务，请切换到对应助手后重试。');
      return tool.execute(args, exec);
    } };
    let dispose;
    try {
      dispose = registrationContext.tools.register(withStageTiming(withUsageAnalytics(guarded, analytics,
        exec => agents.resolve({ agent: exec?.agent }, ctx)?.id || 'standard')));
    } catch (error) { owners.delete(tool.name); throw error; }
    let disposed = false;
    const cleanup = () => { if (disposed) return; disposed = true; owners.delete(tool.name); if (typeof dispose === 'function') dispose(); };
    defer(cleanup);
    return cleanup;
  }
  return { register, allowed, owner: (name: string) => owners.get(name) };
}
