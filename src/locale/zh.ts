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
    description: '从创意到成片：视频创作助手帮你完善创意、编写脚本，审核确认后生成视频。支持参考图、视频续拍、逐段预览与断点续做，用低成本续拍分段方案生成超长视频，并在本机合并成片。',
  },
};

export default locale;
