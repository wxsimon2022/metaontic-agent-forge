/**
 * Host（cordis / DeepSeek Harness）里本插件实际用到的接口。
 *
 * 只声明用到的部分，保持成型：工具定义、`tools/pre-execute` 卡口的返回、
 * 审批服务、以及插件上下文上的几个可选服务。方法体内部的细节仍然宽松，
 * 但「注册什么工具、卡口返回什么」这种跨包契约会在编译期被检查。
 */

declare module '@deepseek-ai/schemastery' {
  export interface SchemaNode<T = unknown> {
    description(text: string): SchemaNode<T>;
    default(value: T): SchemaNode<T>;
    /** 声明为「引用」：宿主包装成可热更新、宿主重载后立即生效的字段。 */
    volatile(): SchemaNode<T>;
    min(value: number): SchemaNode<T>;
    max(value: number): SchemaNode<T>;
    step(value: number): SchemaNode<T>;
    natural(): SchemaNode<T>;
    readonly value: T;
  }

  const z: {
    object(shape: Record<string, unknown>): SchemaNode<Record<string, unknown>>;
    string(): SchemaNode<string>;
    number(): SchemaNode<number>;
    boolean(): SchemaNode<boolean>;
    natural(): SchemaNode<number>;
    union(values: readonly string[]): SchemaNode<string>;
    dict(value: unknown): SchemaNode<Record<string, unknown>>;
  };

  export default z;
}

/** 构建时由 esbuild `--define:__PLUGIN_VERSION__` 注入的插件版本号；源码直跑时未定义。 */
declare const __PLUGIN_VERSION__: string;

/** 一次工具调用的执行上下文。 */
interface DshToolExec {
  /** 工具名，例如 metaontic_agent_forge_video_generate。 */
  name: string;
  callId: string;
  /** 模型给的原参数。 */
  arguments?: unknown;
  agent?: { session?: unknown };
  signal?: AbortSignal;
  parent?: unknown;
}

/** `tools/pre-execute` 卡口的决定：allow 放行，ask 走人工确认，deny 直接拒绝。 */
type DshPreExecuteDecision =
  | { kind: 'allow' }
  | { kind: 'cancel' }
  | { kind: 'deny'; reason: string; info?: Record<string, unknown> }
  | { kind: 'ask'; reason?: string; displayReason?: Record<string, string> };

/** 审批服务的返回：只有 allowed-once 是「已经批准这一次」。 */
type DshApprovalOutcome = 'allowed-once' | 'rejected' | 'cancelled' | 'unavailable';

interface DshApprovalService {
  config?: { policy?: 'ask' | 'never' };
  overrideOf(session: unknown): 'ask' | 'never' | undefined;
}

interface DshToolDefinition {
  name: string;
  description: string;
  parameters?: unknown;
  output?: { schema?: unknown; render?: (args: unknown, value: any) => unknown };
  timeoutMs?: number;
  isConcurrencySafe?: () => boolean;
  execute(args?: any, exec?: DshToolExec): Promise<any> | any;
}

interface DshContext {
  tools: { register(tool: DshToolDefinition): () => void };
  on(event: string, listener: (exec: DshToolExec, next: () => Promise<DshPreExecuteDecision>) => unknown): () => void;
  get(name: string): any;
  /** 注入可选服务：宿主没有这些服务时回调根本不跑（返回值不是清理函数）。 */
  inject(names: string[], callback: (ctx: DshContext) => unknown): unknown;
  logger?: { warn?: (message: string) => void };
  // ---- 下面几个都是「宿主提供才有」的可选服务 ----
  /** 宿主配置服务：读写 profile 的 cordis.patch.yml。 */
  settings?: {
    documentPath?: string;
    describe(options?: { redactSecrets?: boolean }): Array<{ ns: string; revision: number }>;
    update(ns: string, patch: Record<string, unknown>, revision: number): Promise<unknown>;
  };
  /** 系统提示词服务：注册一段随对话带上的插件说明。 */
  systemPrompt?: {
    section(section: { name: string; order: number; text: string | ((context: unknown) => string) }): unknown;
  };
  /** 会话工作目录服务：成片默认落盘的位置由它决定。 */
  workingDirectory?: {
    ensure(agent: unknown, signal?: AbortSignal): Promise<string | undefined>;
  };
}
