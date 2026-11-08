/** 浏览器宿主入口：新增业务界面只需加入模块清单。 */
import { createClientRuntime } from './client/runtime.js';
import { createVideoClient } from './businesses/video/client.js';
window.__ModuleLoader__.load({
  id: 'metaontic-video',
  factory: require => createClientRuntime(require, [{ id: 'video', create: createVideoClient }]),
});
