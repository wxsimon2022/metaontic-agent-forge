import { registerAgentPicker } from './agent-picker.js';
import { FORGE_CANVAS_KIND, registerInfiniteCanvas } from './infinite-canvas.js';
import { createTheme } from './theme.js';
import { createSidebarPanel } from './panel.js';
import { createPlatformDictionaries } from './locale.js';
import iconMark from '../../icon.svg';
const PANEL_ID = 'metaontic-agent-forge';
const NAMESPACE = 'metaontic-agent-forge';
const NS = 'platform.metaonticAgentForge';
const GUIDE_URL = 'https://ai.mybfs.cn';
export function createPlatformClient(require: any) {
  const React = require('react'), h = React.createElement;
  const { TOKENS, PAGE_CSS } = createTheme();
  return {
    inject: ['slots', 'locale'],
    apply(ctx: any) {
      registerAgentPicker(ctx, h);
      registerInfiniteCanvas(ctx, React);
      ctx.effect(() => ctx.locale.register(NS, createPlatformDictionaries()), 'forge: platform dictionaries');
      const t = ctx.locale.bind(NS);
      const { PanelIcon, ForgePanel } = createSidebarPanel({ React, h, TOKENS, PAGE_CSS, t, PANEL_ID, GUIDE_URL, LOGO_SVG: iconMark });
      ctx.effect(() => ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
        name: 'sidebar.panellist', id: PANEL_ID, order: 30, locale: NS,
        label: () => t('panelSidebarLabel'),
      }, PanelIcon)), 'forge: platform entry');
      ctx.effect(() => ctx.slots.inject('main', () => ctx.slots.register({
        name: 'main', key: PANEL_ID, locale: NS,
        inject: () => ({
          openTask: (address: any) => ctx.get('uiWorkspace')?.openSession(address),
          refreshTask: (id: string) => ctx.get('sessions')?.refreshProjections(id),
          startSession: () => ctx.get('uiWorkspace')?.startSession(undefined, { agentPreset: 'metaontic-agent-forge-studio' }),
          openSettings: () => ctx.get('pluginNavigation')?.openBundle(NAMESPACE),
          openCanvas: () => ctx.get('sidebarRight')?.openTab(FORGE_CANVAS_KIND),
        }),
      }, ForgePanel)), 'forge: platform dashboard');
    },
  };
}
