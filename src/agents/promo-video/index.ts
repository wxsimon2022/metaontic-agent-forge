import type { AgentDefinition } from '../../core/agent-registry.js';
import { promoVideoGuidance } from './instructions.js';
export const promoVideo: AgentDefinition = {
  id: 'promo-video', name: '宣传视频助手', businesses: ['video'],
  skills: ['video-director', 'promo-video'], icon: 'presets/icons/promo-video.svg',
  prompt: promoVideoGuidance,
};
