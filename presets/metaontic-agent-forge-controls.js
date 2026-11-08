/** Host-native controls registered under this platform's fixed public prefix. */
export const name = 'metaontic-agent-forge-controls';
export const inject = ['tools', 'subagents', 'agents', 'loader'];
const PREFIX = 'metaontic_agent_forge_';
const CONTROL_NAMES = ['send_message', 'interrupt_agent', 'list_agents'];
export async function apply(ctx) {
  // 由宿主加载器解析内置插件，避免第三方包目录的静态 ESM 依赖解析阻断整个预设。
  const [controls, routing] = await Promise.all([
    ctx.loader.import('@deepseek-ai/dsh-tool-subagent-control'),
    ctx.loader.import('@deepseek-ai/dsh-subagent/internal'),
  ]);
  const mountControls = controls.apply;
  const registered = new Set();
  const { markAdjacentAgentSendMessageTool } = routing;
  const tools = new Proxy(ctx.tools, {
    get(target, key) {
      if (key === 'register') return definition => {
        registered.add(definition.name);
        const renamed = { ...definition, name: PREFIX + definition.name };
        if (typeof renamed.description === 'string') {
          for (const id of CONTROL_NAMES) renamed.description = renamed.description.replaceAll(id, PREFIX + id);
        }
        // Preserve native routing recognition after wrapping the send-message definition.
        if (definition.name === 'send_message') markAdjacentAgentSendMessageTool(renamed);
        return ctx.tools.register(renamed);
      };
      const value = Reflect.get(target, key, target);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
  const scoped = new Proxy(ctx, {
    get(target, key) {
      if (key === 'tools') return tools;
      const value = Reflect.get(target, key, target);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
  mountControls(scoped);
  // 新宿主在主模块一次注册三个工具；旧宿主将列表工具单独导出。
  if (!registered.has('list_agents')) {
    const list = await ctx.loader.import('@deepseek-ai/dsh-tool-subagent-control/list-agents');
    list.apply(scoped);
  }
}
