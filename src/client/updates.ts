/** 浏览器端 updates：由入口注入宿主 React 与共享依赖。 */
export function createUpdates({ h }: any) {
/** 「检查更新」的数据源：Gitee 镜像仓库（Gitee 的 API 带 CORS 头，浏览器半侧能直接读）。 */
    const PLUGIN_PACKAGE = 'metaontic-video';
    const UPDATE_SPEC = 'git+https://gitee.com/hackloop/metaontic-video.git';
    /** 在线更新最多试几次：Gitee 的匿名 HTTPS 克隆会排队，429 一般过一会儿就好。 */
    const UPDATE_ATTEMPTS = 3;
    /** 版本检查结果的本地缓存：打开设置页先显示，再后台刷新。 */
    const UPDATE_CACHE_KEY = 'metaontic-video.update-check-v2';
    const UPDATE_MAX_AGE_MS = 6 * 60 * 60 * 1000;
    /** 构建时由 esbuild --define 注入的版本号；从源码直接跑（没注入）时为空串。 */
    const PLUGIN_VERSION = typeof __PLUGIN_VERSION__ === 'string'
      ? __PLUGIN_VERSION__.trim().replace(/^v/i, '')
      : '';

    /** 比较 x.y.z：远端确实比本地新才返回 true；任一边认不出来就当作没有更新。 */
    function isNewerVersion(remote, local) {
      const parse = (text) => {
        const m = /^v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/.exec(String(text || ''));
        return m ? { core: m.slice(1,4).map(Number), pre: m[4]?.split('.') || [] } : null;
      };
      const next = parse(remote), current = parse(local);
      if (!next || !current) return false;
      for (let i = 0; i < 3; i++) if (next.core[i] !== current.core[i]) return next.core[i] > current.core[i];
      if (!next.pre.length || !current.pre.length) return !next.pre.length && Boolean(current.pre.length);
      for (let i = 0; i < Math.max(next.pre.length, current.pre.length); i++) {
        const a = next.pre[i], b = current.pre[i];
        if (a === b) continue;
        if (a === undefined || b === undefined) return b === undefined;
        const an = /^\d+$/.test(a), bn = /^\d+$/.test(b);
        if (an && bn) return Number(a) > Number(b);
        if (an !== bn) return !an;
        return a > b;
      }
      return false;
    }

    function updateBell(t, latest, current) {
      if (!isNewerVersion(latest, current)) return null;
      const label = t('versionNew', { version: latest });
      return h('span', { className: 'mov-update-bell', 'data-field': 'update-bell', role: 'img', 'aria-label': label, title: label },
        h('svg', { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true }, [
          h('path', { key: 'body', d: 'M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9' }),
          h('path', { key: 'clapper', d: 'M10 21h4M12 2V1' }),
        ]));
    }

    /** 带超时的 GET（检查更新只读公开文件，不带任何本机凭据）。 */
    async function fetchUpdateSource(url, ms = 12000) {
      const controller = typeof AbortController === 'function' ? new AbortController() : null;
      const timer = controller ? window.setTimeout(() => controller.abort(), ms) : null;
      try {
        const response = await fetch(url, {
          headers: { accept: 'application/json' },
          signal: controller ? controller.signal : undefined,
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        return { json: async () => data };
      } finally {
        if (timer) window.clearTimeout(timer);
      }
    }

    /** 分渠道读取 GitHub/Gitee 已发布 Release，不发送本机凭据。 */
    async function fetchLatestVersion(channel = 'stable') {
      // 仅使用已发布 Release；不从 master 或未发布标签推断可安装版本。
      const urls = [
        'https://gitee.com/api/v5/repos/hackloop/metaontic-video/releases?per_page=100',
        channel === 'prerelease'
          ? 'https://api.github.com/repos/wxsimon2022/metaontic-video/releases?per_page=100'
          : 'https://api.github.com/repos/wxsimon2022/metaontic-video/releases/latest',
      ];
      const requests = urls.map(async url => {
        const data = await (await fetchUpdateSource(url, 6000)).json();
        const body = Array.isArray(data) ? data : data?.tag_name ? [data] : null;
        if (!body) throw new Error('invalid releases');
        let best = '';
        for (const release of body) {
          const version = String(release.tag_name || '').replace(/^v/, '');
          if (release.draft || !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/.test(version)) continue;
          if (channel !== 'prerelease' && (release.prerelease || version.includes('-'))) continue;
          if (!best || isNewerVersion(version, best)) best = version;
        }
        if (!best) throw new Error('no releases in channel');
        return best;
      });
      // 有来源发现比本机新的版本即可提醒；降级切换等待全部有界请求后选最高版本。
      return new Promise<string>((resolve, reject) => {
        let remaining = requests.length, best = '';
        const errors = [];
        for (const request of requests) request.then(version => {
          if (!best || isNewerVersion(version, best)) best = version;
          if (isNewerVersion(version, PLUGIN_VERSION)) resolve(version);
        }, error => { errors.push(error?.message || String(error)); }).finally(() => {
          if (--remaining === 0) best ? resolve(best) : reject(new Error(errors.join('；')));
        });
      });
    }

  return { PLUGIN_VERSION, UPDATE_CACHE_KEY, UPDATE_MAX_AGE_MS, fetchLatestVersion, PLUGIN_PACKAGE, UPDATE_SPEC, UPDATE_ATTEMPTS, isNewerVersion, updateBell };
}

export function createUpdateActions(context: any) {
/**
 * 上次的版本检查结果（存在浏览器本地）：`fresh` 表示还没过期，
 * 先用缓存显示结果；进入完整设置页仍会后台刷新，失败时保留缓存。
 */
function readUpdateCache() {
    try {
        const raw = window.localStorage.getItem(context.UPDATE_CACHE_KEY);
        const saved = raw ? JSON.parse(raw) : null;
        if (!saved || typeof saved !== 'object') {
            return { latest: '', commit: '', at: 0, fresh: false };
        }
        const at = Number(saved.at) || 0;
        return {
            latest: String(saved.latest || ''),
            commit: String(saved.commit || ''),
            at,
            fresh: Boolean(at) && Date.now() - at < context.UPDATE_MAX_AGE_MS,
        };
    }
    catch {
        return { latest: '', commit: '', at: 0, fresh: false };
    }
}

/** 所选渠道最近检测到的发布版本；渠道通过缓存键隔离。 */
function rememberUpdateCheck(latest, commit = '') {
    try {
        window.localStorage.setItem(context.UPDATE_CACHE_KEY, JSON.stringify({ at: Date.now(), latest, commit: commit || '' }));
    }
    catch {
        // 存不住只是下次打开会再查一遍，不影响这次的显示
    }
}

/** 更新成功后清掉缓存：新版本这次启动就该重新比对一次，不然还挂着「有新版本」。 */
function forgetUpdateCheck() {
    try {
        window.localStorage.removeItem(context.UPDATE_CACHE_KEY);
    }
    catch {
        // 清不掉只是下次打开可能还显示旧结果，不影响更新本身
    }
}

/**
 * 检查更新：读取所选渠道的已发布版本。
 * silent 用于打开设置页时的自动检查——失败不打扰用户，页面上还是上次的结果。
 */
async function checkForUpdate(silent = false) {
    if (!silent) {
        context.setUpdateDeferred?.('');
        try { window.localStorage.removeItem(`${context.UPDATE_CACHE_KEY}.deferred`); } catch {}
        context.setUpdateStatus('working');
        context.setUpdateMessage('');
    }
    const channel = context.updateChannel || 'stable';
    const request = context.updateRequest ? ++context.updateRequest.current : 0;
    try {
        const latest = await context.fetchLatestVersion(channel);
        if (context.updateRequest && request !== context.updateRequest.current) return '';
        context.setUpdateConfirm?.(false);
        context.setUpdateLatest(latest);
        context.setUpdateAt(new Date().toLocaleTimeString());
        context.setUpdateStatus('ok');
        rememberUpdateCheck(latest);
        return latest;
    }
    catch (error) {
        if (context.updateRequest && request !== context.updateRequest.current) return '';
        if (silent)
            return '';
        context.setUpdateStatus('failed');
        context.setUpdateMessage(context.t('versionFailed', { message: error?.message || String(error) }));
        return '';
    }
}

/** 仅在用户二次确认后安装已发布标签，保留当前插件作为失败退路。 */
async function runOnlineUpdate() {
    if (context.updateConfirm !== true) return;
    context.setUpdateConfirm(false);
    // 先把「更新中」摆上：重装会把本插件的客户端模块换掉，页面随时可能消失，
    // 用户至少要立刻看到按钮/文案变了，而不是以为点了没反应。
    context.setUpdateStatus('installing');
    context.setUpdateMessage('');
    const probe = context.manager ? context.manager() : { manager: null, tried: ['未注入'] };
    const pluginManager = probe.manager;
    if (!pluginManager || typeof pluginManager.installBundle !== 'function') {
        context.setUpdateStatus('failed');
        context.setUpdateMessage(context.t('versionUpdateUnavailable', { detail: probe.tried.join('，') }));
        return;
    }
    const requestId = `${context.PLUGIN_PACKAGE}-update-${Date.now()}`;
    const install = async (spec) => {
        try {
            return await pluginManager.installBundle(spec, { enabled: true, requestId });
        }
        catch (error) {
            return { ok: false, error: { message: error?.message || String(error) } };
        }
    };
    /** 宿主两种失败回包（调用失败 / 安装阶段失败）里那句可以给人看的话。 */
    const failureText = (result) => String(result?.error?.message
        ?? result?.value?.error?.diagnostic
        ?? result?.value?.error?.code
        ?? 'unknown');
    /** 过一会儿可能就好的失败：Gitee 排队（429）、超时、连接被掐。 */
    const worthRetrying = (text) => /429|queue overflowed|timed out|timeout|ETIMEDOUT|ECONNRESET|ECONNREFUSED|EAI_AGAIN|socket hang up|unable to access|network|fetch/i.test(text);
    // 安装仅指向已检查的发布标签；不能回退到 master 或无后缀地址。
    if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/.test(context.updateLatest || '')
        || (context.updateChannel === 'stable' && context.updateLatest.includes('-'))) {
        context.setUpdateStatus('failed');
        context.setUpdateMessage(context.t('versionCheckFirst'));
        return;
    }
    const candidates = [
      `${context.UPDATE_SPEC}#v${context.updateLatest}`,
      `git+https://github.com/wxsimon2022/metaontic-video.git#v${context.updateLatest}`,
    ];
    /** 这条 spec 装不上时值不值得换下一条：只有「这个 committish 解析不出来」才换。 */
    const specUnresolvable = (text) => /Could not resolve|No matching version|ERR_PNPM_NO_MATCHING_VERSION/i.test(text);
    /** 限流/超时有界重试；已安装不先卸载，保留本地配置。 */
    const trySpec = async (spec) => {
        for (let round = 1; round <= context.UPDATE_ATTEMPTS; round += 1) {
            let result = await install(spec);
            if (result?.ok === true && result.value?.error?.code === 'already-installed') {
                // 同一版本已安装时保持现状，不卸载。
                return { failure: failureText(result), next: false };
            }
            if (result?.ok === true && result.value?.application !== 'failed') {
                return { outcome: result.value || {} };
            }
            const text = failureText(result);
            const transient = worthRetrying(text);
            if (transient && round < context.UPDATE_ATTEMPTS) {
                context.setUpdateMessage(context.t('versionUpdateRetry', { attempt: round + 1, total: context.UPDATE_ATTEMPTS }));
                await new Promise((resolve) => window.setTimeout(resolve, round * 1200));
                continue;
            }
            return { failure: text, next: !transient && specUnresolvable(text) };
        }
        return { failure: 'unknown' };
    };
    let outcome = null;
    let failure = '';
    for (const spec of candidates) {
        const attempt = await trySpec(spec);
        if (attempt.outcome) {
            outcome = attempt.outcome;
            break;
        }
        failure = attempt.failure || failure;
        // 换 spec 也没用的失败（限流、断网、权限）就停在这里，别把同一套错误在候选之间跑一遍
        if (!attempt.next)
            break;
    }
    if (!outcome) {
        context.setUpdateStatus('failed');
        context.setUpdateMessage([
            context.t('versionUpdateFailed', { message: failure }),
            worthRetrying(failure) || /429|queue overflowed/i.test(failure)
                ? context.t('versionUpdateRateLimited')
                : '',
        ].filter(Boolean).join(' '));
        return;
    }
    if (outcome.application === 'cancelled') {
        context.setUpdateStatus('ok');
        context.setUpdateMessage(context.t('versionUpdateCancelled'));
        return;
    }
    // 装好了：缓存作废，卡片不再是「有新版本」，只报更新结果
    forgetUpdateCheck();
    const version = outcome.version || context.updateLatest;
    context.setUpdateLatest('');
    context.setUpdateStatus(outcome.application === 'restart-required' ? 'restart' : 'applied');
    context.setUpdateMessage(outcome.application === 'restart-required'
        ? context.t('versionUpdateRestart', { version })
        : context.t(outcome.application === 'applied' ? 'versionUpdateDone' : 'versionUpdatePending', { version }));
}
function deferUpdate() {
    context.setUpdateConfirm(false);
    context.setUpdateDeferred(context.updateLatest);
    try { window.localStorage.setItem(`${context.UPDATE_CACHE_KEY}.deferred`, context.updateLatest); } catch {}
}
  return { deferUpdate, readUpdateCache, rememberUpdateCheck, forgetUpdateCheck, checkForUpdate, runOnlineUpdate };
}

/** Ordinary updates are optional: checking and dismissing never install anything. */
export function renderUpdateNotice({ h, t, available, latest, deferred, status, confirmed, onUpdate, onLater }) {
  if (!available || deferred === latest || status === 'installing') return null;
  return h('div', { key: 'update-notice', className: 'mov-notice', role: 'status', 'data-field': 'update-notice' }, [
    h('strong', { key: 'title' }, t('versionNew', { version: latest })),
    h('p', { key: 'optional' }, t('versionOptional')),
    confirmed ? h('p', { key: 'confirm' }, t('versionUpdateConfirmHint')) : null,
    h('div', { key: 'actions', className: 'mov-cmd-row' }, [
      h('button', { key: 'update', type: 'button', className: 'mov-btn mov-btn-sm mov-btn-primary',
        'data-action': confirmed ? 'update-notice-confirm' : 'update-notice-open', onClick: onUpdate },
        confirmed ? t('versionUpdateConfirm', { version: latest }) : t('versionUpdate')),
      h('button', { key: 'later', type: 'button', className: 'mov-btn mov-btn-sm', 'data-action': 'update-later', onClick: onLater }, t('versionLater')),
    ]),
  ]);
}

/** 已安装版本的发布时间，固定北京时间；不是检查时间或本地构建时间。 */
export function formatReleaseTime(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) return '';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  return new Date(date.getTime() + 8 * 60 * 60 * 1000).toISOString().slice(0, 16).replace('T', ' ');
}
