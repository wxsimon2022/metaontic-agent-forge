import type { AgentDefinition } from '../../core/agent-registry.js';
import { promoVideoGuidance } from './instructions.js';
export const promoVideo: AgentDefinition = {
  id: 'forge-promo-video', name: '宣传视频助手', businesses: ['video'],
  skills: ['forge-video-director', 'forge-promo-video'], icon: 'presets/icons/forge-promo-video.svg',
  prompt: promoVideoGuidance,
};
