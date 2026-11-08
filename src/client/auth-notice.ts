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
  const original = ctx.slots.entriesOfSlot('conversation.chat.node')
    .filter(entry => entry.options?.key === 'turn-error')
    .sort((a, b) => (b.options.priority || 0) - (a.options.priority || 0))[0];
  if (!original?.component) return;
  const Notice = createAuthNotice({ h, Original: original.component, hostT: ctx.locale.bind(original.locale || 'chat'), t });
  return ctx.slots.register({ name: 'conversation.chat.node', key: 'turn-error', priority: (original.options.priority || 0) + 1, locale: 'chat' }, Notice);
}
