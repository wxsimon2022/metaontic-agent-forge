import { createAgentRegistry } from '../core/agent-registry.js';
import { videoDirector } from './video-director/index.js';
import { promoVideo } from './promo-video/index.js';
export const agents = [videoDirector, promoVideo];
export const agentRegistry = createAgentRegistry(agents);
