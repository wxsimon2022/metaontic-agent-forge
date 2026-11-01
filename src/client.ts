/** Harness 浏览器入口：装配设置页、进度视图和宿主服务。 */
import { createTheme } from './client/theme.js';
import { createVideoProgress } from './client/progress.js';
import { createClientConfig } from './client/config.js';
import { createDictionaries } from './client/locale.js';
import { createSettingsState } from './client/state.js';
import { createUpdates } from './client/updates.js';
import { createSettingsPage } from './client/settings.js';

window.__ModuleLoader__.load({
  id: 'metaontic-video',
  factory(require) {
    const React = require('react');
    const h = React.createElement;
    const { TOKENS, inputStyle, PAGE_CSS } = createTheme();
    const { videoExecutionSource, VideoTaskProgress, VideoProgressDock } = createVideoProgress({ React, h, TOKENS });
    const { PLUGIN_OWNED_KEYS, DEFAULT_REGISTER_API, LOGGED_OUT_KEY, DEFAULT_REGISTER_TOKEN, SELECTS, optionLabel, FIELD_BY_KEY, SECTIONS, formatMoney, NS, NAMESPACE } = createClientConfig();
    const { zh, en } = createDictionaries();
    const { useSnapshot, same, validateSettings, persistConnection, persistBatch } = createSettingsState({ React });
    const { PLUGIN_VERSION, UPDATE_CACHE_KEY, UPDATE_MAX_AGE_MS, fetchLatestVersion, fetchRecentVersions, PLUGIN_PACKAGE, UPDATE_SPEC, UPDATE_ATTEMPTS, isNewerVersion, updateBell } = createUpdates({ h });
    const { makePage } = createSettingsPage({ useSnapshot, React, h, TOKENS, same, validateSettings, persistConnection, PLUGIN_OWNED_KEYS, persistBatch, DEFAULT_REGISTER_API, LOGGED_OUT_KEY, DEFAULT_REGISTER_TOKEN, PLUGIN_VERSION, UPDATE_CACHE_KEY, UPDATE_MAX_AGE_MS, fetchLatestVersion, fetchRecentVersions, SELECTS, inputStyle, optionLabel, FIELD_BY_KEY, SECTIONS, formatMoney, PLUGIN_PACKAGE, UPDATE_SPEC, UPDATE_ATTEMPTS, isNewerVersion, updateBell, PAGE_CSS });
    return {
      inject: ['slots', 'locale', 'configForms', 'uiSession'],
      apply(ctx) {
        ctx.effect(() => ctx.uiSession.provide({
          hooks: ['videoExecutions'],
          resolve: (binding) => ({ hooks: { videoExecutions: videoExecutionSource(binding.eventSource) } }),
        }), 'metaontic-video: actual video execution');
        const t = ctx.locale.bind(NS);
        ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'metaontic-video: dictionaries');
        const form = ctx.configForms.get(NAMESPACE);
        for (const tool of ['video_generate', 'video_extend', 'video_status']) {
          ctx.effect(() => ctx.slots.inject('tool.call.toolview', () =>
            ctx.slots.register({ name: 'tool.call.toolview', key: tool, locale: NS }, VideoTaskProgress)),
          `metaontic-video: ${tool} progress`);
        }
        ctx.effect(() => ctx.slots.inject('conversation.input.dock', () =>
          ctx.slots.register({ name: 'conversation.input.dock', id: 'metaontic-video-progress', order: -20 },
            VideoProgressDock)), 'metaontic-video: visible video progress');
        // 在线更新要用宿主的插件管理服务。它不是一个 `remote` 上的属性，而是宿主远程层按
        // 「命名空间服务」注册的独立服务，名字就是带点的 `remote.pluginManager`（cordis 的
        // `ctx.get()` 认这种名字）；所以先按全名取，取不到再退回属性写法，两条都记下来，
        // 失败时把结果写进提示里，省得又变成「点了没反应」。
        // 包一层 getter：点击时才取，重装过程里本插件马上会被卸掉，引用要赶在卸载之前拿到。
        const pluginManager = () => {
          const tried = [];
          const shape = (value) => (value === undefined ? 'undefined' : (value === null ? 'null' : typeof value));
          try {
            const direct = typeof ctx.get === 'function' ? ctx.get('remote.pluginManager') : undefined;
            if (direct && typeof direct.installBundle === 'function') return { manager: direct, tried };
            tried.push(`remote.pluginManager=${shape(direct)}`);
          } catch (error) {
            tried.push(`remote.pluginManager 抛错：${error && error.message ? error.message : String(error)}`);
          }
          try {
            const remote = typeof ctx.get === 'function' ? ctx.get('remote') : undefined;
            const nested = remote && remote.pluginManager;
            if (nested && typeof nested.installBundle === 'function') return { manager: nested, tried };
            tried.push(`remote=${shape(remote)}`);
          } catch (error) {
            tried.push(`remote 抛错：${error && error.message ? error.message : String(error)}`);
          }
          return { manager: null, tried };
        };
        const Page = makePage({ form, t, manager: pluginManager });
        // 第三方 bundle 的配置页注册到 plugins.bundle.config，以 npm 包名为 key；
        // 打开「已安装插件」里的 metaontic-video 详情页时显示在描述与组件行之间。
        ctx.effect(() => ctx.slots.inject('plugins.bundle.config', () => ctx.slots.register({
          name: 'plugins.bundle.config',
          key: NAMESPACE,
          locale: NS,
        }, Page)), 'metaontic-video: configuration page');
      },
    };
  },
});
