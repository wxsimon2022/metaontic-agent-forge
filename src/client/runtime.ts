import { createSettingsPages } from '../core/settings/client.js';
/** 浏览器业务模块共用一个宿主入口，各自声明服务依赖并注册自己的界面。 */
export function createClientRuntime(require: any, modules: readonly { id: string; create: (require: any) => any }[]) {
  const ids = new Set<string>();
  const plugins = modules.map(module => {
    if (!module.id || ids.has(module.id)) throw new Error(`重复或无效的界面模块：${module.id}`);
    ids.add(module.id);
    return module.create(require);
  });
  return {
    inject: [...new Set(plugins.flatMap(plugin => plugin.inject || []))],
    apply(ctx: any) {
      const settings = createSettingsPages(require('react').createElement);
      for (const plugin of plugins) plugin.apply(ctx, { settings });
      settings.mount(ctx);
    },
  };
}
