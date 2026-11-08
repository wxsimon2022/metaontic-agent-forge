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
    title: 'MetaOnticVideo',
    description: '让新手快速上手视频创作：说出想法，助手带你完善创意、写脚本并确认制作；通过分段续拍与本机合并，提供低成本长视频生成方案。',
  },
};

export default locale;
