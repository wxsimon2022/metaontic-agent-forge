/** Keep the host's branded send_message identity and name for child return guidance. */
export const name = 'metaontic-agent-forge-report';
export const inject = ['tools', 'subagents', 'agents', 'loader'];
export async function apply(ctx) {
  const controls = await ctx.loader.import('@deepseek-ai/dsh-tool-subagent-control');
  const tools = new Proxy(ctx.tools, {
    get(target, key) {
      if (key === 'register') return definition => {
        // Specialists can report to their parent, but receive no delegation controls.
        if (definition.name === 'send_message') return ctx.tools.register(definition);
        return () => {};
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
  await controls.apply(scoped);
}
