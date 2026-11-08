import z from '@deepseek-ai/schemastery';
export const commonConfigFields = {
  usageStatsEnabled: z.boolean().default(true).description('匿名使用统计：仅统计版本、系统、工具调用与结果，不包含创作内容或API密钥；可随时关闭').volatile(),
};
