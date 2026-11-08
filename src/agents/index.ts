import { cloudStudio } from './cloud-studio/index.js';
import { createAgentRegistry } from '../core/agent-registry.js';
import { videoDirector } from './video-director/index.js';
import { promoVideo } from './promo-video/index.js';
export const agents = [cloudStudio, videoDirector, promoVideo];
export const agentRegistry = createAgentRegistry(agents);
