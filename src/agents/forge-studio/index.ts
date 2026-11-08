import type { AgentDefinition } from '../../core/agent-registry.js';
import { cloudStudioGuidance } from './instructions.js';
export const cloudStudio: AgentDefinition = {
  id: 'forge-studio', name: '云智工坊 · 智能体平台', businesses: [], skills: [],
  icon: 'presets/icons/forge-studio.svg', prompt: cloudStudioGuidance,
  delegation: { toolName: 'delegate_agent', allowedAgents: ['forge-video-director', 'forge-promo-video'], defaultAgent: 'forge-video-director', maxDepth: 1 },
};
