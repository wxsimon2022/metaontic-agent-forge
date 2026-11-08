import type { AgentDefinition } from '../../core/agent-registry.js';
import { promoVideoGuidance } from './instructions.js';
export const promoVideo: AgentDefinition = {
  id: 'metaontic-agent-forge-promo-video', name: '宣传视频助手', businesses: ['video', 'canvas'],
  skills: ['metaontic-agent-forge-video-director', 'metaontic-agent-forge-promo-video'], icon: 'presets/icons/metaontic-agent-forge-promo-video.svg',
  prompt: promoVideoGuidance,
};
