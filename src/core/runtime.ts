import { bindAgentRegistry, createAgentRegistry, type AgentDefinition } from './agent-registry.js';
import { createToolRegistry } from './tool-registry.js';
import { createAnalyticsReporter } from './telemetry/reporter.js';
import { startUpdateLockfileRepair } from './installation/update-lockfile.js';
export interface BusinessModule {
  id: string;
  apply(runtime: BusinessRuntime): void | (() => void);
  prompt?: (config: any) => string;
}
export interface BusinessRuntime {
  ctx: DshContext;
  config: any;
  agents: ReturnType<typeof createAgentRegistry>;
  tools: ReturnType<typeof createToolRegistry>;
  defer(dispose: unknown): void;
}
/** 一个宿主入口装配多个业务；注册失败回滚，退出逐项清理，单项清理失败不阻断其他模块。 */
export function createPluginRuntime(definitions: { agents: readonly AgentDefinition[]; businesses: readonly BusinessModule[] }) {
  const agents = createAgentRegistry(definitions.agents);
  const businesses = new Map<string, BusinessModule>();
  for (const module of definitions.businesses) {
    if (!module.id || businesses.has(module.id)) throw new Error(`重复或无效的业务：${module.id}`);
    businesses.set(module.id, module);
  }
  for (const agent of agents.list()) for (const id of agent.businesses) {
    if (!businesses.has(id)) throw new Error(`Agent ${agent.id} 缺少业务模块：${id}`);
  }
  return function apply(ctx: DshContext, config: any = {}) {
    const disposers: Array<() => void> = [];
    let disposed = false;
    const defer = (value: unknown) => {
      if (typeof value !== 'function') return;
      if (disposed) (value as () => void)(); else disposers.push(value as () => void);
    };
    const dispose = () => {
      if (disposed) return;
      disposed = true;
      for (const cleanup of disposers.reverse()) {
        try { cleanup(); } catch { ctx.logger?.warn?.('插件模块清理失败，已继续清理其余模块。'); }
      }
    };
    const analytics = createAnalyticsReporter(config);
    defer(() => analytics.dispose());
    defer(bindAgentRegistry(ctx, agents));
    const tools = createToolRegistry(ctx, agents, analytics, defer);
    const runtime = { ctx, config, agents, tools, defer };
    try {
      for (const business of businesses.values()) defer(business.apply(runtime));
      defer(ctx.inject(['systemPrompt'], promptCtx => promptCtx.systemPrompt.section({
        name: 'plugin:metaontic-video', order: 5200,
        text: context => {
          const agent = agents.resolve(context, ctx);
          if (!agent) return '';
          return [...agent.businesses.map(id => businesses.get(id)?.prompt?.(config) || ''), agent.prompt?.(config) || ''].filter(Boolean).join('\n\n');
        },
      })));
      try { defer(startUpdateLockfileRepair(import.meta.url, undefined, message => ctx.logger?.warn?.(`metaontic-video: ${message}`))); }
      catch { ctx.logger?.warn?.('metaontic-video: 安装目录锁文件自愈未启用。'); }
      analytics.start();
      return dispose;
    } catch (error) { dispose(); throw error; }
  };
}
