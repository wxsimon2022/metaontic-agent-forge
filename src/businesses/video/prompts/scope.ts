import { agentRegistry } from '../../../agents/index.js';
import { registryForContext } from '../../../core/agent-registry.js';
/** 视频业务判断按 Agent 声明的依赖，新增视频 Agent 无须修改此处。 */
export function isVideoDirector(context: any, ctx: any) {
  return registryForContext(ctx, agentRegistry).hasBusiness(context, ctx, 'video');
}
export function isPromoVideoAssistant(context: any, ctx: any) {
  return registryForContext(ctx, agentRegistry).resolve(context, ctx)?.id === 'metaontic-agent-forge-promo-video';
}
