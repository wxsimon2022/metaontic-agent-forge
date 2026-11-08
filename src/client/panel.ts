/** 浏览器端左侧栏面板：由入口注入宿主 React 与共享依赖。 */
export function createSidebarPanel({ React, h, TOKENS, PAGE_CSS, t, PANEL_ID, GUIDE_URL, LOGO_SVG }: any) {
    // 插件图标（icon.svg）由打包器当文本内联进来，转成 data URI 后用 <img> 渲染：
    // 不依赖宿主能否按路径取到插件资源，也不会和页面里其他 svg 的渐变 id 撞名。
    const LOGO_SRC = LOGO_SVG ? `data:image/svg+xml,${encodeURIComponent(LOGO_SVG)}` : '';

    /**
     * 面板自己的静态样式。设置页的 PAGE_CSS 提供分组卡片与按钮外观，
     * 这里只补面板独有的居中留白、品牌头图、按钮与流程演示——
     * 左侧栏切过来的整块区域没有宿主容器，全宽内容要自己收边。
     */
    const PANEL_CSS = `
      .metaontic-agent-forge-panel { width: 100%; max-width: 880px; margin: 0 auto; padding: 30px 32px 44px; display: flex; flex-direction: column; gap: 18px; }
      /* 品牌头图：插件 logo + 标题/简介，给空荡的内容区一个视觉锚点 */
      .metaontic-agent-forge-panel-hero { display: flex; align-items: center; gap: 14px; }
      .metaontic-agent-forge-panel-mark { flex: 0 0 auto; display: inline-flex; align-items: center; justify-content: center; width: 44px; height: 44px; color: ${TOKENS.primaryFill}; }
      .metaontic-agent-forge-panel-logo { width: 100%; height: 100%; object-fit: contain; }
      /* 左侧栏那一行的 logo：按宿主给的尺寸原样铺开，不参与主题取色 */
      .metaontic-agent-forge-rail-logo { display: block; object-fit: contain; }
      .metaontic-agent-forge-panel-head { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
      .metaontic-agent-forge-panel-title { margin: 0; font-size: 19px; font-weight: 600; color: ${TOKENS.text}; }
      .metaontic-agent-forge-panel-intro { margin: 0; font-size: 13px; line-height: 1.55; color: ${TOKENS.muted}; }
      /* 主按钮吃掉多余宽度，次要按钮与链接退到第二排 */
      .metaontic-agent-forge-panel-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; }
      .metaontic-agent-forge-panel-actions .metaontic-agent-forge-btn-primary { flex: 1 1 220px; width: auto; min-width: 160px; height: 38px; }
      .metaontic-agent-forge-panel-actions .metaontic-agent-forge-btn:not(.metaontic-agent-forge-btn-primary) { min-width: 132px; }
      .metaontic-agent-forge-panel-link { margin-left: auto; font-size: 12px; color: ${TOKENS.primaryFill}; text-decoration: none; border-bottom: 1px solid transparent; }
      .metaontic-agent-forge-panel-link:hover { border-bottom-color: currentColor; }
      /* 两块价值点卡片：图标 + 标题 + 一句说明，窄容器自动落成一列 */
      .metaontic-agent-forge-panel-highlights { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 260px), 1fr)); gap: 12px; }
      .metaontic-agent-forge-panel-highlight { display: flex; align-items: flex-start; gap: 12px; padding: 13px 14px; border: 1px solid ${TOKENS.border}; border-radius: 12px; background: ${TOKENS.cardFill}; }
      .metaontic-agent-forge-panel-highlight-icon { flex: 0 0 auto; display: inline-flex; align-items: center; justify-content: center; width: 34px; height: 34px; border-radius: 10px; color: ${TOKENS.primaryFill}; background: ${TOKENS.controlFill}; }
      .metaontic-agent-forge-panel-highlight-body { min-width: 0; }
      .metaontic-agent-forge-panel-highlight-title { font-size: 13px; font-weight: 600; color: ${TOKENS.text}; }
      .metaontic-agent-forge-panel-highlight-desc { margin: 4px 0 0; font-size: 12px; line-height: 1.55; color: ${TOKENS.muted}; }
      /* 流程演示：四步卡片横排，卡片之间用箭头连起来；窄容器落成一列 */
      .metaontic-agent-forge-panel-flow { display: flex; align-items: stretch; }
      .metaontic-agent-forge-panel-step { position: relative; overflow: hidden; flex: 1 1 0; min-width: 0; display: flex; flex-direction: column; gap: 7px; padding: 13px 14px 14px; border: 1px solid ${TOKENS.border}; border-radius: 12px; background: ${TOKENS.cardFill}; animation: metaontic-agent-forge-flow-card 9s ease-in-out infinite; }
      .metaontic-agent-forge-panel-step-head { display: flex; align-items: center; gap: 8px; }
      .metaontic-agent-forge-panel-step-badge { flex: 0 0 auto; display: inline-flex; align-items: center; justify-content: center; width: 22px; height: 22px; border-radius: 50%; font-size: 11px; font-weight: 600; color: ${TOKENS.primaryFill}; background: ${TOKENS.controlFill}; animation: metaontic-agent-forge-flow-badge 9s ease-in-out infinite; }
      .metaontic-agent-forge-panel-step-title { min-width: 0; font-size: 13px; font-weight: 600; color: ${TOKENS.text}; }
      .metaontic-agent-forge-panel-step-desc { margin: 0; font-size: 12px; line-height: 1.55; color: ${TOKENS.muted}; }
      /* 右上角的淡色水印图标，只做装饰 */
      .metaontic-agent-forge-panel-step-icon { position: absolute; top: 10px; right: 10px; color: ${TOKENS.primaryFill}; opacity: .14; pointer-events: none; }
      /* 卡片之间的箭头：横排时向右，窄容器里转成向下 */
      .metaontic-agent-forge-panel-conn { flex: 0 0 26px; align-self: center; height: 2px; border-radius: 1px; background: ${TOKENS.border}; position: relative; }
      .metaontic-agent-forge-panel-conn::after { content: ''; position: absolute; top: 50%; right: -1px; width: 5px; height: 5px; border-top: 2px solid ${TOKENS.border}; border-right: 2px solid ${TOKENS.border}; transform: translateY(-50%) rotate(45deg); }
      /* 四步依次点亮，形成一条走动的流程；延迟按步号错开 */
      @keyframes metaontic-agent-forge-flow-card { 0%, 16% { border-color: ${TOKENS.primaryFill}; } 28%, 100% { border-color: ${TOKENS.border}; } }
      @keyframes metaontic-agent-forge-flow-badge { 0%, 16% { color: #fff; background: ${TOKENS.primaryFill}; } 28%, 100% { color: ${TOKENS.primaryFill}; background: ${TOKENS.controlFill}; } }
      .metaontic-agent-forge-panel-step[data-step="1"], .metaontic-agent-forge-panel-step[data-step="1"] .metaontic-agent-forge-panel-step-badge { animation-delay: 2.25s; }
      .metaontic-agent-forge-panel-step[data-step="2"], .metaontic-agent-forge-panel-step[data-step="2"] .metaontic-agent-forge-panel-step-badge { animation-delay: 4.5s; }
      .metaontic-agent-forge-panel-step[data-step="3"], .metaontic-agent-forge-panel-step[data-step="3"] .metaontic-agent-forge-panel-step-badge { animation-delay: 6.75s; }
      .metaontic-agent-forge-panel { container-type: inline-size; }
      @container (max-width: 620px) {
        .metaontic-agent-forge-panel-flow { flex-direction: column; align-items: stretch; }
        /* 竖向排布时不能再按剩余空间拉伸，否则卡片会被压扁 */
        .metaontic-agent-forge-panel-step { flex: 0 0 auto; }
        .metaontic-agent-forge-panel-conn { flex: 0 0 18px; width: 2px; height: 18px; align-self: flex-start; margin-left: 24px; }
        .metaontic-agent-forge-panel-conn::after { top: auto; right: 50%; bottom: -1px; transform: translateX(50%) rotate(135deg); }
      }
      @container (max-width: 560px) {
        .metaontic-agent-forge-panel { padding: 22px 18px 34px; }
        .metaontic-agent-forge-panel-link { margin-left: 0; }
      }
      @media (prefers-reduced-motion: reduce) {
        .metaontic-agent-forge-panel-step, .metaontic-agent-forge-panel-step-badge { animation: none; }
      }
    `;

    /**
     * 左侧栏那一行的图标：尺寸由宿主给（size 收起 18 / 展开 16，active 是当前面板）。
     * 有插件 logo 就画 logo；注入不到时退回线稿图标（跟随 currentColor，不挑主题）。
     */
    function PanelIcon({ size = 18 }: any) {
      const pixels = Number(size) || 18;
      if (LOGO_SRC) {
        return h('img', {
          className: 'metaontic-agent-forge-rail-logo', src: LOGO_SRC, alt: '', width: pixels, height: pixels, 'aria-hidden': true,
        });
      }
      return h('svg', {
        width: pixels, height: pixels, viewBox: '0 0 24 24', fill: 'none',
        stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round',
        'aria-hidden': true,
      }, [
        h('rect', { key: 'frame', x: 2.5, y: 4.5, width: 13.5, height: 15, rx: 2.5 }),
        h('path', { key: 'lens', d: 'M16 10.4 21.5 7.3v9.4L16 13.6z' }),
      ]);
    }

    /** 流程示意用的线稿图标：只画轮廓，颜色由 CSS 给（水印、徽标都能复用）。 */
    function flowIcon(name, size = 22) {
      const common = {
        width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
        strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true,
      };
      if (name === 'idea') {
        return h('svg', common, [
          h('path', { key: 'bulb', d: 'M12 3.5a5.5 5.5 0 0 0-3.2 9.9V16h6.4v-2.6A5.5 5.5 0 0 0 12 3.5Z' }),
          h('path', { key: 'base', d: 'M9.5 18.5h5M10.5 21h3' }),
        ]);
      }
      if (name === 'script') {
        return h('svg', common, [
          h('rect', { key: 'frame', x: 3, y: 4.5, width: 18, height: 15, rx: 2.2 }),
          h('path', { key: 'split', d: 'M3 12h18M11 12v7.5' }),
        ]);
      }
      if (name === 'generate') {
        return h('svg', common, [
          h('rect', { key: 'frame', x: 3, y: 5, width: 18, height: 14, rx: 2.2 }),
          h('path', { key: 'play', d: 'M10.4 9.4 15 12l-4.6 2.6z' }),
        ]);
      }
      if (name === 'easy') {
        return h('svg', common, [
          h('path', { key: 'star', d: 'M12 4.2l1.9 5.1 5.1 1.9-5.1 1.9L12 18.2l-1.9-5.1L5 11.2l5.1-1.9z' }),
          h('path', { key: 'spark', d: 'M19 4.2v3M17.5 5.7h3' }),
        ]);
      }
      if (name === 'cheap') {
        return h('svg', common, [
          h('path', { key: 'tag', d: 'M11.2 3.8H5.4A1.6 1.6 0 0 0 3.8 5.4v5.8l8.8 8.8a1.6 1.6 0 0 0 2.3 0l5.8-5.8a1.6 1.6 0 0 0 0-2.3z' }),
          h('circle', { key: 'hole', cx: 7.6, cy: 7.6, r: 1.2 }),
        ]);
      }
      return h('svg', common, [
        h('path', { key: 'down', d: 'M12 3.5v10m0 0 3.6-3.6M12 13.5 8.4 9.9' }),
        h('path', { key: 'tray', d: 'M4.5 16.5v2.2a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-2.2' }),
      ]);
    }

    /** 一块价值点卡片：图标 + 标题 + 一句说明。 */
    function highlight(key, icon, title, desc) {
      return h('div', { key, className: 'metaontic-agent-forge-panel-highlight' }, [
        h('span', { key: 'icon', className: 'metaontic-agent-forge-panel-highlight-icon' }, flowIcon(icon, 20)),
        h('div', { key: 'body', className: 'metaontic-agent-forge-panel-highlight-body' }, [
          h('div', { key: 'title', className: 'metaontic-agent-forge-panel-highlight-title' }, title),
          h('p', { key: 'desc', className: 'metaontic-agent-forge-panel-highlight-desc' }, desc),
        ]),
      ]);
    }

    /**
     * 面板本体：插件 logo + 两块价值点 + 开始创作入口 + 四步流程演示。
     * 这里只做引导，不显示也不修改配置——配置统一在插件设置页看和改。
     */
    function ForgePanel(props: any) {
      const flow = [
        { icon: 'idea', title: t('panelStep1Title'), desc: t('panelStep1Desc') },
        { icon: 'script', title: t('panelStep2Title'), desc: t('panelStep2Desc') },
        { icon: 'generate', title: t('panelStep3Title'), desc: t('panelStep3Desc') },
        { icon: 'merge', title: t('panelStep4Title'), desc: t('panelStep4Desc') },
      ];
      // 步骤与箭头交替排布：第 2 步起前面各插一个箭头。
      const flowChildren = flow.flatMap((step, index) => {
        const card = h('div', {
          key: `step-${index}`, className: 'metaontic-agent-forge-panel-step', 'data-step': String(index),
        }, [
          h('div', { key: 'head', className: 'metaontic-agent-forge-panel-step-head' }, [
            h('span', { key: 'badge', className: 'metaontic-agent-forge-panel-step-badge' }, String(index + 1)),
            h('span', { key: 'title', className: 'metaontic-agent-forge-panel-step-title' }, step.title),
          ]),
          h('p', { key: 'desc', className: 'metaontic-agent-forge-panel-step-desc' }, step.desc),
          h('span', { key: 'icon', className: 'metaontic-agent-forge-panel-step-icon' }, flowIcon(step.icon)),
        ]);
        return index === 0 ? [card] : [h('span', { key: `conn-${index}`, className: 'metaontic-agent-forge-panel-conn', 'aria-hidden': true }), card];
      });
      return h('div', { className: 'metaontic-agent-forge-panel' }, [
        h('style', { key: 'styles' }, PAGE_CSS + PANEL_CSS),
        h('header', { key: 'hero', className: 'metaontic-agent-forge-panel-hero' }, [
          h('span', { key: 'mark', className: 'metaontic-agent-forge-panel-mark' },
            LOGO_SRC
              ? h('img', { key: 'logo', className: 'metaontic-agent-forge-panel-logo', src: LOGO_SRC, alt: '', 'aria-hidden': true })
              : PanelIcon({ size: 24 })),
          h('div', { key: 'head', className: 'metaontic-agent-forge-panel-head' }, [
            h('h1', { key: 'title', className: 'metaontic-agent-forge-panel-title' }, t('panelTitle')),
            h('p', { key: 'intro', className: 'metaontic-agent-forge-panel-intro' }, t('panelIntro')),
          ]),
        ]),
        h('section', { key: 'highlights', className: 'metaontic-agent-forge-section' }, [
          h('div', { key: 'highlights-label', className: 'metaontic-agent-forge-section-title' }, t('panelHighlights')),
          h('div', { key: 'highlights-cards', className: 'metaontic-agent-forge-panel-highlights' }, [
            highlight('easy', 'easy', t('panelHighlight1Title'), t('panelHighlight1Desc')),
            highlight('cheap', 'cheap', t('panelHighlight2Title'), t('panelHighlight2Desc')),
          ]),
        ]),
        h('section', { key: 'start', className: 'metaontic-agent-forge-section' }, [
          h('div', { key: 'start-label', className: 'metaontic-agent-forge-section-title' }, t('panelStart')),
          h('div', { key: 'start-actions', className: 'metaontic-agent-forge-panel-actions' }, [
            h('button', {
              key: 'new', type: 'button', className: 'metaontic-agent-forge-btn metaontic-agent-forge-btn-primary',
              onClick: () => props?.startSession?.(),
            }, t('panelNew')),
            h('button', {
              key: 'settings', type: 'button', className: 'metaontic-agent-forge-btn', disabled: typeof props?.openSettings !== 'function',
              onClick: () => props?.openSettings?.(),
            }, t('panelSettings')),
            h('a', {
              key: 'guide', className: 'metaontic-agent-forge-panel-link', href: GUIDE_URL, target: '_blank', rel: 'noopener noreferrer',
            }, t('panelGuide')),
          ]),
        ]),
        h('section', { key: 'flow', className: 'metaontic-agent-forge-section' }, [
          h('div', { key: 'flow-label', className: 'metaontic-agent-forge-section-title' }, t('panelFlow')),
          h('div', { key: 'flow-steps', className: 'metaontic-agent-forge-panel-flow' }, flowChildren),
        ]),
      ]);
    }

    return { PANEL_ID, PanelIcon, ForgePanel };
}
