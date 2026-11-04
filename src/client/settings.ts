import { createAccountActions } from './account.js';
import { createUpdateActions, renderUpdateNotice, formatReleaseTime } from './updates.js';
/** 浏览器端 settings：由入口注入宿主 React 与共享依赖。 */
import packageInfo from '../../package.json';
/**
 * 设置页工厂。依赖统一走一个 deps 对象（和 createAccountActions 一样），
 * 入口在 src/client.ts 装配：宿主 React（React/h）、主题与字段（TOKENS/inputStyle/SELECTS/
 * optionLabel/FIELD_BY_KEY/SECTIONS/formatMoney/PAGE_CSS）、设置状态（useSnapshot/same/
 * validateSettings/persistConnection/persistBatch/PLUGIN_OWNED_KEYS）、连接与登录文案
 * （DEFAULT_REGISTER_API/LOGGED_OUT_KEY/DEFAULT_REGISTER_TOKEN）、版本与更新
 * （PLUGIN_VERSION、UPDATE_CACHE_KEY、UPDATE_MAX_AGE_MS、fetchLatestVersion、isNewerVersion、
 * updateBell、PLUGIN_PACKAGE）。
 * 返回的 makePage({ form, t, manager }) 才是页面组件工厂。
 */
export function createSettingsPage(deps: any) {
  const {
    useSnapshot, React, h, TOKENS, same, validateSettings, persistConnection, PLUGIN_OWNED_KEYS,
    persistBatch, DEFAULT_REGISTER_API, LOGGED_OUT_KEY, DEFAULT_REGISTER_TOKEN, PLUGIN_VERSION,
    UPDATE_CACHE_KEY, UPDATE_MAX_AGE_MS, fetchLatestVersion, SELECTS, inputStyle, optionLabel,
    FIELD_BY_KEY, SECTIONS, formatMoney, PLUGIN_PACKAGE, UPDATE_SPEC, UPDATE_ATTEMPTS,
    isNewerVersion, updateBell, PAGE_CSS,
  } = deps;
// A 服务端模式的使用记录暂时影藏：接口未就绪，先不渲染这张卡，也不再轮询。
// 恢复时把这一项改回 true 即可，额度卡片与其余设置不受影响。
const SHOW_USAGE_RECORD = false;
function makePage({ form, t, manager }) {
      return function ConfigPage(props) {
        const snapshot = useSnapshot(form);
        const value = snapshot.value || {};
        const [draft, setDraft] = React.useState({});
        const selectedMode = draft.connectionMode ?? value.connectionMode ?? 'service';
        const directMode = selectedMode === 'volcengine';
        const serviceMode = selectedMode === 'service';
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
        function serviceActive() {
          return !connectionBusy.current && (form.getSnapshot().value?.connectionMode || 'service') === 'service';
        }
        const [registerStatus, setRegisterStatus] = React.useState('idle');
        const [registerMessage, setRegisterMessage] = React.useState('');
        // 注册用「邮箱（账号）+ 邮件验证码」：邮箱一次只发一把 Key
        const [registerEmail, setRegisterEmail] = React.useState(() => {
          const saved = form.getSnapshot().value || {};
          return String(saved.registerEmail || '');
        });
        const [registerCode, setRegisterCode] = React.useState('');
        const [codeStatus, setCodeStatus] = React.useState('idle');
        const [codeMessage, setCodeMessage] = React.useState('');
        const [codeCooldown, setCodeCooldown] = React.useState(0);
        // 发过码之后的冷却期里邮箱置灰（倒计时结束就放开，可以改邮箱重发）
        const emailLocked = codeCooldown > 0;
        // 额度：设置页展示这把 Key 的剩余 / 已用
        const [quota, setQuota] = React.useState(null);
        const [quotaStatus, setQuotaStatus] = React.useState('idle');
        const [quotaMessage, setQuotaMessage] = React.useState('');
        const [quotaAt, setQuotaAt] = React.useState('');
        // 余额（钱包）：生成优先扣余额，不够再提示充值 / 单次付款
        const [wallet, setWallet] = React.useState(null);
        const [walletStatus, setWalletStatus] = React.useState('idle');
        const [walletMessage, setWalletMessage] = React.useState('');
        const [rechargeOpen, setRechargeOpen] = React.useState(false);
        const [rechargeAmount, setRechargeAmount] = React.useState('30');
        const [rechargeState, setRechargeState] = React.useState('idle');
        const [rechargeMessage, setRechargeMessage] = React.useState('');
        const [rechargeLink, setRechargeLink] = React.useState('');
        const rechargeDialog = React.useRef(null);
        React.useEffect(() => {
          if (rechargeOpen && rechargeDialog.current && !rechargeDialog.current.open) rechargeDialog.current.showModal();
        }, [rechargeOpen]);
        React.useEffect(() => { setRechargeOpen(false); }, [selectedMode]);
        // 使用记录：本机那把 Key 最近几次出片（服务端按设备认人，只给自己的）
        const [usage, setUsage] = React.useState(null);
        const [usageStatus, setUsageStatus] = React.useState('idle');
        const [usageMessage, setUsageMessage] = React.useState('');
        const usageInFlight = React.useRef(false);
        const [usageAt, setUsageAt] = React.useState('');
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

                const { registerApiRoot, loggedOut, setLoggedOut, clearLoggedOut, forgetDevice, deviceIdentity, deviceFingerprint, deviceLabel, deviceWrites, syncDeviceIdentity, callRegister, applyRegistration, lookupOwnKey, startCooldown, sendEmailCode, register, loadQuota, loadUsage, loadWallet, startRecharge, waitRecharge } = createAccountActions({
          get value() { return value; },
          get DEFAULT_REGISTER_API() { return DEFAULT_REGISTER_API; },
          get LOGGED_OUT_KEY() { return LOGGED_OUT_KEY; },
          get form() { return form; },
          get same() { return same; },
          get serviceActive() { return serviceActive; },
          get connectionBusy() { return connectionBusy; },
          get persistBatch() { return persistBatch; },
          get clear() { return clear; },
          get DEFAULT_REGISTER_TOKEN() { return DEFAULT_REGISTER_TOKEN; },
          get PLUGIN_VERSION() { return PLUGIN_VERSION; },
          get persistConnection() { return persistConnection; },
          get setRegisterStatus() { return setRegisterStatus; },
          get settingsError() { return settingsError; },
          get t() { return t; },
          get setCodeCooldown() { return setCodeCooldown; },
          get registerEmail() { return registerEmail; },
          get setCodeStatus() { return setCodeStatus; },
          get setCodeMessage() { return setCodeMessage; },
          get setRegisterMessage() { return setRegisterMessage; },
          get registerCode() { return registerCode; },
          get serviceMode() { return serviceMode; },
          get setQuotaStatus() { return setQuotaStatus; },
          get setQuotaMessage() { return setQuotaMessage; },
          get setQuota() { return setQuota; },
          get setQuotaAt() { return setQuotaAt; },
          get setWallet() { return setWallet; },
          get setWalletStatus() { return setWalletStatus; },
          get setWalletMessage() { return setWalletMessage; },
          get usageInFlight() { return usageInFlight; },
          get setUsageStatus() { return setUsageStatus; },
          get setUsageMessage() { return setUsageMessage; },
          get setUsage() { return setUsage; },
          get setUsageAt() { return setUsageAt; },
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

        // 打开设置页时，若本机还没配 Key，就先问服务端要回自己那把（设备绑定过就能取回）；
        // 但刚点过「重置插件」的不算——那时要保持未登录，等用户自己再点「登录」。
        const restoreTried = React.useRef(false);
        React.useEffect(() => {
          if (restoreTried.current) return;
          restoreTried.current = true;
          const snap = form.getSnapshot() || {};
          if (((snap.value || {}).connectionMode || 'service') !== 'service') return;
          if (loggedOut()) {
            setRegisterStatus('idle');
            return;
          }
          // 设备凭据同步进配置：主进程要在调用模型前拿它查余额
          syncDeviceIdentity().catch(() => {});
          if (snap.secrets?.apiKey || (snap.value || {}).apiKey) {
            loadQuota().catch(() => {});
            loadWallet().catch(() => {});
            if (SHOW_USAGE_RECORD) loadUsage().catch(() => {});
            return;
          }
          lookupOwnKey().catch(() => {});
        }, []);

        // 页面可见时定时拉取，重新聚焦时立即刷新；火山直连不查询服务端记录。
        React.useEffect(() => {
          if (!serviceMode || !SHOW_USAGE_RECORD || props?.view === 'summary'
            || !(snapshot.secrets?.apiKey || value.apiKey)) return;
          const refresh = () => {
            if (window.document?.visibilityState === 'hidden') return;
            loadUsage().catch(() => {});
          };
          refresh();
          const timer = window.setInterval(refresh, 60000);
          window.addEventListener('focus', refresh);
          window.document?.addEventListener('visibilitychange', refresh);
          return () => {
            window.clearInterval(timer);
            window.removeEventListener('focus', refresh);
            window.document?.removeEventListener('visibilitychange', refresh);
          };
        }, [serviceMode, Boolean(snapshot.secrets?.apiKey || value.apiKey), value.deviceId, props?.view]);

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

        async function save() {
          if (saveInFlight.current) return;
          if (connectionBusy.current && !connectionBusy.pending) return;
          saveInFlight.current = true;
          setSaveError('');
          setStatus('saving');
          try {
            if (connectionBusy.pending) await connectionBusy.pending.catch(() => {});
            connectionBusy.current = true;
            const latest = form.getSnapshot().value || {};
            const nextMode = draft.connectionMode ?? latest.connectionMode ?? 'service';
            const changes = Object.entries(draft).filter(([key, next]) => !same(latest[key], next));
            validateSettings({ ...latest, ...draft });
            await persistConnection(form, changes, nextMode);
            if (nextMode !== 'service') {
              forgetDevice();
              setRegisterEmail('');
              setRegisterCode('');
              setRegisterStatus('idle');
              setRegisterMessage('');
              setQuota(null);
            }
            setDraft((current) => Object.fromEntries(Object.entries(current).filter(([key, next]) => !Object.prototype.hasOwnProperty.call(draft, key) || !same(draft[key], next))));
            flashStatus('saved');
          } catch (error) {
            setSaveError(settingsError(error));
            setStatus('failed');
          } finally {
            connectionBusy.current = false;
            saveInFlight.current = false;
          }
        }

        /**
         * 重置插件 = 回到「刚装上」的样子：
         * ① 把配置里这台机器写过的项全部移除（Key、来源标记、上游地址、邮箱、设备凭据、模型…），
         *    宿主重载配置后就退回插件默认值；
         * ② 抹掉本机设备凭据，并打上「已登出」标记——否则重开设置页会自动向服务端取回那把 Key，
         *    看着就像重置没生效（这个标记在下次登录成功时清掉）。
         */
        async function reset() {
          if (connectionBusy.current) return;
          if (!window.confirm(t('resetConfirm'))) return;
          connectionBusy.current = true;
          setSaveError('');
          setStatus('saving');
          try {
            const targets = new Set([...Object.keys(snapshot.user || {}), ...PLUGIN_OWNED_KEYS]);
            await persistBatch(form, [...targets].map((key) => ({ op: 'unset', path: [key] })));
            forgetDevice();
            setDraft({});
            setVisibleKey('');
            setRegisterEmail('');
            setRegisterStatus('idle');
            setRegisterMessage('');
            setRegisterCode('');
            setQuota(null);
            flashStatus('reset');
          } catch (error) {
            setSaveError(t('resetFailed', { message: settingsError(error) }));
            setStatus('failed');
          } finally {
            connectionBusy.current = false;
          }
        }

        function control(field) {
          if (field.key === 'apiKey') return h('input', { id: 'metaontic-video-apiKey', className: 'mov-input', style: inputStyle, type: 'text', readOnly: true, value: (snapshot.secrets?.apiKey || value.apiKey) ? t('serviceKeyConfigured') : t('serviceKeyMissing') });
          const current = draft[field.key] !== undefined ? draft[field.key] : value[field.key] ?? (field.key === 'imageUseVideoKey' ? true : field.key === 'pollIntervalMs' ? 5000 : field.key === 'maxWaitMs' ? 600000 : undefined);
          const secondsField = field.key === 'pollIntervalMs' || field.key === 'maxWaitMs';
          const displayed = secondsField && current !== undefined && current !== '' ? Number(current) / 1000 : current;
          const id = `metaontic-video-${field.key}`;
          if (field.kind === 'switch') {
            return h('label', { htmlFor: id, className: 'mov-switch' },
              h('input', {
                id,
                'data-field': field.key,
                type: 'checkbox',
                checked: Boolean(current),
                onChange: (event) => edit(field.key, event.target.checked),
              }),
              h('span', null, t(field.key)));
          }
          if (field.kind === 'select') {
            const options = SELECTS[field.key] || [];
            // 当前值不在候选表里（例如服务端刚换的型号）就把它补进去，避免下拉里看不到自己现在的取值
            const hiddenModel = field.key === 'model' && /seedance-2(?:-5|\.5)/i.test(String(current || ''));
            const legacyMerge = field.key === 'mergeMode' && current === 'seamless';
            const list = current && !options.includes(current) && !hiddenModel && !legacyMerge ? [...options, current] : options;
            return h('select', {
              id,
              'data-field': field.key,
              className: `mov-input${field.mono ? ' mov-mono' : ''}`,
              style: inputStyle,
              value: legacyMerge ? 'copy' : current ?? '',
              onChange: (event) => edit(field.key, event.target.value),
            }, [
              hiddenModel ? h('option', { key: 'hidden-current', value: current, hidden: true }, t('modelHiddenCurrent')) : null,
              ...list.map((option) => h('option', { key: option, value: option }, optionLabel(t, field.key, option))),
            ]);
          }
          const canReveal = field.key === 'metaonticApiKey' || field.key === 'volcengineApiKey' || field.key === 'imageApiKey';
          const revealed = canReveal && visibleKey === field.key;
          const input = h('input', {
            id,
            'data-field': field.key,
            className: `mov-input${field.mono ? ' mov-mono' : ''}`,
            style: inputStyle,
            type: field.kind === 'number' ? 'number' : (field.secret && !revealed ? 'password' : 'text'),
            value: displayed ?? '',
            min: secondsField ? 1 : undefined,
            step: secondsField ? 0.001 : undefined,
            placeholder: field.secret && (snapshot.secrets?.[field.key] || value[field.key]) ? t('apiKeyConfigured') : '',
            onChange: (event) => edit(
              field.key,
              field.kind === 'number' && event.target.value !== ''
                ? (secondsField ? Math.round(Number(event.target.value) * 1000) : Number(event.target.value))
                : event.target.value,
            ),
          });
          if (!canReveal) return input;
          return h('div', { className: 'mov-key-control' }, [
            input,
            h('button', {
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

        // 少数需要解释的字段：模型选哪个（mini 便宜 / fast 贵一些）
        const hints = {
          connectionMode: selectedMode === 'metaontic'
            ? [t('connectionMetaonticHint'), ' ', h('a', { key: 'metaontic-register', href: 'https://ai.bileego.com/', target: '_blank', rel: 'noopener noreferrer', style: { textDecoration: 'underline' } }, t('connectionMetaonticRegister'))]
            : t('connectionModeHint'),
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
              : h('label', { key: 'label', className: 'mov-label', htmlFor: `metaontic-video-${field.key}` }, t(['apiKey', 'metaonticApiKey', 'volcengineApiKey'].includes(field.key) ? (!directMode && (serviceMode || (draft.imageUseVideoKey ?? value.imageUseVideoKey ?? true) !== false) ? 'sharedModelKey' : 'videoModelKey') : field.key)),
            control(field),
            hints[field.key] ? h('span', { key: 'hint', className: 'mov-hint', style: { marginTop: 4 } }, hints[field.key]) : null,
          ]);
        }

        // 配置区分成几节，每节一个标题 + 一个自适应网格。
        const renderGrid = (section) => {
          if (section.key === 'sectionModels') {
            const shared = serviceMode || (draft.imageUseVideoKey ?? value.imageUseVideoKey ?? true) !== false;
            const common = !serviceMode && !directMode
              ? [fieldCell(FIELD_BY_KEY.imageUseVideoKey), ...(shared ? [fieldCell(FIELD_BY_KEY.metaonticApiKey)] : [])] : [];
            const videoFields = ['model', ...(!serviceMode && (directMode || !shared) ? [directMode ? 'volcengineApiKey' : 'metaonticApiKey'] : [])];
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
          const shared = serviceMode || (draft.imageUseVideoKey ?? value.imageUseVideoKey ?? true) !== false;
          const videoKey = directMode ? 'volcengineApiKey' : serviceMode ? 'apiKey' : 'metaonticApiKey';
          const fields = section.key === 'sectionModels'
            ? directMode ? ['model', videoKey]
              : serviceMode ? ['model', 'imageModel']
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
                section.key === 'sectionConnection' ? registerBox : null,
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

        const registerMessageColors = {
          ok: TOKENS.success,
          restored: TOKENS.success,
          partial: TOKENS.success,
          disabled: TOKENS.error,
          failed: TOKENS.error,
        };
        // 上游 / 地址 / Key 现在由注册流程写入，页面上不让手填。
        // 只有「服务端下发的」才算配好：手改到配置里的 Key 拿不到额度、调用也会被拒，
        // 这种情况要把注册区露出来，让用户点「登录」换回自己那把。
        const serverIssuedKey = value.keyOrigin === 'register'
          || Boolean(value.deviceId && value.deviceSecret && value.registerEmail);
        const keyReady = serviceMode && Boolean(snapshot.secrets?.apiKey || value.apiKey) && serverIssuedKey;
        // 邮箱是唯一标识，只发一把：已经配好 Key 的（注册过的或手填的）整块注册区直接隐藏，
        // 连「已经领到 Key 了」这类说明也不显示；要换 Key 只能找管理员。
        const registerText = registerStatus === 'ok'
          ? t('registerOk')
          : (registerStatus === 'partial'
            ? t('registerPartial')
            : (registerStatus === 'restored'
              ? t('registerRestored')
              : registerMessage));
        // 额度一律显示人民币：服务端已经按中转站的口径换算好（额度 / 500000 × 7.3），
        // 这里只负责拼符号与位数（与中转站一致：够 1 元保留 2 位，不到保留 4 位）。
        const quotaSymbol = quota && quota.currency_symbol ? quota.currency_symbol : '¥';
        const money = (field) => `${quotaSymbol}${formatMoney(quota ? quota[field] : 0)}`;
        const quotaReady = quotaStatus === 'ok' && quota;
        // 没读到额度时还是给一句话（读取中 / 还没领 Key），读到了就摊成三个数字块。
        const quotaFallback = keyReady ? t('quotaLoading') : t('quotaNoKey');
        // 余额：读到才占一块；服务端没开钱包（off）时整块不出现
        const walletReady = walletStatus === 'ok' && wallet && wallet.enabled;
        const walletSymbol = wallet && wallet.currency_symbol ? wallet.currency_symbol : quotaSymbol;
        const walletStats = walletReady
          ? [{
            key: 'balance',
            label: t('walletBalance'),
            value: `${walletSymbol}${formatMoney(Number(wallet.balance) || 0)}`,
            color: TOKENS.primaryFill,
          }]
          : [];
        const quotaStats = quotaReady
          ? [
            {
              key: 'remain',
              label: t('quotaRemain'),
              value: quota.unlimited_quota ? t('quotaUnlimited') : money('remain_amount'),
              color: TOKENS.success,
            },
            { key: 'used', label: t('quotaUsed'), value: money('used_amount'), color: TOKENS.text },
            { key: 'total', label: t('quotaTotal'), value: money('total_amount'), color: TOKENS.muted },
          ]
          : null;
        // 没登录就没有额度可言：整块不渲染（跟使用记录一个规矩）
        const quotaBox = serviceMode && keyReady ? h('div', {
          key: 'quota',
          'data-field': 'quota',
          className: 'mov-card mov-quota-compact',
        }, [
          h('div', { key: 'head', className: 'mov-card-head' }, [
            h('span', { key: 'title', className: 'mov-card-title' }, t('quotaTitle')),
          ]),
          (walletStats.length || quotaStats)
            ? h('div', { key: 'text', 'data-field': 'quotaValue', className: 'mov-stats' },
              [...walletStats, ...(quotaStats || [])].map((item) => h('div', { key: item.key, className: 'mov-stat' }, [
                h('span', { key: 'label', className: 'mov-stat-label' }, item.label),
                h('span', {
                  key: 'value',
                  className: 'mov-stat-value',
                  style: { color: item.color },
                }, item.value),
              ])))
            : h('span', {
              key: 'text',
              'data-field': 'quotaValue',
              className: 'mov-hint',
            }, quotaFallback),
          quotaReady
            ? h('span', { key: 'at', className: 'mov-foot-note' }, t('quotaUpdatedAt', { time: quotaAt }))
            : null,
          quotaMessage ? h('span', { key: 'message', className: 'mov-hint' }, quotaMessage) : null,
          walletMessage ? h('span', { key: 'wallet-message', className: 'mov-hint' }, walletMessage) : null,
          walletReady
            ? h('span', { key: 'wallet-tip', className: 'mov-foot-note' },
              t('walletBalanceTip', {
                price: `${walletSymbol}${formatMoney(Number(wallet.price) || 0)}`,
              }))
            : null,
          h('div', { key: 'actions', className: 'mov-quota-actions mov-trailing' }, [
            h('button', {
              key: 'refresh', 'data-action': 'quota-refresh', type: 'button',
              className: 'mov-btn mov-btn-sm', disabled: quotaStatus === 'working',
              onClick: () => {
                loadQuota().catch(() => {});
                loadWallet().catch(() => {});
              },
            }, t('quotaRefresh')),
            walletReady
              ? h('button', {
                key: 'recharge', 'data-action': 'wallet-recharge', type: 'button',
                className: 'mov-btn mov-btn-sm mov-btn-primary', 'aria-haspopup': 'dialog',
                onClick: () => {
                  setRechargeState('idle');
                  setRechargeMessage('');
                  setRechargeLink('');
                  if (wallet && wallet.recharge_min) {
                    const current = Number(rechargeAmount);
                    const min = Number(wallet.recharge_min);
                    if (!Number.isFinite(current) || current < min) setRechargeAmount(String(min));
                  }
                  setRechargeOpen(true);
                },
              }, t('walletRecharge'))
              : null,
            h('button', {
              key: 'support', 'data-action': 'support-recharge', type: 'button',
              className: 'mov-btn mov-btn-sm', 'aria-haspopup': 'dialog',
              onClick: () => setSupportOpen(true),
            }, t('supportRecharge')),
          ]),

        ]) : null;

        /** 充值：下单 -> 打开收银台 -> 等余额到账（到账自动刷新余额与额度）。 */
        async function submitRecharge() {
          const amount = Number(String(rechargeAmount).trim());
          if (!Number.isFinite(amount) || amount <= 0) {
            setRechargeState('failed');
            setRechargeMessage(t('walletRechargeBadAmount'));
            return;
          }
          setRechargeState('working');
          setRechargeMessage('');
          setRechargeLink('');
          try {
            const order = await startRecharge(amount);
            const link = order && order.pay_url ? String(order.pay_url) : '';
            setRechargeLink(link);
            if (link) {
              try { window.open(link, '_blank', 'noopener'); } catch { /* 打不开就靠下面的链接 */ }
            }
            setRechargeState('pending');
            setRechargeMessage(t('walletRechargeOpening'));
            const done = await waitRecharge(String(order && order.out_trade_no));
            if (done && done.credited) {
              setRechargeState('ok');
              setRechargeMessage(t('walletRechargeDone', {
                balance: `${walletSymbol}${formatMoney(Number(done.balance) || 0)}`,
              }));
            }
            else {
              setRechargeState('failed');
              setRechargeMessage(t('walletRechargeTimeout'));
            }
          }
          catch (error) {
            setRechargeState('failed');
            setRechargeMessage(t('walletRechargeFailed', { message: error?.message || String(error) }));
          }
        }

        /** 复制一段文本；剪贴板不可用就什么都不做，用户照样能照着敲。 */
        function copyText(text, mark) {
          try {
            const result = window.navigator?.clipboard?.writeText(text);
            if (result && typeof result.then === 'function') {
              result.then(() => {
                mark(text);
                window.setTimeout(() => mark(''), 2000);
              }, () => {});
            }
          } catch {
            // 复制失败不影响照着命令自己装 / 自己更新
          }
        }

        /** 复制 ffmpeg 安装命令。 */
        function copyCommand(command) {
          copyText(command, setCopiedFfmpeg);
        }

        /** 一条记录里的时间：只到分钟，够看清「什么时候出的片」。 */
        function usageTime(value) {
          if (!value) return '-';
          const at = new Date(value);
          if (Number.isNaN(at.getTime())) return '-';
          return at.toLocaleString(undefined, {
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
          });
        }

        // 使用记录：本机那把 Key 最近几次出片（一次任务一行，含消耗多少钱）。
        const usageRows = usage && Array.isArray(usage.items) ? usage.items : [];
        const usageSymbol = usage && usage.currency_symbol ? usage.currency_symbol : '¥';
        const usageSummaryText = usage
          ? (usageRows.length
            ? `${t('usageSummary', {
              count: usage.count,
              amount: `${usageSymbol}${formatMoney(usage.amount_sum)}`,
            })}${usage.truncated ? ` · ${t('usageMore', { count: usage.count })}` : ''}`
            : t('usageEmpty'))
          : (usageStatus === 'working' ? t('usageLoading') : t('usageKeyMissing'));
        const usageBox = SHOW_USAGE_RECORD && serviceMode && keyReady ? h('div', {
          key: 'usage',
          'data-field': 'usage',
          className: 'mov-card',
        }, [
          h('div', { key: 'head', className: 'mov-card-head' }, [
            h('span', { key: 'title', className: 'mov-card-title' },
              t('usageTitle', { days: usage ? usage.window_days : 7 })),
            h('span', {
              key: 'summary',
              'data-field': 'usageSummary',
              className: 'mov-hint',
              style: { flex: '1 1 160px' },
            }, usageSummaryText),
            h('button', {
              key: 'refresh',
              'data-action': 'usage-refresh',
              type: 'button',
              className: 'mov-btn mov-btn-sm',
              disabled: usageStatus === 'working',
              onClick: () => { loadUsage().catch(() => {}); },
            }, t('usageRefresh')),
          ]),
          usageRows.length ? h('div', {
            key: 'table',
            className: 'mov-table',
          }, [
            h('div', {
              key: 'head-row',
            'data-field': 'usage-head',
              className: 'mov-table-head',
            }, [
              h('span', { key: 'time' }, t('usageColTime')),
              h('span', { key: 'kind' }, t('usageColKind')),
              h('span', { key: 'model' }, t('usageColModel')),
              h('span', { key: 'cost' }, t('usageColCost')),
              h('span', { key: 'status' }, t('usageColStatus')),
            ]),
            ...usageRows.map((row, index) => h('div', {
              key: `${row.id}-${index}`,
              'data-field': 'usage-row',
              className: 'mov-table-row',
            }, [
              h('span', { key: 'time', className: 'mov-num', style: { color: TOKENS.muted } },
                usageTime(row.created_at)),
              h('span', { key: 'kind' }, row.kind_label || ''),
              // 模型 ID 是这一行最有用的信息之一（换过模型一眼能看出来是哪次用的哪个）
              h('span', {
                key: 'model',
                className: 'mov-model',
                title: row.model || '',
              }, row.model || '—'),
              h('span', {
                key: 'amount',
                'data-field': 'usage-amount',
                className: 'mov-num',
                style: { color: row.status === 'succeeded' ? TOKENS.success : TOKENS.muted },
              }, `${usageSymbol}${formatMoney(row.amount)}`),
              h('span', { key: 'status' },
                h('span', {
                  key: 'chip',
                  className: `mov-chip ${row.status === 'succeeded' ? 'mov-chip-ok' : 'mov-chip-bad'}`,
                }, row.status === 'succeeded' ? t('usageStatusOk') : t('usageStatusFailed'))),
            ])),
          ]) : null,
          usageAt ? h('span', { key: 'updated-at', className: 'mov-foot-note' }, t('quotaUpdatedAt', { time: usageAt })) : null,
          usageMessage ? h('span', { key: 'message', className: 'mov-hint' }, usageMessage) : null,
        ]) : null;

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

        // 有 Key 就整块不渲染（连标题、提示文字都没有），页面上只剩配置项 + 额度卡片。
        const registerBox = keyReady || !serviceMode ? null : h('div', {
          key: 'register',
          className: 'mov-card',
          style: { gap: 10 },
        }, [
          h('div', { key: 'text', style: { display: 'flex', flexDirection: 'column', gap: 4 } }, [
            h('span', { key: 'title', className: 'mov-card-title' },
              t('registerTitle')),
            h('span', { key: 'hint', className: 'mov-hint' }, t('registerHint')),
          ]),
          h('div', { key: 'form', className: 'mov-register-form' }, [
          h('input', {
            key: 'email',
            'data-field': 'registerEmail',
            type: 'text',
            className: 'mov-input',
            value: registerEmail,
            placeholder: t('registerEmailPlaceholder'),
            'aria-label': t('registerEmail'),
            // 验证码已经发出去了：冷却期内不让改邮箱，免得「码发到 A、注册填 B」
            disabled: emailLocked,
            'data-locked': emailLocked ? 'true' : 'false',
            title: emailLocked ? t('registerEmailLocked') : undefined,
            onChange: (event) => setRegisterEmail(event.target.value),
            style: {
              ...inputStyle,
              flex: '1 1 220px',
              width: 'auto',
              opacity: emailLocked ? 0.6 : 1,
              cursor: emailLocked ? 'not-allowed' : 'text',
            },
          }),
          h('button', {
            key: 'code',
            'data-action': 'send-code',
            type: 'button',
            className: 'mov-btn',
            disabled: codeStatus === 'working' || codeCooldown > 0 || !registerEmail.trim(),
            onClick: () => { sendEmailCode().catch(() => {}); },
          }, codeCooldown > 0
            ? t('registerCodeCooldown', { seconds: codeCooldown })
            : (codeStatus === 'working' ? t('registerCodeSending') : t('registerCodeSend'))),
          h('input', {
            key: 'code-input',
            'data-field': 'registerCode',
            type: 'text',
            inputMode: 'numeric',
            className: 'mov-input',
            value: registerCode,
            placeholder: t('registerCodePlaceholder'),
            'aria-label': t('registerCode'),
            onChange: (event) => setRegisterCode(event.target.value),
            style: { ...inputStyle, flex: '0 1 130px', width: 'auto' },
          }),
          h('button', {
            key: 'button',
            'data-action': 'register',
            type: 'button',
            className: 'mov-btn mov-btn-primary',
            disabled: registerStatus === 'working'
              || !registerEmail.trim()
              || !registerCode.trim()
              || snapshot.writable === false,
            onClick: register,
          }, registerStatus === 'working' ? t('registerWorking') : t('register')),
          ]),
          codeMessage
            ? h('span', {
              key: 'code-message',
              'data-field': 'codeMessage',
              style: {
                flex: '1 1 100%',
                fontSize: 12,
                color: codeStatus === 'failed' ? TOKENS.error : TOKENS.success,
              },
            }, codeMessage)
            : null,
          registerText
            ? h('span', {
              key: 'message',
              style: { flex: '1 1 100%', fontSize: 12, color: registerMessageColors[registerStatus] || TOKENS.muted },
            }, registerText)
            : null,
        ]);

        let notice = null;
        if (snapshot.status === 'loading') notice = t('loading');
        else if (snapshot.value === undefined) notice = t('unavailable');
        else if (snapshot.writable === false) notice = t('readOnly');

        // 配置读不出来（没有表单 / 不可写）时只显示提示，配置项与卡片一律不渲染。
        const blobs = notice && !snapshot.value
          ? []
          : [footer, ...(serviceMode ? [quotaBox, usageBox] : []), versionBox, resetRow];

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
          rechargeOpen ? h('dialog', {
            key: 'recharge-dialog', ref: rechargeDialog, className: 'mov-support-dialog',
            'aria-labelledby': 'mov-recharge-title',
            onCancel: () => setRechargeOpen(false), onClose: () => setRechargeOpen(false),
            onClick: (event) => { if (event.target === event.currentTarget) { const rect = event.currentTarget.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) setRechargeOpen(false); } },
          }, h('div', { className: 'mov-support-content' }, [
            h('div', { key: 'heading', className: 'mov-card-head' }, [
              h('strong', { key: 'title', id: 'mov-recharge-title' }, t('walletRechargeTitle')),
              h('button', { key: 'close', type: 'button', className: 'mov-btn mov-btn-sm mov-trailing', 'aria-label': t('walletRechargeCancel'), onClick: () => setRechargeOpen(false) }, t('walletRechargeCancel')),
            ]),
            h('p', { key: 'hint', className: 'mov-hint' }, walletReady
              ? t('walletRechargeRange', {
                min: walletSymbol + formatMoney(Number(wallet.recharge_min) || 0),
                max: walletSymbol + formatMoney(Number(wallet.recharge_max) || 0),
              })
              : ''),
            h('div', { key: 'form', style: { display: 'flex', gap: 8, alignItems: 'center' } }, [
              h('input', {
                key: 'amount',
                'data-field': 'rechargeAmount',
                type: 'text',
                inputMode: 'decimal',
                className: 'mov-input',
                value: rechargeAmount,
                placeholder: t('walletRechargeAmount'),
                'aria-label': t('walletRechargeAmount'),
                disabled: rechargeState === 'working' || rechargeState === 'pending',
                onChange: (event) => setRechargeAmount(event.target.value),
                style: { ...inputStyle, flex: '1 1 auto' },
              }),
              h('button', {
                key: 'confirm',
                'data-action': 'wallet-recharge-confirm',
                type: 'button',
                className: 'mov-btn mov-btn-primary',
                disabled: rechargeState === 'working' || rechargeState === 'pending' || !String(rechargeAmount).trim(),
                onClick: () => { submitRecharge().catch(() => {}); },
              }, rechargeState === 'working' ? t('walletRechargeWorking') : t('walletRechargeConfirm')),
            ]),
            rechargeMessage ? h('p', { key: 'message', className: 'mov-hint' }, rechargeMessage) : null,
            rechargeLink ? h('a', { key: 'link', href: rechargeLink, target: '_blank', rel: 'noopener noreferrer' }, t('walletRechargeLink')) : null,
          ])) : null,
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
