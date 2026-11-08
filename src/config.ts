/** 保留宿主配置命名空间和原字段，不改变已安装用户配置。 */
import z from '@deepseek-ai/schemastery';
import { commonConfigFields } from './core/settings/schema.js';
import { videoConfigFields } from './businesses/video/config.js';
export const Config = z.object({ ...commonConfigFields, ...videoConfigFields });
