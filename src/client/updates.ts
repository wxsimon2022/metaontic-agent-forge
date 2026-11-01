/** 浏览器端 updates：由入口注入宿主 React 与共享依赖。 */
export function createUpdates({ h }: any) {
/** 「检查更新」的数据源：Gitee 镜像仓库（Gitee 的 API 带 CORS 头，浏览器半侧能直接读）。 */
    const UPDATE_PROJECT = 'hackloop/metaontic-video';
    const UPDATE_FILE_API = `https://gitee.com/api/v5/repos/${UPDATE_PROJECT}/contents/package.json`;
    /** 本包在 profile 里的包名，以及能重装自己的那条依赖 spec——在线更新直接复用这两样。 */
    const PLUGIN_PACKAGE = 'metaontic-video';
    const UPDATE_SPEC = 'git+https://gitee.com/hackloop/metaontic-video.git';
    /**
     * Gitee 的 API 会被 WAF 限流（403 Rate Limit Exceeded），「检查更新」不该因此变瞎。
     * 兜底分两级：
     *   1) jsDelivr 的**数据接口**（不是文件 CDN）：给的是这个仓库的 tag 列表，不经过 CDN 缓存，
     *      拿到的就是最新版号——而且 tag 正好是更新 spec 要用的后缀；
     *   2) 文件镜像：同一仓库的 GitHub 副本，走 jsDelivr 的备用域名（`cdn.jsdelivr.net` 在国内常被墙，
     *      所以用 `fastly` / `gcore`）。分支内容是 CDN 缓存的，可能比最新版滞后十几小时，只当最后一路兜底。
     */
    const UPDATE_TAGS_API = 'https://data.jsdelivr.com/v1/packages/gh/wxsimon2022/metaontic-video';
    const UPDATE_MIRROR_FILES = [
      'https://fastly.jsdelivr.net/gh/wxsimon2022/metaontic-video@master/package.json',
      'https://gcore.jsdelivr.net/gh/wxsimon2022/metaontic-video@master/package.json',
    ];
    /** 默认分支，以及「默认分支最新提交」的 Gitee API：在线更新要拿它当 spec 的 committish。 */
    const UPDATE_BRANCH = 'master';
    const UPDATE_COMMIT_API = `https://gitee.com/api/v5/repos/${UPDATE_PROJECT}/commits`
      + `?sha=${UPDATE_BRANCH}&per_page=1`;
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
        const match = /(\d+)\.(\d+)\.(\d+)/.exec(String(text || ''));
        return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : null;
      };
      const next = parse(remote);
      const current = parse(local);
      if (!next || !current) return false;
      for (let index = 0; index < 3; index += 1) {
        if (next[index] !== current[index]) return next[index] > current[index];
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

    /** Gitee 返回的文件内容是 base64：先还原成字节，再按 UTF-8 解出文本。 */
    function decodeBase64Text(raw) {
      if (typeof atob !== 'function') return '';
      const binary = atob(String(raw || '').replace(/\s+/g, ''));
      const bytes = new Uint8Array(binary.length);
      for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
      return typeof TextDecoder === 'function' ? new TextDecoder().decode(bytes) : binary;
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

    /** 版本号校验：Gitee API 给的是 base64 的 contents 回包，镜像源给的是裸 JSON。 */
    function versionFromFile(body) {
      const version = String((body || {}).version || '').trim().replace(/^v/i, '');
      if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error('invalid version');
      return version;
    }

    /** 从 jsDelivr 的 tag 列表里挑版本最高的那个（非 semver 的 tag 直接跳过）。 */
    function versionFromTags(body) {
      const versions = Array.isArray(body?.versions) ? body.versions : [];
      let best = '';
      for (const entry of versions) {
        const version = String((entry && entry.version) || '').trim().replace(/^v/i, '');
        if (!/^\d+\.\d+\.\d+$/.test(version)) continue;
        if (!best || isNewerVersion(version, best)) best = version;
      }
      if (!best) throw new Error('no tags');
      return best;
    }

    /**
     * 读默认分支的 package.json，只用里面的 version 判断有没有新版本。
     * 不走 npm 源也不用管理端凭据：谁都能查，查不到就只报「检查失败」，不影响生成。
     *
     * 顺序：Gitee API（权威、带 CORS）→ jsDelivr 的 tag 列表（不走 CDN 缓存，最新）→ 文件镜像。
     * 之所以要兜底：Gitee 的 API 会 WAF 限流，一限就是一段时间，而「检查更新」是打开设置页就会跑的。
     */
    async function fetchLatestVersion() {
      const github = 'https://api.github.com/repos/wxsimon2022/metaontic-video/contents/package.json?ref=master';
      const requests = [UPDATE_FILE_API, github].map(async (url) => {
        const body = await (await fetchUpdateSource(url, 6000)).json();
        return versionFromFile(JSON.parse(decodeBase64Text(body.content)));
      });
      requests.push((async () => versionFromTags(await (await fetchUpdateSource(UPDATE_TAGS_API, 6000)).json()))());
      for (const url of UPDATE_MIRROR_FILES) {
        requests.push((async () => versionFromFile(await (await fetchUpdateSource(url, 6000)).json()))());
      }
      // 任一仓库或镜像发现新版本就立即返回；其他来源失败或超时不阻塞提醒。
      return new Promise<string>((resolve, reject) => {
        let remaining = requests.length;
        let best = '';
        const errors = [];
        for (const request of requests) {
          request.then((version) => {
            if (!best || isNewerVersion(version, best)) best = version;
            if (isNewerVersion(version, PLUGIN_VERSION)) resolve(version);
          }, (error) => { errors.push(error?.message || String(error)); }).finally(() => {
            if (--remaining === 0) {
              if (best) resolve(best);
              else reject(new Error(errors.join('；')));
            }
          });
        }
      });
    }

    /**
     * 默认分支最新提交的完整 sha。
     *
     * 在线更新为什么不直接装 `UPDATE_SPEC`：宿主对「同一个 spec 再装一遍」是直接拒绝的
     * （already-installed），想绕开就得先卸载——而卸载之后一旦装不上（Gitee 429、断网），
     * 插件就没了。改成带上当前最新提交号，spec 跟已装的永远不同，宿主当新依赖处理、
     * 直接原地覆盖安装，装失败也不会动现有版本。
     */
    async function fetchLatestCommit() {
      const body = await (await fetchUpdateSource(UPDATE_COMMIT_API)).json();
      const sha = String((Array.isArray(body) ? body[0]?.sha : '') || '').trim();
      if (!/^[0-9a-f]{40}$/i.test(sha)) throw new Error('no commit');
      return sha;
    }
  return { PLUGIN_VERSION, UPDATE_CACHE_KEY, UPDATE_MAX_AGE_MS, fetchLatestVersion, fetchLatestCommit, PLUGIN_PACKAGE, UPDATE_SPEC, UPDATE_ATTEMPTS, isNewerVersion, updateBell };
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

/** 缓存里带上默认分支的提交号：在线更新要用它拼 spec 后缀，省一次联网。 */
function rememberUpdateCheck(latest, commit) {
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
 * 检查更新：比 Gitee 上默认分支的版本号与本包版本。
 * silent 用于打开设置页时的自动检查——失败不打扰用户，页面上还是上次的结果。
 */
async function checkForUpdate(silent = false) {
    if (!silent) {
        context.setUpdateDeferred?.('');
        try { window.localStorage.removeItem(`${context.UPDATE_CACHE_KEY}.deferred`); } catch {}
        context.setUpdateStatus('working');
        context.setUpdateMessage('');
    }
    try {
        const latest = await context.fetchLatestVersion();
        // 提交号仅服务于安装，不阻塞版本检测结果。
        context.fetchLatestCommit().then((commit) => { context.updateCommit.current = commit; }).catch(() => { });
        context.setUpdateConfirm?.(false);
        context.setUpdateLatest(latest);
        context.setUpdateAt(new Date().toLocaleTimeString());
        context.setUpdateStatus('ok');
        rememberUpdateCheck(latest, context.updateCommit.current);
        return latest;
    }
    catch (error) {
        if (silent)
            return '';
        context.setUpdateStatus('failed');
        context.setUpdateMessage(context.t('versionFailed', { message: error?.message || String(error) }));
        return '';
    }
}

/**
 * 一键在线更新：让宿主的插件管理服务把本插件重装一遍。
 *
 * 关键点是**先装、不卸载**：宿主对「同一个 spec 重复安装」直接拒绝（already-installed），
 * 所以 spec 带上默认分支当前最新的提交号——跟 profile 里记的那条永远不同，宿主当一条新依赖
 * 处理，pnpm 原地覆盖安装。这样装到一半失败（Gitee 限流、断网）时，手上这份插件还在；
 * 旧做法「先卸载再安装」一旦装不上，插件就没了。
 *
 * 期间本插件的客户端模块会被宿主换掉，这张设置页会短暂消失：属正常现象，
 * 更新完（或重启 Harness 后）再回来就是新版本。所以引用要提前取好。
 */
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
    // 卸载只在「同 spec 已在 profile 里」这条兜底路上用（正常更新用不到）：
    // 卸载失败也继续装——没有 HMR 的宿主会报 stop-profile，安装会直接盖过去。
    const remove = async () => {
        if (typeof pluginManager.removeBundle !== 'function')
            return null;
        try {
            return await pluginManager.removeBundle(context.PLUGIN_PACKAGE);
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
    /**
     * spec 的候选顺序（越靠前越准）：
     *   1) `#<默认分支最新提交号>`——Gitee API 活着时用这个；
     *   2) `#v<版本号>`——Gitee API 被限流（403）时退到 tag；每次发版都会打 tag（见 README「发版」）；
     *   3) 不带后缀的老 spec——前两条都解析不出来时的退路（只有这条路才可能要卸载）。
     * 带后缀的意义：spec 跟 profile 里记的那条不同，宿主才当新依赖原地覆盖安装，装失败也不会丢插件。
     */
    let commit = context.updateCommit.current || '';
    if (commit)
        context.updateCommit.current = commit;
    const candidates = [];
    if (context.updateLatest)
        candidates.push(`${context.UPDATE_SPEC}#v${context.updateLatest}`);
    if (commit)
        candidates.push(`${context.UPDATE_SPEC}#${commit}`);
    candidates.push(context.UPDATE_SPEC);
    /** 这条 spec 装不上时值不值得换下一条：只有「这个 committish 解析不出来」才换。 */
    const specUnresolvable = (text) => /Could not resolve|No matching version|ERR_PNPM_NO_MATCHING_VERSION/i.test(text);
    let removed = false;
    /** 装一条 spec：限流/超时自动重试，already-installed 走一次「卸了再装」的兜底。 */
    const trySpec = async (spec) => {
        for (let round = 1; round <= context.UPDATE_ATTEMPTS; round += 1) {
            let result = await install(spec);
            if (result?.ok === true && result.value?.error?.code === 'already-installed') {
                // profile 里已经记着这条 spec（上次刚好装到同一个提交）：卸载再装，强制刷一遍。
                removed = true;
                await remove();
                result = await install(spec);
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
            removed ? context.t('versionUpdateRemoved') : '',
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
