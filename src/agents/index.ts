import { cloudStudio } from './metaontic-agent-forge-studio/index.js';
import { createAgentRegistry } from '../core/agent-registry.js';
import { videoDirector } from './metaontic-agent-forge-video-director/index.js';
import { promoVideo } from './metaontic-agent-forge-promo-video/index.js';
export const agents = [cloudStudio, videoDirector, promoVideo];
export const agentRegistry = createAgentRegistry(agents);
