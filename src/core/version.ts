/** 本插件版本：构建时由 esbuild --define 从 package.json 注入，跟着请求带给服务端。 */
export const PLUGIN_VERSION = typeof __PLUGIN_VERSION__ === 'string'
  ? __PLUGIN_VERSION__.trim().replace(/^v/i, '')
  : '';
