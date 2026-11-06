import { artifactLink } from './results.js';
/** 真人参考图先转为非真人风格，结果独立保存供视频工具引用。 */
import { ref } from '../config.js';
import { assertConfigured, resolveApiKey, isVolcengine, imageConfig } from '../providers/connection.js';
import { resolveImageInput } from '../media/references.js';
import { generateSeedreamImage } from '../providers/seedream.js';
import { IMAGE_MODEL } from '../connection-defaults.js';

const IMAGE_MODELS = [IMAGE_MODEL];

export function prepareImageTool(liveConfig, progress = {}) {
  return {
    name: 'video_prepare_image',
    description: 'A/B 模式：Seedream支持operation=create_character按文字生成角色参考图（不需要原图），或默认convert_reference把真人参考图转为非真人角色。纯文生视频先询问是否出角色图，明确图片单独计费；同意后生成，逐张展示并审核后才能用于视频。须先说明图片调用单独计费并确认风格；返回 imageUrl，可交给 video_generate/video_extend 的参考图或首尾帧。不能识别图片是否真人，由助手看图或根据用户说明判断；失败禁止改用原真人图生成视频。',
    parameters: {
      type: 'object',
      properties: {
        operation: { type: 'string', enum: ['convert_reference', 'create_character'], description: '默认convert_reference转换已有图；create_character根据已确认的人物设定与风格文生角色图，不需要image。' },
        prompt: { type: 'string', description: 'create_character必填：已审核的人物/主体外形、服饰与稳定特征，不填视频动作剧情或对白。' },
        taskId: { type: 'string', description: '查询已提交图片任务并取件，不重新提交或扣取新的生成费用；填写时无需 image/style。' },
        seed: { type: 'integer', description: '可选随机种子。用户要求重新出图时使用不同 seed 并确认费用；相同参数的重复调用会复用已提交任务。' },
        image: { type: 'string', description: 'convert_reference使用的原图公网URL、base64、本机路径或latest；create_character不填。' },
        characterType: { type: 'string', enum: ['realistic', 'stylized'], description: '仅create_character：realistic真人写实（风格选项第一位），stylized非真人动画/插画。须用户明确选择；未指定沿用stylized。convert_reference只允许stylized。' },
        style: { type: 'string', description: '已与用户确定的画面风格。按真人写实、二维动画、卡通、插画顺序展示建议；真人写实同时设置characterType=realistic，转换操作必须非真人。' },
      },
      required: [],
    },
    output: {
      schema: { type: 'object', properties: { taskId: { type: 'string' }, imageUrl: { type: 'string' }, model: { type: 'string' }, reviewRequired: { type: 'boolean' } } },
      render(_args, value) { return [{ type: 'text', text: `角色参考图：${artifactLink('打开参考图', '', value.imageUrl)}\n图片模型：${value.model}\n请在正文内嵌图片并保留可点击原图链接，再核对风格与角色；参考图属于过程材料，不要登记进交付卡片（卡片只放最终成片）。明确确认后再用于视频，不自动重画。` }]; },
    },
    timeoutMs: 480000,
    isConcurrencySafe() { return true; },
    async execute(args, exec) {
      const config = imageConfig(liveConfig);
      if (isVolcengine(config)) throw new Error('角色图生成与参考图处理目前支持服务端或MetaOntic AI接入；火山直连暂不提供此图片通道，可使用已准备好的角色参考图。');
      assertConfigured(config, resolveApiKey(config));
      const model = String(ref(config, 'imageModel', IMAGE_MODELS[0]));
      if (!IMAGE_MODELS.includes(model)) throw new Error('请选择受支持的 Seedream 图片模型。');
      if (args?.taskId !== undefined && !String(args.taskId).trim()) throw new Error('图片 taskId 不能为空白。');
      if (args?.taskId) {
        const result = await generateSeedreamImage(config, undefined, exec?.signal, String(args.taskId).trim(), progress);
        return { ...result, model, reviewRequired: true };
      }
      const operation = args?.operation || 'convert_reference';
      if (!['convert_reference', 'create_character'].includes(operation)) throw new Error('不支持的图片操作。');
      const style = String(args?.style || '').trim();
      if (!style) throw new Error('请先确定画面风格。');
      const characterType = args?.characterType ?? 'stylized';
      if (!['realistic', 'stylized'].includes(characterType)) throw new Error('不支持的角色风格类型。');
      if (operation === 'convert_reference' && characterType !== 'stylized') throw new Error('真人限制转换必须使用非真人风格，不能转换为真人写实。');
      if (args?.seed !== undefined && !Number.isSafeInteger(args.seed)) throw new Error('seed 必须是安全整数。');
      let input;
      let prompt;
      if (operation === 'create_character') {
        const character = String(args?.prompt || '').trim();
        if (!character) throw new Error('请先确认角色外形设定，再生成角色参考图。');
        if (args?.image) throw new Error('文生角色图不需要原图；已有图片请使用转换操作。');
        const appearance = characterType === 'realistic'
          ? '采用真人写实摄影风格，自然的皮肤纹理、真实的人体比例与柔和光影，不使用卡通、插画或动画造型。'
          : '采用明显的非真人插画或动画造型，不要输出摄影或看起来仍是真人的照片。';
        prompt = `生成一张角色参考图。角色设定：${character}。已确认风格：${style}。${appearance}清晰呈现角色的脸部、发型、服装及体型特征；画面仅一位对应角色，背景简洁，不画人物多视图拼图、分身或额外人物，不添加文字、字幕、Logo或水印。`;
      } else {
        input = await resolveImageInput(args?.image, '真人参考图');
        prompt = `将参考照片中的真人转换为明显的非真人艺术角色，风格：${style}。保留服装、发型、姿态、构图和场景关系，使用清晰的绘画或动画材质与造型，不要输出摄影、写实皮肤或看起来仍是真人照片的画面。不添加文字。`;
      }
      const result = await generateSeedreamImage(config, {
        ...(args?.seed !== undefined ? { seed: args.seed } : {}),
        model, ...(input ? { image: [input.url] } : {}), size: '2048x2048', n: 1, response_format: 'url', watermark: false,
        prompt,
      }, exec?.signal, undefined, progress);
      return { ...result, model, reviewRequired: true };
    },
  };
}
