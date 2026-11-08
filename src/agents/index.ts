import { cloudStudio } from './forge-studio/index.js';
import { createAgentRegistry } from '../core/agent-registry.js';
import { videoDirector } from './forge-video-director/index.js';
import { promoVideo } from './forge-promo-video/index.js';
export const agents = [cloudStudio, videoDirector, promoVideo];
export const agentRegistry = createAgentRegistry(agents);
