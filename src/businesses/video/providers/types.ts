/** providers/types：从宿主入口拆出的独立职责模块。 */


/**
 * 子进程 / 下载 / 合并这几个辅助函数共用的可选参数。
 * 用显式类型（而不是 `{}` 默认值）才能让 `signal` 这类可选字段被认出来。
 */
export interface RunOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
  binary?: string;
  /** 走 shell 执行（安装命令要在 shell 里展开 PATH、参数与管道）。 */
  shell?: boolean;
}

/** 一次任务跑完的结果（上游是动态 JSON，这里只声明我们会读的字段）。 */
export interface TaskResult {
  taskId?: string;
  submissionId?: string;
  status: string;
  videoUrl?: string;
  error?: string;
  errorCode?: string;
  model?: string;
  convertedReferences?: Array<{ role: string; imageUrl: string }>;
}
