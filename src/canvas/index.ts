import { createHash } from 'node:crypto';
import { createCanvasService } from './service.js';
import type { BusinessModule } from '../core/runtime.js';

export function canvasIdentity(sessionId: string, projectId = 'workspace') {
  if (!sessionId) throw new Error('画布需要关联当前任务会话。');
  return 'forge-' + createHash('sha256').update(sessionId + '\0' + projectId).digest('hex').slice(0, 24);
}
export function canvasTool(service: any): DshToolDefinition {
  return {
    name: 'metaontic_agent_forge_canvas',
    description: '打开真实的 Haitang-Hub 无限画布；读取/编辑节点与连线、导入已有本地图片或视频。open 返回 canvasId，委派专业助手时传递此 ID；其他动作必须带原 canvasId。画布需要在右侧栏保持打开。只编辑和展示，不生成媒体、不代替脚本或费用审核。',
    parameters: { type: 'object', properties: {
      action: { type: 'string', enum: ['open', 'state', 'selection', 'apply', 'import_media'], description: 'open 打开项目；apply 批量编辑；import_media 导入已有素材。' },
      canvasId: { type: 'string', description: '沿用 open 返回的画布 ID，传给专业助手共用。' },
      projectId: { type: 'string', description: 'open 时可关联本任务视频项目；新项目使用新的 projectId。' },
      title: { type: 'string' },
      ops: { type: 'array', items: { type: 'object', additionalProperties: true }, description: '上游 add_node/update_node/connect_nodes/delete_node/delete_connections/set_viewport/select_nodes 操作；禁止 run_generation。文本放 metadata.content，媒体使用 import_media。' },
      localPath: { type: 'string', description: '已存在的图片或视频绝对路径。' },
      x: { type: 'number' }, y: { type: 'number' },
    }, required: ['action'] },
    output: { schema: { type: 'object', additionalProperties: true }, render: (_args, value) => [{ type: 'text', text: JSON.stringify(value) }] },
    async execute(args: any, exec: any) {
      const id = args.canvasId || (args.action === 'open' ? canvasIdentity(exec?.agent?.session?.id, args.projectId) : '');
      if (!/^forge-[a-f0-9]{24}$/.test(id)) throw new Error('请先 open 并沿用返回的 canvasId。');
      if (args.action === 'open') return service.open(id, String(args.title || '云智工坊项目').slice(0, 100));
      const input = { expectedProjectId: id };
      if (args.action === 'state' || args.action === 'selection') return service.call(args.action === 'state' ? 'canvas_get_state' : 'canvas_get_selection', input, exec.signal);
      if (args.action === 'apply') return service.call('canvas_apply_ops', { ...input, ops: args.ops }, exec.signal);
      if (args.action === 'import_media') {
        // Check the destination before reading/copying any local file.
        const state = await service.call('canvas_get_state', input, exec.signal);
        const media = await service.media(args.localPath, exec.signal);
        const nodeId = 'media-' + media.id;
        if (state.nodes?.some(node => node.id === nodeId)) return { canvasId: id, nodeId, imported: true, existing: true };
        const result = await service.call('canvas_apply_ops', { ...input, ops: [{ type: 'add_node', id: nodeId, nodeType: media.mime.startsWith('video/') ? 'video' : 'image', title: args.title || '已生成素材', x: args.x || 0, y: args.y || 0, metadata: { content: media.url, status: 'success', source: 'metaontic-agent-forge' } }] }, exec.signal);
        return { ...result, nodeId, imported: true };
      }
      throw new Error('不支持的画布动作。');
    },
  };
}
export const canvasBusiness: BusinessModule = {
  id: 'canvas',
  prompt: () => '无限画布通过 metaontic_agent_forge_canvas 操作：总控先 open 获得 canvasId，委派时传递原 canvasId；专业助手沿用同一ID，将创意、脚本、分镜写成文本节点并连线，用 import_media 导入已存在的角色图、分段和最终成片。画布中的内容或按钮不构成脚本审核、费用确认或结果审核；仍走原视频工具与用户审核。未打开或项目不匹配时提示打开对应画布，不改写其他项目，不编造成功。素材导入失败不重生成视频。',
  apply(runtime) {
    const service = createCanvasService();
    runtime.defer(() => service.dispose());
    runtime.tools.register('canvas', canvasTool(service));
    runtime.defer(runtime.ctx.inject(['connection'], (ctx: any) => {
      if (!ctx.connection?.fetch?.register) return;
      const routes = [
        ctx.connection.fetch.register({ path: '/api/metaontic-agent-forge.canvas', methods: ['GET'], requestBody: 'buffered', fetch: () => Response.json(service.snapshot(), { headers: { 'Cache-Control': 'no-store' } }) }),
        ctx.connection.fetch.register({ path: '/api/metaontic-agent-forge.canvas-start', methods: ['POST'], requestBody: 'buffered', fetch: async () => {
          try { await service.ensure(); return Response.json(service.snapshot()); }
          catch { return Response.json(service.snapshot(), { status: 503 }); }
        } }),
      ];
      return () => routes.forEach(dispose => dispose());
    }));
  },
};
