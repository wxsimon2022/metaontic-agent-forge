import { VOLCENGINE_MODE_AVAILABLE } from '../connection-defaults.js';
// 下架某个接入方式时，把它填进这里：设置页用一个隐藏项显示已有取值，列表里选不到它，
// 也不会把它显示成别的渠道。在售时为空气（候选见 SELECTS.connectionMode）。
const HIDDEN_CONNECTION_MODES = [
    ...(VOLCENGINE_MODE_AVAILABLE ? [] : ['volcengine']),
];
// 隐藏项显示什么：下架的方式带上「暂不提供」的说明，其余照原样显示当前取值。
function hiddenConnectionLabel(t, mode) {
    if (mode === 'volcengine')
        return t(VOLCENGINE_MODE_AVAILABLE ? 'volcengine' : 'volcengineUnavailable');
    return t(mode);
}
/** 独立的设置交互控制器，视图和测试复用同一入口。 */
export function createSettingsActions(context: any) {
    async function save() {
        const { saveInFlight, connectionBusy, setSaveError, setStatus, form, draft, same, validateSettings, persistConnection, setDraft, flashStatus, settingsError } = context;
        if (saveInFlight.current)
            return;
        if (connectionBusy.current && !connectionBusy.pending)
            return;
        saveInFlight.current = true;
        setSaveError('');
        setStatus('saving');
        try {
            if (connectionBusy.pending)
                await connectionBusy.pending.catch(() => { });
            connectionBusy.current = true;
            const latest = form.getSnapshot().value || {};
            const nextMode = draft.connectionMode ?? latest.connectionMode ?? 'metaontic';
            const changes = Object.entries(draft).filter(([key, next]) => !same(latest[key], next));
            validateSettings({ ...latest, ...draft });
            await persistConnection(form, changes, nextMode);
            setDraft((current) => Object.fromEntries(Object.entries(current).filter(([key, next]) => !Object.prototype.hasOwnProperty.call(draft, key) || !same(draft[key], next))));
            flashStatus('saved');
        }
        catch (error) {
            setSaveError(settingsError(error));
            setStatus('failed');
        }
        finally {
            connectionBusy.current = false;
            saveInFlight.current = false;
        }
    }
    /** 清除插件配置并恢复默认值，已生成文件保留。 */
    async function reset() {
        const { connectionBusy, t, setSaveError, setStatus, snapshot, PLUGIN_OWNED_KEYS, persistBatch, form, setDraft, setVisibleKey, flashStatus, settingsError } = context;
        if (connectionBusy.current)
            return;
        if (!context.confirm(t('resetConfirm')))
            return;
        connectionBusy.current = true;
        setSaveError('');
        setStatus('saving');
        try {
            const targets = new Set([...Object.keys(snapshot.user || {}), ...PLUGIN_OWNED_KEYS]);
            await persistBatch(form, [...targets].map((key) => ({ op: 'unset', path: [key] })));
            setDraft({});
            setVisibleKey('');
            flashStatus('reset');
        }
        catch (error) {
            setSaveError(t('resetFailed', { message: settingsError(error) }));
            setStatus('failed');
        }
        finally {
            connectionBusy.current = false;
        }
    }
    function control(field) {
        const { draft, value, h, SELECTS, inputStyle, t, snapshot, visibleKey, setVisibleKey, edit, optionLabel } = context;
        const current = draft[field.key] !== undefined ? draft[field.key] : value[field.key] ?? (['imageUseVideoKey', 'usageStatsEnabled'].includes(field.key) ? true : field.key === 'pollIntervalMs' ? 5000 : field.key === 'maxWaitMs' ? 600000 : undefined);
        const secondsField = field.key === 'pollIntervalMs' || field.key === 'maxWaitMs';
        const displayed = secondsField && current !== undefined && current !== '' ? Number(current) / 1000 : current;
        const id = `metaontic-video-${field.key}`;
        if (field.kind === 'switch') {
            return h('label', { key: 'control', htmlFor: id, className: 'mov-switch' }, h('input', {
                id,
                'data-field': field.key,
                type: 'checkbox',
                checked: Boolean(current),
                onChange: (event) => edit(field.key, event.target.checked),
            }), h('span', null, t(field.key)));
        }
        if (field.kind === 'select') {
            const options = SELECTS[field.key] || [];
            // 当前值不在候选表里（例如服务端刚换的型号）就把它补进去，避免下拉里看不到自己现在的取值
            const hiddenModel = field.key === 'model' && /seedance-2(?:-5|\.5)/i.test(String(current || ''));
            const hiddenMode = field.key === 'connectionMode' && HIDDEN_CONNECTION_MODES.includes(String(current || ''));
            const legacyMerge = field.key === 'mergeMode' && current === 'seamless';
            // 图片模型的旧型号已下线：存量配置按实际生效的在售型号显示，用户不用自己改；
            // 归一只发生在读取时，用户不动这项就不会写回配置。
            const retiredImageModel = field.key === 'imageModel' && !options.includes(String(current || ''));
            const removedMode = field.key === 'connectionMode' && !['metaontic', 'volcengine'].includes(String(current || ''));
            const list = !removedMode && current && !options.includes(current) && !hiddenModel && !hiddenMode && !legacyMerge && !retiredImageModel ? [...options, current] : options;
            return h('select', {
                key: 'control',
                id,
                'data-field': field.key,
                className: `mov-input${field.mono ? ' mov-mono' : ''}`,
                style: inputStyle,
                value: removedMode ? '' : legacyMerge ? 'copy' : retiredImageModel ? options[0] ?? '' : current ?? '',
                onChange: (event) => edit(field.key, event.target.value),
            }, [
                removedMode ? h('option', { key: 'select-connection', value: '', disabled: true }, t('unknownConnection')) : null,
                hiddenModel ? h('option', { key: 'hidden-current', value: current, hidden: true }, t('modelHiddenCurrent')) : null,
                // 下架期间直接标出不可用；恢复后这一支不会走到（该方式会回到候选里）。
                hiddenMode ? h('option', { key: 'hidden-current', value: current, hidden: true }, hiddenConnectionLabel(t, String(current || ''))) : null,
                ...list.map((option) => h('option', { key: option, value: option }, optionLabel(t, field.key, option))),
            ]);
        }
        const canReveal = field.key === 'metaonticApiKey' || field.key === 'volcengineApiKey' || field.key === 'imageApiKey';
        const revealed = canReveal && visibleKey === field.key;
        const input = h('input', {
            // 这个 input 会和右侧眼睛按钮一起放进数组，React 要求数组子节点带 key
            key: 'input',
            id,
            'data-field': field.key,
            className: `mov-input${field.mono ? ' mov-mono' : ''}`,
            style: inputStyle,
            type: field.kind === 'number' ? 'number' : (field.secret && !revealed ? 'password' : 'text'),
            value: displayed ?? '',
            min: secondsField ? 1 : undefined,
            step: secondsField ? 0.001 : undefined,
            placeholder: field.secret && (snapshot.secrets?.[field.key] || value[field.key]) ? t('apiKeyConfigured') : '',
            onChange: (event) => edit(field.key, field.kind === 'number' && event.target.value !== ''
                ? (secondsField ? Math.round(Number(event.target.value) * 1000) : Number(event.target.value))
                : event.target.value),
        });
        if (!canReveal)
            return input;
        return h('div', { key: 'control', className: 'mov-key-control' }, [
            input,
            h('button', {
                key: 'toggle',
                type: 'button', className: 'mov-key-eye',
                'aria-label': t(revealed ? 'hideKey' : 'showKey'),
                title: t(revealed ? 'hideKey' : 'showKey'),
                'data-action': `toggle-${field.key}`,
                'aria-controls': id, 'aria-pressed': revealed,
                onClick: () => setVisibleKey(revealed ? '' : field.key),
            }, h('svg', { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true }, [
                h('path', { key: 'eye', d: 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z' }),
                h('circle', { key: 'pupil', cx: 12, cy: 12, r: 3 }),
                revealed ? h('path', { key: 'slash', d: 'M3 3l18 18' }) : null,
            ])),
        ]);
    }
    return { save, reset, control };
}
