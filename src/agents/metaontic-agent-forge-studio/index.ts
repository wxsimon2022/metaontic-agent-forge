import type { AgentDefinition } from '../../core/agent-registry.js';
import { cloudStudioGuidance } from './instructions.js';
export const cloudStudio: AgentDefinition = {
  id: 'metaontic-agent-forge-studio', name: '云智工坊 · 智能体平台', businesses: [], skills: [],
  icon: 'presets/icons/metaontic-agent-forge-studio.svg', prompt: cloudStudioGuidance,
  delegation: { toolName: 'metaontic_agent_forge_delegate_agent', allowedAgents: ['metaontic-agent-forge-video-director', 'metaontic-agent-forge-promo-video'], defaultAgent: 'metaontic-agent-forge-video-director', maxDepth: 1 },
};
