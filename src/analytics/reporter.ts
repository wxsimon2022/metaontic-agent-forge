/** 旁路匿名统计：调用方不等待网络；队列、超时、重试与退出均有界。 */
import { randomUUID, createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { dshHome } from '../media/references.js';
import { PLUGIN_VERSION, ref } from '../config.js';

export const ANALYTICS_URL = 'https://video.mybfs.cn/api/v1/analytics/events';
const STATE = Symbol.for('metaontic-video.analytics.process');
const EVENTS = new Set(['plugin_started', 'tool_started', 'tool_finished', 'video_task_created', 'video_task_finished']);
const TOOLS = new Set(['video_generate', 'video_extend', 'video_status', 'video_project', 'video_prepare_image', 'video_estimate', 'video_config', 'video_setup', 'video_stage', 'media_submission']);
const STATUSES = new Set(['succeeded', 'failed', 'cancelled', 'unknown', 'timeout', 'approved', 'pending', 'paused', 'prepared', 'draft', 'blocked', 'review_required', 'submission_unknown', 'ok']);
const ERRORS = new Set(['provider_auth', 'provider_failed', 'provider_network_error', 'provider_rate_limited', 'provider_quota_exceeded', 'provider_price_config_error', 'provider_bad_response', 'content_rejected', 'real_person_rejected', 'submission_unknown', 'waiting_stopped', 'ABORTED']);
function processState() {
  const owner = globalThis as any;
  return owner[STATE] ||= { identities: new Map(), started: new Set() };
}
export async function analyticsIdentity() {
  const file = path.join(dshHome(), 'state', 'metaontic-video', 'analytics-id.json');
  const state = processState();
  if (!state.identities.has(file)) state.identities.set(file, (async () => {
    const parse = raw => { try { const id = JSON.parse(raw).installationId; return /^[a-f0-9-]{36}$/i.test(id) ? id : null; } catch { return null; } };
    try { const id = parse(await readFile(file, 'utf8')); if (id) return id; } catch { /* first activation */ }
    const id = randomUUID();
    await mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
    try { await writeFile(file, JSON.stringify({ installationId: id }), { mode: 0o600, flag: 'wx' }); }
    catch (error) {
      if (error.code !== 'EEXIST') throw error;
      const existing = parse(await readFile(file, 'utf8'));
      if (!existing) throw new Error('anonymous identity unavailable');
      return existing;
    }
    return id;
  })().catch(() => null));
  return state.identities.get(file);
}
/** 上报数据只允许固定枚举和有界数值，禁止透传执行参数/异常/提示词。 */
export function analyticsFields(input: any = {}) {
  const value: any = {};
  if (TOOLS.has(input.tool)) value.tool = input.tool;
  if (['video-director', 'promo-video', 'standard'].includes(input.mode)) value.mode = input.mode;
  if (STATUSES.has(input.status)) value.status = input.status;
  if (typeof input.durationMs === 'number' && Number.isFinite(input.durationMs)) value.durationMs = Math.round(Math.max(0, Math.min(86400000, input.durationMs)));
  if (typeof input.errorCode === 'string') value.errorCode = ERRORS.has(input.errorCode) ? input.errorCode : 'other';
  return value;
}
export function createAnalyticsReporter(config, options: any = {}) {
  const enabled = options.enabled || (() => process.env.METAONTIC_VIDEO_ANALYTICS_DISABLED !== '1' && ref(config, 'usageStatsEnabled', true) !== false);
  const request = options.request || ((...args) => (globalThis.fetch as any)(...args));
  const identity = options.identity || analyticsIdentity;
  const device = options.device || (() => ({
    arch: ['arm64', 'x64', 'ia32', 'arm'].includes(os.arch()) ? os.arch() : 'other',
    osRelease: os.release().slice(0, 64),
    memoryGb: Math.max(1, Math.min(4096, Math.round(os.totalmem() / 1024 ** 3))),
    harnessVersion: String(process.env.DSH_CLIENT_VERSION || process.env.DSH_APP_VERSION || 'unknown').replace(/[^a-zA-Z0-9.+_-]/g, '').slice(0, 64),
  }));
  const delay = options.delayMs ?? 1000;
  const timeout = options.timeoutMs ?? 1500;
  const maxQueue = options.maxQueue ?? 200;
  let queue: any[] = [], timer: any, controller: AbortController | null = null;
  let disposed = false, sending = false;
  const allowed = () => { try { return !disposed && enabled(); } catch { return false; } };
  function schedule(ms = delay) {
    if (!allowed() || timer || sending || !queue.length) return;
    timer = setTimeout(() => { timer = null; void flush(); }, ms);
    timer.unref?.();
  }
  async function flush() {
    if (!allowed()) { queue = []; return; }
    if (sending || !queue.length) return;
    sending = true;
    const batch = queue.splice(0, 20);
    let watchdog: any;
    try {
      const installationId = await identity();
      if (!installationId || !allowed()) return;
      controller = new AbortController();
      // 即使替身/网络不响应abort，也在本地结束等待，不占用后续队列。
      const abort = new Promise((_, reject) => {
        watchdog = setTimeout(() => { controller?.abort(); reject(new Error('analytics timeout')); }, timeout);
        watchdog.unref?.();
      });
      const response: any = await Promise.race([Promise.resolve().then(() => request(ANALYTICS_URL, {
        method: 'POST', redirect: 'error', credentials: 'omit',
        headers: { 'Content-Type': 'application/json' }, signal: controller.signal,
        body: JSON.stringify({ installationId, device: device(), events: batch.map(({ attempts, ...event }) => event) }),
      })), abort]);
      try { void response?.body?.cancel()?.catch(() => {}); } catch { /* optional response body */ }
      if (!response?.ok) throw new Error('analytics rejected');
    } catch {
      if (allowed()) {
        const retry = batch.map(event => ({ ...event, attempts: event.attempts + 1 })).filter(event => event.attempts < 3);
        queue = [...retry, ...queue].slice(-maxQueue);
      }
    } finally {
      clearTimeout(watchdog); controller = null; sending = false;
      if (allowed() && queue.length) schedule(queue[0].attempts ? Math.min(30000, 1000 * 5 ** queue[0].attempts) : delay);
    }
  }
  function record(name, input = {}, dedupeKey = '') {
    try {
      if (!allowed()) { queue = []; return; }
      if (!EVENTS.has(name)) return;
      const event = { eventId: randomUUID(), name, occurredAt: new Date().toISOString(), version: PLUGIN_VERSION,
        platform: ['darwin', 'win32', 'linux'].includes(process.platform) ? process.platform : 'other',
        ...analyticsFields(input), attempts: 0 };
      // taskId只在本地参与散列，服务端不接收原任务ID。
      if (dedupeKey) {
        void Promise.resolve().then(() => identity()).then(id => {
          if (!id || !allowed()) return;
          event.eventId = createHash('sha256').update(`${id}:${name}:${dedupeKey}`).digest('hex');
          queue.push(event); queue = queue.slice(-maxQueue); schedule();
        }).catch(() => {});
      } else { queue.push(event); queue = queue.slice(-maxQueue); schedule(); }
    } catch { /* 统计失败绝不改变工具行为 */ }
  }
  function start() {
    // 身份读写也在后台，apply/工具入口不await。
    void Promise.resolve().then(() => allowed() ? identity() : null).then(id => {
      if (!id || !allowed()) return;
      const starts = options.started || processState().started;
      if (!starts.has(id)) { starts.add(id); record('plugin_started'); }
    }).catch(() => {});
  }
  function dispose() { disposed = true; queue = []; clearTimeout(timer); controller?.abort(); }
  return { record, start, dispose, flush, pending: () => queue.length };
}
export function reportUsage(exec, name, fields, key = '') {
  try { exec?.metaonticAnalytics?.record(name, fields, key); } catch { /* optional */ }
}
export function withUsageAnalytics(tool, reporter, mode = (_exec) => 'standard') {
  return { ...tool, async execute(args, exec) {
    const started = Date.now();
    let selected = 'standard';
    try { selected = mode(exec); } catch { /* optional preset registry */ }
    try { reporter.record('tool_started', { tool: tool.name, mode: selected }); } catch { /* isolated */ }
    try {
      const result = await tool.execute(args, { ...exec, name: tool.name, metaonticAnalytics: reporter, metaonticMode: selected });
      try { reporter.record('tool_finished', { tool: tool.name, mode: selected, status: result?.status || 'ok', durationMs: Date.now() - started, errorCode: result?.errorCode }); } catch { /* isolated */ }
      return result;
    } catch (error) {
      try { reporter.record('tool_finished', { tool: tool.name, mode: selected, status: 'failed', durationMs: Date.now() - started, errorCode: error?.code || 'other' }); } catch { /* isolated */ }
      throw error;
    }
  } };
}
