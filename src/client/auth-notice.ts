/** 仅替换宿主AUTH错误的展示；其他错误继续使用宿主原组件，不修改事件或重试行为。 */
export function createAuthNotice({ h, Original, hostT, t }) {
  return function AuthNotice(props) {
    if (props.node?.data?.code !== 'AUTH') return h(Original, { ...props, t: hostT });
    return h('div', { role: 'status', 'data-field': 'auth-notice', style: { display: 'flex', gap: 10, padding: '10px 0', alignItems: 'flex-start' } }, [
      h('span', { key: 'dot', 'aria-hidden': true, style: { flex: '0 0 auto', width: 7, height: 7, marginTop: 6, borderRadius: '50%', background: 'var(--dsw-alias-state-error-primary,#d9534f)' } }),
      h('div', { key: 'copy', style: { minWidth: 0, fontSize: 13, lineHeight: 1.65, color: 'var(--dsw-alias-label-primary,inherit)' } }, [
        h('strong', { key: 'title', style: { fontWeight: 500 } }, t('authNoticeTitle')),
        h('div', { key: 'hint', style: { color: 'var(--dsw-alias-label-secondary,inherit)' } }, t('authNoticeHint')),
        h('a', { key: 'support', href: 'https://work.weixin.qq.com/kfid/kfcd6fc4ca793eeac18', target: '_blank', rel: 'noopener noreferrer', referrerPolicy: 'no-referrer' }, t('supportContact')),
      ]),
    ]);
  };
}
/** 在宿主声明的keyed slot中提供高优先级展示；卸载时由effect自动恢复原组件。 */
export function registerAuthNotice(ctx, h, t) {
  if (typeof ctx.slots.entriesOfSlot !== 'function') return;
  const entries = (typeof ctx.slots.entries === 'function' ? ctx.slots.entries('conversation.chat.node') : ctx.slots.entriesOfSlot('conversation.chat.node'))
    .filter(entry => entry.options?.key === 'turn-error');
  const original = ctx.slots.entriesOfSlot('conversation.chat.node')
    .filter(entry => entry.options?.key === 'turn-error')
    .sort((a, b) => (a.options.priority || 0) - (b.options.priority || 0))[0];
  if (!original?.component) return;
  const Notice = createAuthNotice({ h, Original: original.component, hostT: ctx.locale.bind(original.locale || 'chat'), t });
  // 宿主最低优先值生效；留一个空位兼容旧插件按当前优胜项 +1 注册，保证任意加载顺序均不重名。
  return ctx.slots.register({ name: 'conversation.chat.node', key: 'turn-error', priority: Math.min(...entries.map(entry => entry.options.priority || 0)) - 2, locale: 'chat' }, Notice);
}
