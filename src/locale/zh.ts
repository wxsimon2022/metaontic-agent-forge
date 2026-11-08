/**
 * 插件在「插件」页里显示的标题与描述（中文）。
 *
 * 源码写在 TS 里，构建时由 `scripts/build-locale.mjs` 生成 `locale/zh.json`——
 * DSH 是按 `./locale/*.json` 这个导出路径读元信息的，运行时只认 JSON。
 */
export interface PluginLocale {
  meta: {
    title: string;
    description: string;
  };
}

export const locale: PluginLocale = {
  meta: {
    title: '云智工坊 · 智能体平台',
    description: '统一调度专业 Agent 的智能体平台。云智工坊负责委派与汇总，内置视频创作和宣传视频助手，支持独立扩展业务。',
  },
};

export default locale;
