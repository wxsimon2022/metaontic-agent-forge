/** 打包器把 .svg 当文本内联（见 scripts/build.mjs 的 text loader），这里给它一个类型。 */
declare module '*.svg' {
  const content: string;
  export default content;
}
