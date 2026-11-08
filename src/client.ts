import { createPlatformClient } from './client/platform.js';
/** 浏览器宿主入口：新增业务界面只需加入模块清单。 */
import { createClientRuntime } from './client/runtime.js';
import { createVideoClient } from './businesses/video/client.js';
window.__ModuleLoader__.load({
  id: 'metaontic-agent-forge',
  factory: require => createClientRuntime(require, [{ id: 'platform', create: createPlatformClient }, { id: 'video', create: createVideoClient }]),
});
