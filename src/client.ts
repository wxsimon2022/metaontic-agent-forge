import { createMediaPreview } from './client/media-preview.js';
/** Harness 浏览器入口：装配设置页、进度视图和宿主服务。 */
import { createTheme } from './client/theme.js';
import { createVideoProgress } from './client/progress.js';
import { createClientConfig } from './client/config.js';
import { createDictionaries } from './client/locale.js';
import { createSettingsState } from './client/state.js';
import { createUpdates } from './client/updates.js';
import { createSettingsPage } from './client/settings.js';
import { createSidebarPanel } from './client/panel.js';
import iconMark from '../icon.svg';

/** 左侧栏入参与面板本体共用的面板 id；也是 `main` 键位槽的 key。 */
const PANEL_ID = 'metaontic-video';
/** 面板里的「使用说明」链接。 */
const GUIDE_URL = 'https://ai.mybfs.cn';

window.__ModuleLoader__.load({
  id: 'metaontic-video',
  factory(require) {
    const React = require('react');
    const h = React.createElement;
    const { TOKENS, inputStyle, PAGE_CSS } = createTheme();
    const { MediaPreview } = createMediaPreview({ React, h });
    const { videoExecutionSource, VideoTaskProgress, VideoProgressDock } = createVideoProgress({ React, h, TOKENS, MediaPreview });
    const { PLUGIN_OWNED_KEYS, SELECTS, optionLabel, FIELD_BY_KEY, SECTIONS, formatMoney, NS, NAMESPACE } = createClientConfig();
    const { zh, en } = createDictionaries();
    const { useSnapshot, same, validateSettings, persistConnection, persistBatch } = createSettingsState({ React });
    const { PLUGIN_VERSION, UPDATE_CACHE_KEY, UPDATE_MAX_AGE_MS, fetchLatestVersion, PLUGIN_PACKAGE, UPDATE_SPEC, UPDATE_ATTEMPTS, isNewerVersion, updateBell } = createUpdates({ h });
    // 设置页的依赖统一走一个对象：宿主 React（React/h/useSnapshot）、主题与字段
    // （TOKENS/inputStyle/SELECTS/optionLabel/FIELD_BY_KEY/SECTIONS/formatMoney/PAGE_CSS）、
    // 设置状态（same/validateSettings/persistConnection/persistBatch/PLUGIN_OWNED_KEYS）、
    const { makePage } = createSettingsPage({ useSnapshot, React, h, TOKENS, same, validateSettings, persistConnection, PLUGIN_OWNED_KEYS, persistBatch, PLUGIN_VERSION, UPDATE_CACHE_KEY, UPDATE_MAX_AGE_MS, fetchLatestVersion, SELECTS, inputStyle, optionLabel, FIELD_BY_KEY, SECTIONS, formatMoney, PLUGIN_PACKAGE, UPDATE_SPEC, UPDATE_ATTEMPTS, isNewerVersion, updateBell, PAGE_CSS });
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
        for (const tool of ['video_generate', 'video_extend', 'video_status', 'video_prepare_image']) {
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
        // 面板组件要用当前配置快照与界面字典（form/t 在 apply 里才有），所以在这里构造。
        const { PanelIcon, VideoPanel } = createSidebarPanel({ React, h, TOKENS, PAGE_CSS, t, PANEL_ID, GUIDE_URL, LOGO_SVG: iconMark });
        // 左侧栏入口与面板本体是宿主 root 作用域的两个 slot，用同一个 id 关联：
        // sidebar.panellist 只放一行图标（收到 {size, active}），点它切到 main 里同 id 的面板。
        // 老版本宿主没有这两个 slot 时 inject 不会触发，其余界面与工具不受影响。
        ctx.effect(() => ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
          name: 'sidebar.panellist',
          id: PANEL_ID,
          order: 30,
          locale: NS,
          // 左侧那一行显示的名字，比面板标题更完整，方便在图标列表里认出来。
          label: () => t('panelSidebarLabel'),
        }, PanelIcon)), 'metaontic-video: sidebar entry');
        ctx.effect(() => ctx.slots.inject('main', () => ctx.slots.register({
          name: 'main',
          key: PANEL_ID,
          locale: NS,
          // 面板要的两个动作都按需取服务：老宿主没有这些服务时按钮自然失效，不报错。
          inject: () => ({
            startSession: () => ctx.get('uiWorkspace')?.startSession(undefined, { agentPreset: 'video-director' }),
            openSettings: () => ctx.get('pluginNavigation')?.openBundle(NAMESPACE),
          }),
        }, VideoPanel)), 'metaontic-video: sidebar panel');
      },
    };
  },
});
