/** Agent 描述不依赖具体业务；当前模式只读宿主预设，不从历史消息推断。 */
export interface AgentDefinition {
  id: string;
  name: string;
  businesses: readonly string[];
  skills: readonly string[];
  icon: string;
  prompt?: (config: any) => string;
  delegation?: { toolName: string; allowedAgents: readonly string[]; defaultAgent: string; maxDepth: number };
}
export function selectedAgentId(context: any, ctx?: any): string | null {
  const agent = context?.agent;
  const session = agent?.session;
  if (!session) return null;
  for (const owner of [agent?.ctx, ctx]) {
    try {
      const registry = owner?.get?.('agentPresets');
      if (typeof registry?.presetForSession === 'function') return registry.presetForSession(session) ?? null;
    } catch { return null; }
  }
  return session.header?.agentPreset ?? null;
}
export function createAgentRegistry(definitions: readonly AgentDefinition[]) {
  const agents = new Map<string, AgentDefinition>();
  for (const definition of definitions) {
    if (!definition.id || agents.has(definition.id)) throw new Error(`重复或无效的 Agent：${definition.id}`);
    agents.set(definition.id, Object.freeze({ ...definition, businesses: Object.freeze([...definition.businesses]), skills: Object.freeze([...definition.skills]), ...(definition.delegation ? { delegation: Object.freeze({ ...definition.delegation, allowedAgents: Object.freeze([...definition.delegation.allowedAgents]) }) } : {}) }));
  }
  for (const agent of agents.values()) {
    const policy = agent.delegation;
    if (!policy) continue;
    if (!/^[a-z][a-z0-9_]*$/.test(policy.toolName) || !Number.isSafeInteger(policy.maxDepth) || policy.maxDepth !== 1) throw new Error('委派入口必须具名，且当前仅支持一层委派');
    if (!policy.allowedAgents.length || !policy.allowedAgents.includes(policy.defaultAgent)) throw new Error('委派默认目标必须在白名单中');
    for (const target of policy.allowedAgents) {
      if (target === agent.id || !agents.has(target) || agents.get(target).delegation) throw new Error(`委派目标无效或形成嵌套委派：${target}`);
    }
  }
  const resolve = (context: any, ctx?: any) => agents.get(selectedAgentId(context, ctx)) ?? null;
  return Object.freeze({
    list: () => [...agents.values()],
    get: (id: string) => agents.get(id) ?? null,
    resolve,
    hasBusiness: (context: any, ctx: any, business: string) => resolve(context, ctx)?.businesses.includes(business) ?? false,
  });
}
export type AgentRegistry = ReturnType<typeof createAgentRegistry>;
const active = new WeakMap<object, Array<{ registry: AgentRegistry }>>();
export function registryForContext(ctx: object, fallback: AgentRegistry): AgentRegistry {
  return ctx && active.get(ctx)?.at(-1)?.registry || fallback;
}
export function bindAgentRegistry(ctx: object, registry: AgentRegistry) {
  const stack = active.get(ctx) || [];
  const entry = { registry };
  stack.push(entry);
  active.set(ctx, stack);
  return () => {
    const index = stack.indexOf(entry);
    if (index >= 0) stack.splice(index, 1);
    if (!stack.length && active.get(ctx) === stack) active.delete(ctx);
  };
}
