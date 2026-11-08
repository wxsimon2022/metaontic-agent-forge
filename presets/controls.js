/** Host-native controls registered under this platform's fixed public prefix. */
import { apply as mountControls } from '@deepseek-ai/dsh-tool-subagent-control';
import { apply as mountList } from '@deepseek-ai/dsh-tool-subagent-control/list-agents';
import { markAdjacentAgentSendMessageTool } from '@deepseek-ai/dsh-subagent/internal';
export const name = 'metaontic-agent-forge-controls';
export const inject = ['tools', 'subagents', 'agents'];
const PREFIX = 'metaontic_agent_forge_';
const CONTROL_NAMES = ['send_message', 'interrupt_agent', 'list_agents'];
export function apply(ctx) {
  const tools = new Proxy(ctx.tools, {
    get(target, key) {
      if (key === 'register') return definition => {
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
  mountList(scoped);
}
