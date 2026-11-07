import { createSettingsActions } from './settings-actions.js';
import { VOLCENGINE_MODE_AVAILABLE } from '../connection-defaults.js';
import { createUpdateActions, renderUpdateNotice, formatReleaseTime } from './updates.js';
/** 浏览器端 settings：由入口注入宿主 React 与共享依赖。 */
import packageInfo from '../../package.json';
/** 设置页工厂：入口注入宿主 React、配置表单及更新服务。 */
export function createSettingsPage(deps: any) {
  const {
    useSnapshot, React, h, TOKENS, same, validateSettings, persistConnection, PLUGIN_OWNED_KEYS,
    persistBatch, PLUGIN_VERSION,
    UPDATE_CACHE_KEY, UPDATE_MAX_AGE_MS, fetchLatestVersion, SELECTS, inputStyle, optionLabel,
    FIELD_BY_KEY, SECTIONS, formatMoney, PLUGIN_PACKAGE, UPDATE_SPEC, UPDATE_ATTEMPTS,
    isNewerVersion, updateBell, PAGE_CSS,
  } = deps;
function makePage({ form, t, manager }) {
      return function ConfigPage(props) {
        const snapshot = useSnapshot(form);
        const value = snapshot.value || {};
        const [draft, setDraft] = React.useState({});
        const selectedMode = draft.connectionMode ?? value.connectionMode ?? 'metaontic';
        const directMode = selectedMode === 'volcengine';
        const [visibleKey, setVisibleKey] = React.useState('');
        const [supportOpen, setSupportOpen] = React.useState(false);
        const supportDialog = React.useRef(null);
        React.useEffect(() => {
          if (supportOpen && supportDialog.current && !supportDialog.current.open) supportDialog.current.showModal();
        }, [supportOpen]);
        React.useEffect(() => { setSupportOpen(false); }, [selectedMode]);
        React.useEffect(() => { setVisibleKey(''); }, [selectedMode]);
        const [status, setStatus] = React.useState('idle');
        const [saveError, setSaveError] = React.useState('');
        // 「已保存」这类反馈过几秒自动收起：收起后操作条跟着消失，页面回到「没有改动」的样子
        const statusTimer = React.useRef(null);
        const connectionBusy = React.useRef(false);
        const saveInFlight = React.useRef(false);
        // ffmpeg 安装引导：默认只展示当前系统那条，可展开看其他系统；复制过的命令给个「已复制」反馈
        const [showAllFfmpeg, setShowAllFfmpeg] = React.useState(false);
        const [copiedFfmpeg, setCopiedFfmpeg] = React.useState('');
        // 版本 / 检查更新：只读 Gitee 默认分支的 package.json，跟本包版本比大小
        const [updateStatus, setUpdateStatus] = React.useState('idle');
        const [updateMessage, setUpdateMessage] = React.useState('');
        const [updateLatest, setUpdateLatest] = React.useState('');
        const updateRequest = React.useRef(0);
        // 更新说明固定使用本机包内内容，不受远端版本和检查缓存影响。
        const releaseNotes = packageInfo.releaseNotes;
        const [updateAt, setUpdateAt] = React.useState('');
        // 一键在线更新：第一下把按钮转成「确认更新」，第二下才真的重装本插件
        const [updateConfirm, setUpdateConfirm] = React.useState(false);
        const [updateDeferred, setUpdateDeferred] = React.useState(() => {
          try { return window.localStorage.getItem(`${UPDATE_CACHE_KEY}.deferred`) || ''; }
          catch { return ''; }
        });

        const { readUpdateCache, rememberUpdateCheck, forgetUpdateCheck, checkForUpdate, runOnlineUpdate, deferUpdate } = createUpdateActions({
          get UPDATE_CACHE_KEY() { return UPDATE_CACHE_KEY; },
          get PLUGIN_VERSION() { return PLUGIN_VERSION; },
          get isNewerVersion() { return isNewerVersion; },
          get updateRequest() { return updateRequest; },
          get UPDATE_MAX_AGE_MS() { return UPDATE_MAX_AGE_MS; },
          get setUpdateStatus() { return setUpdateStatus; },
          get setUpdateMessage() { return setUpdateMessage; },
          get fetchLatestVersion() { return fetchLatestVersion; },
          get setUpdateLatest() { return setUpdateLatest; },
          get setUpdateAt() { return setUpdateAt; },
          get t() { return t; },
          get setUpdateConfirm() { return setUpdateConfirm; },
          get manager() { return manager; },
          get PLUGIN_PACKAGE() { return PLUGIN_PACKAGE; },
          get updateLatest() { return updateLatest; },
          get updateConfirm() { return updateConfirm; },
          get setUpdateDeferred() { return setUpdateDeferred; },
          get UPDATE_SPEC() { return UPDATE_SPEC; },
          get UPDATE_ATTEMPTS() { return UPDATE_ATTEMPTS; },
        });

        // 进入完整设置页先显示缓存，同时后台检查；摘要视图不触发检查。
        const updateTried = React.useRef(false);
        React.useEffect(() => {
          if (props?.view === 'summary') { updateTried.current = false; return; }
          if (updateTried.current) return;
          updateTried.current = true;
          setUpdateLatest(''); setUpdateConfirm(false); setUpdateAt(''); setUpdateStatus('idle'); setUpdateMessage('');
          try { setUpdateDeferred(window.localStorage.getItem(`${UPDATE_CACHE_KEY}.deferred`) || ''); } catch { setUpdateDeferred(''); }
          const cached = readUpdateCache();
          if (cached.latest) {
            setUpdateLatest(cached.latest);
            if (cached.at) setUpdateAt(new Date(cached.at).toLocaleTimeString());
            setUpdateStatus('ok');
          }
          checkForUpdate(true).catch(() => {});
        }, [props?.view]);

        if (props && props.view === 'summary') {
          const configured = Boolean(value.model) || Boolean(snapshot.secrets?.apiKey);
          const text = configured
            ? t('summary', { provider: t(selectedMode), model: value.model || '-' })
            : t('summaryEmpty');
          return h('span', { style: { color: TOKENS.muted } }, text);
        }

        const pending = Object.entries(draft).filter(([key, next]) => !same(value[key], next));
        // 一有新的改动就把上一条「已保存」收起来，免得看着像这次的改动也存过了
        const edit = (key, next) => {
          clearStatusTimer();
          setStatus((current) => (current === 'idle' ? current : 'idle'));
          setDraft((current) => ({ ...current, [key]: next }));
        };
        const clear = (key) => setDraft((current) => {
          const next = { ...current };
          delete next[key];
          return next;
        });

        /** 收起定时器：改动、重新保存前都要清掉，免得旧定时器把新反馈提前收掉。 */
        function clearStatusTimer() {
          if (statusTimer.current) {
            window.clearTimeout(statusTimer.current);
            statusTimer.current = null;
          }
        }

        /** 成功反馈：显示几秒后自动回到 idle（页面就只剩「没有改动」的样子）。 */
        function flashStatus(next, holdMs = 2500) {
          clearStatusTimer();
          setStatus(next);
          statusTimer.current = window.setTimeout(() => {
            statusTimer.current = null;
            setStatus('idle');
          }, holdMs);
        }

        function settingsError(error) {
          const message = error?.message || String(error);
          return ['unknownConnection', 'atomicUnsupported', 'atomicRejected', 'settingsUnavailable', 'settingsConflict', 'settingsTransport', 'readOnly', 'invalidWait', 'invalidSeam'].includes(message) ? t(message) : message;
        }

        const { save, reset, control } = createSettingsActions({
          saveInFlight, connectionBusy, setSaveError, setStatus, form, draft, same,
          validateSettings, persistConnection, persistBatch, setDraft, flashStatus, settingsError,
          t, snapshot, PLUGIN_OWNED_KEYS, setVisibleKey, value, h, SELECTS, inputStyle,
          optionLabel, edit, visibleKey, confirm: message => window.confirm(message),
        });

        // 少数需要解释的字段：模型选哪个（mini 便宜 / fast 贵一些）
        const hints = {
          connectionMode: selectedMode === 'metaontic'
            ? [t('connectionMetaonticHint'), ' ', h('a', { key: 'metaontic-register', href: 'https://ai.bileego.com/sign-up?aff=VzYr', target: '_blank', rel: 'noopener noreferrer', style: { textDecoration: 'underline' } }, t('connectionMetaonticRegister'))]
              : directMode && !VOLCENGINE_MODE_AVAILABLE ? t('connectionVolcengineUnavailable') : t('connectionModeHint'),
          metaonticApiKey: t('metaonticKeyHint'),
          volcengineApiKey: t('volcengineKeyHint'),
          model: t('modelHint'),
          imageModel: t('imageModelHint'),
          seamTrimSeconds: t('seamTrimSecondsHint'),
          maxWaitMs: t('waitSecondsHint'),
        };

        /** 一个可编辑字段：标签 + 控件（开关自带标签，就不重复画）。 */
        function fieldCell(field) {
          const classes = ['mov-field'];
          // 开关没有标签行，靠底对齐才能跟旁边输入框/下拉框的控制线齐平
          if (field.kind === 'switch') classes.push('mov-field-switch');
          if (field.wide) classes.push('mov-field-wide');
          return h('div', { key: field.key, className: classes.join(' ') }, [
            field.kind === 'switch'
              ? null
              : h('label', { key: 'label', className: 'mov-label', htmlFor: `metaontic-video-${field.key}` }, t(['metaonticApiKey', 'volcengineApiKey'].includes(field.key) ? (!directMode && ((draft.imageUseVideoKey ?? value.imageUseVideoKey ?? true) !== false) ? 'sharedModelKey' : 'videoModelKey') : field.key)),
            control(field),
            hints[field.key] ? h('span', { key: 'hint', className: 'mov-hint', style: { marginTop: 4 } }, hints[field.key]) : null,
          ]);
        }

        // 配置区分成几节，每节一个标题 + 一个自适应网格。
        const renderGrid = (section) => {
          if (section.key === 'sectionModels') {
            const shared = (draft.imageUseVideoKey ?? value.imageUseVideoKey ?? true) !== false;
            const common = !directMode
              ? [fieldCell(FIELD_BY_KEY.imageUseVideoKey), ...(shared ? [fieldCell(FIELD_BY_KEY.metaonticApiKey)] : [])] : [];
            const videoFields = ['model', ...((directMode || !shared) ? [directMode ? 'volcengineApiKey' : 'metaonticApiKey'] : [])];
            const imageFields = ['imageModel', ...(!shared ? ['imageApiKey'] : [])];
            return h('div', { key: section.key, className: 'mov-model-settings' }, [
              ...common,
              h('div', { key: 'models', className: `mov-model-grid${directMode ? ' mov-model-grid-single' : ''}` }, [
                h('div', { key: 'video', className: 'mov-model-card', 'data-group': 'video-model' }, videoFields.map(key => fieldCell(FIELD_BY_KEY[key]))),
                !directMode ? h('div', { key: 'image', className: 'mov-model-card', 'data-group': 'image-model' }, imageFields.map(key => fieldCell(FIELD_BY_KEY[key]))) : null,
              ]),
            ]);
          }
          if (section.key === 'sectionVideo') {
            return h('div', { key: section.key, className: 'mov-av-grid' }, [
              h('div', { key: 'picture', className: 'mov-av-card' }, [
                fieldCell(FIELD_BY_KEY.ratio),
                h('span', { key: 'hint', className: 'mov-hint' }, t('ratioLayoutHint')),
              ]),
              h('div', { key: 'audio', className: 'mov-av-card mov-av-audio' }, [
                h('span', { key: 'label', className: 'mov-label' }, t('audioSettings')),
                control(FIELD_BY_KEY.generateAudio),
                h('span', { key: 'hint', className: 'mov-hint' }, t('audioLayoutHint')),
              ]),
            ]);
          }
          const shared = (draft.imageUseVideoKey ?? value.imageUseVideoKey ?? true) !== false;
          const videoKey = directMode ? 'volcengineApiKey' : 'metaonticApiKey';
          const fields = section.key === 'sectionModels'
            ? directMode ? ['model', videoKey]
              : shared ? ['imageUseVideoKey', videoKey, 'model', 'imageModel']
                : ['imageUseVideoKey', 'model', videoKey, 'imageModel', 'imageApiKey']
            : section.fields;
          return h('div', { key: section.key, className: 'mov-grid' },
          fields.filter((key) => (key !== 'volcengineApiKey' || directMode)
            && (!['imageModel', 'imageUseVideoKey', 'imageApiKey'].includes(key) || !directMode)
            && (key !== 'imageApiKey' || (draft.imageUseVideoKey ?? value.imageUseVideoKey ?? true) === false)
            && (key !== 'metaonticApiKey' || selectedMode === 'metaontic'))
            .map((key) => fieldCell(FIELD_BY_KEY[key])).filter(Boolean));
        };
        const settingsRows = () => [
          h('div', { key: 'generation', className: 'mov-section' }, [
            h('div', { key: 'title', className: 'mov-section-title' }, t('sectionGeneration')),
            ...SECTIONS.map(section =>
              h('div', { key: section.key, className: 'mov-parameter-group' }, [
                h('div', { key: 'heading', className: 'mov-parameter-heading' }, t(section.key)),
                renderGrid(section),
              ])),
          ]),
          h('details', { key: 'advanced', className: 'mov-section mov-advanced' }, [
            h('summary', { key: 'toggle', className: 'mov-advanced-toggle' }, [
              h('span', { key: 'title' }, t('sectionCombined')),
              h('span', { key: 'hint', className: 'mov-hint' }, t('sectionCombinedHint')),
            ]),
            h('div', { key: 'body', className: 'mov-advanced-body' }, [
              ...[
                { key: 'advancedPicture', fields: ['watermark'] },
                { key: 'advancedMerge', fields: ['mergeMode', 'seamTrimSeconds'], hint: 'segmentsRetained' },
                { key: 'advancedWait', fields: ['pollIntervalMs', 'maxWaitMs'] },
                { key: 'advancedTools', fields: ['ffmpegBinary', 'ffprobeBinary'], hint: 'toolsHint' },
              ].map(group => h('div', { key: group.key, className: `mov-advanced-group${group.key === 'advancedTools' ? ' mov-advanced-tools' : ''}`, 'data-group': group.key }, [
                h('div', { key: 'title', className: 'mov-parameter-heading' }, t(group.key)),
                renderGrid(group),
                group.hint ? h('p', { key: 'hint', className: 'mov-hint', style: { margin: 0 } }, t(group.hint)) : null,
              ])),
            ]),
          ]),
        ];

        // 操作条只在「有改动 / 正要给反馈」时出现：没有改动就没有「保存」按钮，
        // 页面干干净净，也不会有空点一下的疑问（「重置插件」不在这儿，它沉在页面最底部）。
        const overrides = Object.keys(snapshot.user || {});
        const footerMessage = status === 'saved'
          ? t('saved')
          : (status === 'reset' ? t('resetDone') : status === 'failed'
            ? (saveError || t('saveFailed'))
            : (pending.length ? t('dirty') : ''));
        const footer = (pending.length || status !== 'idle')
          ? h('div', { key: 'footer', className: 'mov-footer' }, [
            footerMessage
              ? h('span', {
                key: 'status',
                style: {
                  fontSize: 12,
                  color: status === 'failed' ? TOKENS.error : (status === 'saved' || status === 'reset' ? TOKENS.success : TOKENS.muted),
                },
              }, footerMessage)
              : null,
          ])
          : null;

        // 底部操作区：保存位于重置左侧；即使尚无覆盖配置，有草稿时也显示。
        const resetRow = overrides.length || pending.length
          ? h('div', { key: 'reset-row', className: 'mov-footer mov-reset-row' }, [
            h('span', { key: 'hint', className: 'mov-hint', style: { flex: '1 1 200px' } }, t('resetHint')),
            pending.length
              ? h('button', {
                key: 'save',
                'data-action': 'save',
                type: 'button',
                className: 'mov-btn mov-btn-primary',
                disabled: status === 'saving' || snapshot.writable === false,
                onClick: save,
              }, status === 'saving' ? t('saving') : t('save'))
              : null,
            h('button', {
              key: 'reset',
              'data-action': 'reset',
              type: 'button',
              className: 'mov-btn',
              disabled: status === 'saving' || snapshot.writable === false,
              onClick: reset,
            }, t('reset')),
          ])
          : null;

        // 版本卡片：当前版本是构建时注入的常量，最新版本来自所选渠道已发布的 Release。
        // 有新版本时给出升级命令——用 git 源装的插件不会出现在「已安装」里的更新按钮上。
        const updateAvailable = Boolean(updateLatest) && Boolean(PLUGIN_VERSION)
          && isNewerVersion(updateLatest, PLUGIN_VERSION);
        const updateText = updateStatus === 'working'
          ? t('versionChecking')
          : (updateStatus === 'failed'
            ? updateMessage
            : (updateStatus === 'installing'
              ? t('versionUpdating')
              : ((updateStatus === 'restart' || updateStatus === 'applied')
                ? updateMessage
                : (updateStatus === 'ok'
                  ? (updateAvailable ? t('versionNew', { version: updateLatest }) : t('versionLatest'))
                  : ''))));
        // 失败红、成功绿（更新完/有新版本），其余用灰度文字
        const updateTone = updateStatus === 'failed'
          ? TOKENS.error
          : (updateStatus === 'restart' || updateStatus === 'applied' || updateAvailable ? TOKENS.success : TOKENS.muted);
        const versionBox = h('div', {
          key: 'version',
          'data-field': 'version',
          className: 'mov-card',
        }, [
          h('div', { key: 'head', className: 'mov-card-head' }, [
            h('span', { key: 'title', className: 'mov-card-title' }, t('versionTitle')),
            h('span', {
              key: 'current',
              'data-field': 'versionCurrent',
              className: 'mov-hint mov-current-version',
            }, [
              h('span', { key: 'label' }, PLUGIN_VERSION ? t('versionCurrent', { version: PLUGIN_VERSION }) : ''),
              updateBell(t, updateLatest, PLUGIN_VERSION),
            ]),
            h('a', { key: 'history', className: 'mov-hint', href: 'https://github.com/wxsimon2022/metaontic-video/blob/master/CHANGELOG.md', target: '_blank', rel: 'noopener noreferrer' }, t('versionHistory')),
            h('button', {
              key: 'check',
              'data-action': 'update-check',
              type: 'button',
              className: 'mov-btn mov-btn-sm mov-trailing',
              disabled: updateStatus === 'working' || updateStatus === 'installing',
              onClick: () => { checkForUpdate(false).catch(() => {}); },
            }, updateStatus === 'working' ? t('versionChecking') : t('versionCheck')),
          ]),
          releaseNotes?.items?.length ? h('div', { key: 'release-notes', 'data-field': 'releaseNotes' }, [
            h('div', { key: 'heading', style: { display: 'flex', alignItems: 'baseline', gap: 12 } }, [
              h('span', { key: 'title', className: 'mov-card-title' }, `${releaseNotes.version} · ${t('releaseNotesTitle')}`),
              formatReleaseTime(releaseNotes.publishedAt) ? h('span', { key: 'published-at', 'data-field': 'releasePublishedAt', className: 'mov-foot-note' }, t('releaseUpdatedAt', { time: formatReleaseTime(releaseNotes.publishedAt) })) : null,
            ]),
            h('ul', { key: 'items', style: { margin: '8px 0 0', paddingLeft: 18, fontSize: 12, lineHeight: 1.7, color: TOKENS.muted } },
              releaseNotes.items.map((item, index) => h('li', { key: index }, item))),
          ]) : null,
          updateText
            ? h('span', {
              key: 'state',
              'data-field': 'versionState',
              className: 'mov-hint',
              style: { color: updateTone },
            }, updateText)
            : null,
          updateAvailable
            ? h('div', { key: 'command', className: 'mov-cmd-row' }, [
              // 点一下转成「确认更新」，再点一下让宿主重装本插件
              h('button', {
                key: 'online',
                'data-action': 'update-online',
                type: 'button',
                className: 'mov-btn mov-btn-sm mov-btn-primary',
                disabled: updateStatus === 'installing',
                onClick: () => {
                  if (updateConfirm) runOnlineUpdate().catch(() => {});
                  else setUpdateConfirm(true);
                },
              }, updateStatus === 'installing'
                ? t('versionUpdating')
                : (updateConfirm
                  ? t('versionUpdateConfirm', { version: updateLatest })
                  : t('versionUpdate'))),
            ])
            : null,
          updateAvailable && updateConfirm
            ? h('span', {
              key: 'confirm-hint',
              'data-field': 'updateConfirmHint',
              className: 'mov-hint',
            }, t('versionUpdateConfirmHint'))
            : null,
          updateAvailable ? h('span', { key: 'hint', className: 'mov-hint' }, t('versionHint')) : null,
          (updateStatus === 'ok' && updateAt)
            ? h('span', { key: 'at', className: 'mov-foot-note' }, t('versionCheckedAt', { time: updateAt }))
            : null,
        ]);

        let notice = null;
        if (snapshot.status === 'loading') notice = t('loading');
        else if (snapshot.value === undefined) notice = t('unavailable');
        else if (snapshot.writable === false) notice = t('readOnly');

        // 配置读不出来（没有表单 / 不可写）时只显示提示，配置项与卡片一律不渲染。
        const blobs = notice && !snapshot.value
          ? []
          : [footer, versionBox, resetRow];

        return h('div', { className: 'mov-page' }, [
          // hover / focus 这类效果内联样式写不出来，集中在这张样式表里（class 都带 mov- 前缀）。
          h('style', { key: 'styles' }, PAGE_CSS),
          !notice || snapshot.value ? renderUpdateNotice({
            h, t, available: updateAvailable, latest: updateLatest, deferred: updateDeferred,
            status: updateStatus, confirmed: updateConfirm,
            onUpdate: () => { if (updateConfirm) runOnlineUpdate().catch(() => {}); else setUpdateConfirm(true); },
            onLater: deferUpdate,
          }) : null,
          notice ? h('p', { key: 'notice', className: 'mov-notice' }, notice) : null,
          ...(notice && !snapshot.value ? [] : settingsRows()),
          ...blobs,
          supportOpen ? h('dialog', {
            key: 'support-dialog', ref: supportDialog, className: 'mov-support-dialog',
            'aria-labelledby': 'mov-support-title',
            onCancel: () => setSupportOpen(false), onClose: () => setSupportOpen(false),
            onClick: (event) => { if (event.target === event.currentTarget) { const rect = event.currentTarget.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) setSupportOpen(false); } },
          }, h('div', { className: 'mov-support-content' }, [
            h('div', { key: 'heading', className: 'mov-card-head' }, [
              h('strong', { key: 'title', id: 'mov-support-title' }, t('supportRecharge')),
              h('button', { key: 'close', type: 'button', className: 'mov-btn mov-btn-sm mov-trailing', 'aria-label': t('supportClose'), onClick: () => setSupportOpen(false) }, t('supportClose')),
            ]),
            h('p', { key: 'hint', className: 'mov-hint' }, t('supportScan')),
            h('iframe', { key: 'qr', className: 'mov-support-frame', title: t('supportRecharge'), src: 'https://work.weixin.qq.com/ca/cawcde20e8080b7f6f', referrerPolicy: 'no-referrer' }),
            h('a', { key: 'fallback', href: 'https://work.weixin.qq.com/ca/cawcde20e8080b7f6f', target: '_blank', rel: 'noopener noreferrer' }, t('supportOpenPage')),
          ])) : null,
        ]);
      };
    }
  return { makePage };
}
