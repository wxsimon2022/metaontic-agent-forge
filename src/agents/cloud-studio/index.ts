import type { AgentDefinition } from '../../core/agent-registry.js';
import { cloudStudioGuidance } from './instructions.js';
export const cloudStudio: AgentDefinition = {
  id: 'cloud-studio', name: '云智工坊 · 智能体平台', businesses: [], skills: [],
  icon: 'presets/icons/cloud-studio.svg', prompt: cloudStudioGuidance,
  delegation: { toolName: 'delegate_agent', allowedAgents: ['video-director', 'promo-video'], defaultAgent: 'video-director', maxDepth: 1 },
};
