/** Harness 稳定入口：只组合公共框架、业务模块与 Agent 清单。 */
import { createPluginRuntime } from './core/runtime.js';
import { agents } from './agents/index.js';
import { videoBusiness } from './businesses/video/index.js';
import { canvasBusiness } from './canvas/index.js';
export { Config } from './config.js';
export const inject = ['tools'];
export const apply = createPluginRuntime({ agents, businesses: [canvasBusiness, videoBusiness] });
