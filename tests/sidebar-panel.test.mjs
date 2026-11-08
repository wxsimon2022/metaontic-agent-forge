import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { sourceOf } from './source.mjs';

const TOKENS = { text: 'text', muted: 'muted', border: 'border', cardFill: 'card', controlFill: 'control', primaryFill: 'primary', error: 'error', success: 'success' };
const GUIDE_URL = 'https://video.mybfs.cn';

/** 面板与字典都在 TS 里，按仓库既有做法在隔离上下文里跑纯函数，再用桩 h 收集渲染树。 */
function harness({ locale = 'zh', props = {}, logo = '<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="40"/></svg>' } = {}) {
  const context = vm.createContext({});
  vm.runInContext(sourceOf('client/panel', 'client/locale'), context);
  const dictionaries = context.createPlatformDictionaries();
  const t = (key, args = {}) => String(dictionaries[locale][key] ?? key)
    .replace(/\{(\w+)\}/g, (_, name) => args[name] ?? `{${name}}`);
  const calls = [];
  const panel = context.createSidebarPanel({
    React: { createElement: () => {} },
    h: (type, elementProps, children) => ({ type, props: elementProps || {}, children: Array.isArray(children) ? children : children === undefined ? [] : [children] }),
    TOKENS, PAGE_CSS: '.metaontic-agent-forge-btn{}', t,
    PANEL_ID: 'metaontic-agent-forge', GUIDE_URL, LOGO_SVG: logo,
  });
  const tree = panel.ForgePanel({
    startSession: () => calls.push({ action: 'startSession' }),
    ...props,
  });
  return { panel, tree, calls, t, dictionaries };
}

function walk(node, visit) {
  if (!node || typeof node !== 'object') return;
  visit(node);
  for (const child of node.children || []) walk(child, visit);
}
function texts(tree) {
  const out = [];
  walk(tree, (node) => { for (const child of node.children || []) if (typeof child === 'string') out.push(child); });
  return out;
}
function find(tree, match) {
  let hit = null;
  walk(tree, (node) => { if (!hit && match(node)) hit = node; });
  return hit;
}

test('面板给出新会话入口，并显示插件 logo', () => {
  const { tree, calls, panel } = harness({});
  const labels = texts(tree);
  for (const expected of ['云智工坊 · 智能体平台', '开始协作', '打开云智工坊', '打开插件设置', '使用说明']) {
    assert.ok(labels.includes(expected), expected);
  }
  const button = find(tree, (node) => node.type === 'button' && node.children.includes('打开云智工坊'));
  assert.equal(button.props.className, 'metaontic-agent-forge-btn metaontic-agent-forge-btn-primary');
  button.props.onClick();
  assert.deepEqual(calls, [{ action: 'startSession' }]);
  assert.equal(typeof panel.PanelIcon, 'function');
  const logo = find(tree, (node) => node.type === 'img');
  assert.ok(logo, '品牌位应渲染插件 logo');
  assert.match(logo.props.src, /^data:image\/svg\+xml,/);
  assert.equal(logo.props.alt, '');
});

test('面板说明平台统筹与业务扩展', () => {
  const { tree, t } = harness({});
  const cards = [];
  walk(tree, (node) => { if (node.props?.className === 'metaontic-agent-forge-panel-highlight') cards.push(node); });
  assert.equal(cards.length, 2, '应有两条价值点');
  const titles = [];
  walk(tree, (node) => { if (node.props?.className === 'metaontic-agent-forge-panel-highlight-title') titles.push(node.children[0]); });
  assert.deepEqual(titles, [t('panelHighlight1Title'), t('panelHighlight2Title')]);
  assert.ok(texts(tree).includes(t('panelHighlights')), '价值点要有分组标题');
  const descs = [];
  walk(tree, (node) => { if (node.props?.className === 'metaontic-agent-forge-panel-highlight-desc') descs.push(node.children[0]); });
  assert.match(descs[0], /白名单|总控/, '第一条讲总控协作');
  assert.match(descs[1], /续拍|合并/, '第二条讲长视频方案');
  for (const node of cards) {
    const icons = [];
    walk(node, (child) => { if (child.type === 'svg') icons.push(child); });
    assert.equal(icons.length, 1, '每条价值点带一个图标');
  }
});

test('面板用四步流程演示使用过程', () => {
  const { tree, t } = harness({});
  const steps = [];
  walk(tree, (node) => { if (node.props?.className === 'metaontic-agent-forge-panel-step') steps.push(node); });
  assert.equal(steps.length, 4, '应为四步');
  assert.deepEqual(steps.map((node) => node.props['data-step']), ['0', '1', '2', '3'], '步号按顺序错开动画延迟');
  const titles = [];
  walk(tree, (node) => { if (node.props?.className === 'metaontic-agent-forge-panel-step-title') titles.push(node.children[0]); });
  assert.deepEqual(titles, [t('panelStep1Title'), t('panelStep2Title'), t('panelStep3Title'), t('panelStep4Title')]);
  for (const node of steps) assert.ok(texts(node).some((text) => text.length > 8), '每步都要有说明');
  const conns = [];
  walk(tree, (node) => { if (node.props?.className === 'metaontic-agent-forge-panel-conn') conns.push(node); });
  assert.equal(conns.length, 3, '四步之间三个箭头');
  const css = find(tree, (node) => node.type === 'style').children.join('');
  assert.match(css, /@keyframes metaontic-agent-forge-flow-card/, '流程要有点亮动效');
  assert.match(css, /prefers-reduced-motion/, '要尊重系统的减弱动效设置');
});

