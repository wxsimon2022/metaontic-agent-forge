/** 核对结果不明的提交：本工具从不创建图片或视频任务。 */
import { readSubmission, reconcileSubmission, submissionIdentity } from '../providers/submissions.js';
import { snapshotConfig, imageConfig } from '../providers/connection.js';
export function submissionTool(liveConfig) {
  return {
    name: 'metaontic_agent_forge_media_submission',
    description: '核对图片/视频提交结果不明的防重记录。get 读取；reconcile 关联用户从渠道记录找到的原 taskId，或用户确认渠道未创建后用 confirmedNotCreated:true 解锁。不得猜任务 ID 或未经用户核对就解锁；本工具不创建付费任务。',
    parameters: { type: 'object', properties: {
      action: { type: 'string', enum: ['get', 'reconcile'] },
      submissionId: { type: 'string' }, taskId: { type: 'string' }, confirmedNotCreated: { type: 'boolean' },
    }, required: ['action', 'submissionId'] },
    output: { schema: { type: 'object', properties: { status: { type: 'string' }, submissionId: { type: 'string' }, taskId: { type: 'string' }, note: { type: 'string' } } }, render(_args, value) { return [{ type: 'text', text: JSON.stringify(value) }]; } },
    timeoutMs: 150000,
    isConcurrencySafe() { return false; },
    async execute(args) {
      const config = snapshotConfig(liveConfig);
      if (args?.action === 'get') {
        const record = await readSubmission(args.submissionId);
        if (record.identity !== submissionIdentity(/\/tasks\/doubao$/.test(record.requestPath) ? imageConfig(config) : config)) throw new Error('请恢复原连接和 API密钥后核对。');
        return { submissionId: record.id, status: record.status, taskId: record.taskId, model: record.model, createdAt: record.createdAt };
      }
      if (args?.action !== 'reconcile') throw new Error('未知操作。');
      return reconcileSubmission(config, args.submissionId, String(args?.taskId || '').trim(), args?.confirmedNotCreated);
    },
  };
}
