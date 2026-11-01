import { artifactLink } from './results.js';
/** 真人参考图先转为非真人风格，结果独立保存供视频工具引用。 */
import { ref } from '../config.js';
import { assertConfigured, resolveApiKey, isVolcengine, imageConfig } from '../providers/connection.js';
import { resolveImageInput } from '../media/references.js';
import { generateSeedreamImage } from '../providers/seedream.js';

export const IMAGE_MODELS = ['doubao-seedream-5-0-260128', 'doubao-seedream-5-0-pro-260628'];

export function prepareImageTool(liveConfig, progress = {}) {
  return {
    name: 'video_prepare_image',
    description: 'A/B 模式：用 Seedream 把真人参考图转为明显的非真人插画或动画角色。须先说明图片调用单独计费并确认风格；返回 imageUrl，可交给 video_generate/video_extend 的参考图或首尾帧。不能识别图片是否真人，由助手看图或根据用户说明判断；失败禁止改用原真人图生成视频。',
    parameters: {
      type: 'object',
      properties: {
        taskId: { type: 'string', description: '查询已提交图片任务并取件，不重新提交或扣取新的生成费用；填写时无需 image/style。' },
        seed: { type: 'integer', description: '可选随机种子。用户要求重新出图时使用不同 seed 并确认费用；相同参数的重复调用会复用已提交任务。' },
        image: { type: 'string', description: '原图公网 URL、base64、本机路径或 latest。' },
        style: { type: 'string', description: '已与用户确定的非真人风格，例如二维动画、卡通或插画。' },
      },
      required: [],
    },
    output: {
      schema: { type: 'object', properties: { taskId: { type: 'string' }, imageUrl: { type: 'string' }, model: { type: 'string' }, reviewRequired: { type: 'boolean' } } },
      render(_args, value) { return [{ type: 'text', text: `非真人参考图：${artifactLink('打开参考图', '', value.imageUrl)}\n图片模型：${value.model}\n请在正文内嵌图片并保留可点击原图链接，再核对风格与角色；有present卡片也不能省略链接。明确确认后再用于视频，不自动重画。` }]; },
    },
    timeoutMs: 480000,
    isConcurrencySafe() { return true; },
    async execute(args, exec) {
      const config = imageConfig(liveConfig);
      if (isVolcengine(config)) throw new Error('真人参考图预处理目前支持 A、B 接入方式。');
      assertConfigured(config, resolveApiKey(config));
      const model = String(ref(config, 'imageModel', IMAGE_MODELS[0]));
      if (!IMAGE_MODELS.includes(model)) throw new Error('请选择受支持的 Seedream 图片模型。');
      if (args?.taskId !== undefined && !String(args.taskId).trim()) throw new Error('图片 taskId 不能为空白。');
      if (args?.taskId) {
        const result = await generateSeedreamImage(config, undefined, exec?.signal, String(args.taskId).trim(), progress);
        return { ...result, model, reviewRequired: true };
      }
      const style = String(args?.style || '').trim();
      if (!style) throw new Error('请先确定非真人画面风格。');
      if (args?.seed !== undefined && !Number.isSafeInteger(args.seed)) throw new Error('seed 必须是安全整数。');
      const image = await resolveImageInput(args?.image, '真人参考图');
      const result = await generateSeedreamImage(config, {
        ...(args?.seed !== undefined ? { seed: args.seed } : {}),
        model, image: [image.url], size: '2048x2048', n: 1, response_format: 'url', watermark: false,
        prompt: `将参考照片中的真人转换为明显的非真人艺术角色，风格：${style}。保留服装、发型、姿态、构图和场景关系，使用清晰的绘画或动画材质与造型，不要输出摄影、写实皮肤或看起来仍是真人照片的画面。不添加文字。`,
      }, exec?.signal, undefined, progress);
      return { ...result, model, reviewRequired: true };
    },
  };
}