test('面板不再展示当前配置，配置只在设置页看', () => {
  const { tree, t } = harness({});
  const labels = texts(tree);
  assert.ok(!labels.includes('当前配置'), '配置卡片已移除');
  assert.ok(!labels.includes(t('service')), '不应再显示接入方式取值');
  assert.ok(!labels.includes('doubao-seedream-5-0-pro-260628'), '不应再显示图片模型');
});

test('注入不到 logo 时退回线稿图标', () => {
  const { tree } = harness({ logo: '' });
  const img = find(tree, (node) => node.type === 'img');
  assert.equal(img, null, '没有 logo 文本时不该渲染 img');
  const svg = find(tree, (node) => node.type === 'svg');
  assert.ok(svg, '应退回线稿图标');
  assert.equal(svg.props['aria-hidden'], true);
});

test('插件设置按钮在没有宿主导航服务时禁用，有服务时可点击', () => {
  const disabled = find(harness({}).tree, (node) => node.type === 'button' && node.children.includes('打开插件设置'));
  assert.equal(disabled.props.disabled, true);
  const calls = [];
  const enabled = find(harness({ props: { openSettings: () => calls.push('settings') } }).tree, (node) => node.type === 'button' && node.children.includes('打开插件设置'));
  assert.equal(enabled.props.disabled, false);
  enabled.props.onClick();
  assert.deepEqual(calls, ['settings']);
});

test('使用说明指向服务端站点，图标跟随宿主给的尺寸', () => {
  const { tree, panel } = harness({});
  const link = find(tree, (node) => node.type === 'a');
  assert.equal(link.props.href, GUIDE_URL);
  assert.equal(link.props.rel, 'noopener noreferrer');
  const collapsed = panel.PanelIcon({ size: 18, active: true });
  const expanded = panel.PanelIcon({ size: 16 });
  assert.equal(collapsed.props.width, 18);
  assert.equal(expanded.props.width, 16);
  assert.equal(collapsed.props['aria-hidden'], true);
});

test('左侧栏图标用插件 logo，取不到 logo 时退回线稿图标', () => {
  const withLogo = harness({}).panel.PanelIcon({ size: 16, active: true });
  assert.equal(withLogo.type, 'img');
  assert.match(withLogo.props.src, /^data:image\/svg\+xml,/);
  assert.equal(withLogo.props.width, 16);

  const withoutLogo = harness({ logo: '' }).panel.PanelIcon({ size: 18 });
  assert.equal(withoutLogo.type, 'svg');
  assert.equal(withoutLogo.props.width, 18);
});

test('英文界面下面板文案全部走字典', () => {
  const { tree, dictionaries } = harness({ locale: 'en' });
  const labels = texts(tree);
  assert.ok(labels.includes(dictionaries.en.panelTitle));
  assert.ok(labels.includes(dictionaries.en.panelNew));
  assert.equal(dictionaries.zh.panelNew, '打开云智工坊');
  // 左侧栏那一行的名字比面板标题更完整，两个字典都要有。
  assert.equal(dictionaries.zh.panelSidebarLabel, '云智工坊');
  assert.equal(dictionaries.en.panelSidebarLabel, 'Agent Forge');
});

test('面板文案不再出现裸露的 Key 字样，样式随组件注入', () => {
  const { tree, dictionaries } = harness({});
  for (const locale of ['zh', 'en']) {
    for (const [key, text] of Object.entries(dictionaries[locale])) {
      if (!key.startsWith('panel')) continue;
      assert.doesNotMatch(text, /(?<![A-Za-z])Key(?![A-Za-z])/, key);
    }
  }
  const style = find(tree, (node) => node.type === 'style');
  assert.match(style.children.join(''), /\.metaontic-agent-forge-panel \{/);
});

test('入口用同一个 id 注册左侧栏图标与 main 面板', () => {
  const source = readFileSync(new URL('../src/client/platform.ts', import.meta.url), 'utf8');
  assert.match(source, /const PANEL_ID = 'metaontic-agent-forge';/);
  assert.match(source, /name: 'sidebar\.panellist',\s*id: PANEL_ID/);
  assert.match(source, /label: \(\) => t\('panelSidebarLabel'\)/);
  assert.match(source, /name: 'main',\s*key: PANEL_ID/);
  assert.match(source, /agentPreset: 'metaontic-agent-forge-studio'/);
  assert.match(source, /openBundle\(NAMESPACE\)/);
});
