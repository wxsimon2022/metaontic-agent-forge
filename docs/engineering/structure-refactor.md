# 公共框架、业务与 Agent

## 依赖方向

`src/index.ts` 装配 `core/runtime.ts`、业务模块清单及 Agent 清单；`src/client.ts` 装配浏览器业务模块。`core/` 不导入 `businesses/` 或 `agents/`。业务可依赖公共能力，Agent 声明业务依赖并增加专题提示词。

```text
src/
├── core/
│   ├── runtime.ts            生命周期、模块装配、动态提示词
│   ├── agent-registry.ts     当前预设解析、Agent 依赖和上下文绑定
│   ├── tool-registry.ts      工具命名、业务隔离、计时与旁路统计
│   ├── settings/             公共配置、表单原子保存、多业务设置页组合
│   ├── telemetry/            异步队列、超时、有限重试
│   ├── installation/         安装目录锁文件修复
│   └── utils/                JSON、校验、日志与计时
├── client/                   浏览器模块装配、主题、更新、鉴权提示
├── businesses/video/
│   ├── index.ts              视频工具、观察器和费用卡口注册
│   ├── client.ts             视频界面装配
│   ├── config.ts             视频配置字段、常量及兼容读取
│   ├── client/               视频设置、进度、媒体预览与侧栏
│   ├── tools/                项目、生成、续拍、查询等工具
│   ├── workflow/             审批、分段、恢复、交付
│   ├── providers/            渠道与图片/视频请求
│   ├── media/                参考图、下载、FFmpeg、合并
│   ├── prompts/              视频规则、生成提示词、业务范围适配
│   ├── utils/                视频错误分类、输出目录与文件工具
│   └── internal/             隐藏的内部视频开发能力
└── agents/
    ├── cloud-studio/          总控定义、白名单与结果汇总规则
    ├── index.ts              Agent 清单
    ├── video-director/        视频创作助手定义
    └── promo-video/           宣传助手定义与专题提示词
```

## 新增同业务 Agent

1. 在 `src/agents/<id>/index.ts` 定义 `AgentDefinition`，声明 `id/name/businesses/skills/icon`，可选 `prompt(config)` 提供专题规则。视频 Agent 的 `businesses` 填 `['video']`，不用修改视频作用域判断。
2. 加入 `src/agents/index.ts` 的清单。
3. 同步 Harness 静态资源：在 `cordis.patch.yml` 添加独立预设；创建 `presets/<id>.js` 包装入口、`locale/presets/<id>/{zh,en}.json` 和图标；在 `package.json.exports` 添加预设、locale、icon 导出。同业务可复用现有 YAML 插件锚点，但独立 Agent 身份与 persona 必须符合自己的业务。
4. 需要新技能时在 `skills/<id>/` 添加。Agent 描述是框架清单，不会自动生成 Harness YAML、技能或包导出；这些静态资源仍须显式同步并通过安装检查。

当前宣传助手复用视频业务，只有 `agents/promo-video/instructions.ts` 提供专题规则。

## 新增不同业务

例如新增文章业务（仅说明接入方式，仓库尚未实现文章功能）：

```ts
// src/businesses/writing/index.ts
import type { BusinessModule } from '../../core/runtime.js';
export const writingBusiness: BusinessModule = {
  id: 'writing',
  prompt: () => '当前业务为文章创作。',
  apply(runtime) {
    runtime.tools.register('writing', {
      name: 'writing_outline', description: '整理文章大纲',
      execute: async args => ({ status: 'succeeded', outline: args.topic }),
    });
    // 观察器/服务注册后立即交给框架，注册中途失败也会清理。
    runtime.defer(runtime.ctx.on('session/event', () => {}));
  },
};
```

将新模块加入 `src/index.ts` 的 `businesses`，增加依赖该业务的 Agent。需要配置时，将业务字段加入 `src/config.ts`，字段不得与现有字段冲突；不可改动已有字段名称或命名空间。视频专属审批、时长、图片与分段规则留在视频业务，不提取成通用业务默认值。

浏览器模块提供 `create(require)`，返回 `inject` 和 `apply(ctx, { settings })`，加入 `src/client.ts` 清单。使用 `settings.register({ id, namespace, locale, Page })` 注册设置：同命名空间会组合展示，避免多个业务互相覆盖。通用表单保存用 `core/settings/state.ts`，业务独有校验和凭据规则保留在业务目录。其他界面槽的 key/id 也必须独立，不能占用视频槽。

工具名全局唯一，冲突会回滚已注册资源。Agent 只能执行其声明依赖的业务工具；可声明多个业务。标准模式和未注册的宿主预设保留原有手动工具能力，但不注入业务身份。视频卡口只约束视频依赖的 Agent，不会把视频的问答和创作范围施加给新业务。此机制是插件内的工具防误用边界，不代替宿主权限或付费确认。

## 保持兼容与验证

包名、两个宿主入口、预设 ID、配置字段、工具名、技能目录、任务目录和持久化格式保持不变。不迁移或重写用户已有任务。业务生命周期由框架逐项回收，单个清理函数失败不阻断其余资源；模块加载失败回滚已登记的工具与资源。

统计沿用现有服务端白名单契约；未知业务工具不会加入上报批次。新业务需要统计时，先同步插件和独立服务端的事件字段校验，不能直接发送创作内容或任意错误信息。

`tests/framework.test.mjs` 使用模拟的文章/电商业务验证工具和提示词隔离、动态模式切换、多业务组合、第三个视频 Agent 接入、重复定义、注册失败回滚、清理异常及设置页组合。原有视频模拟测试继续覆盖审核、暂停、恢复与交付。构建保持两端单文件，不增加安装时运行依赖。

Windows/macOS 沿用相同 Node 路径 API、构建入口和 `.tgz` 包。没有新增平台专用路径或命令。自动模拟与 macOS 成品安装检查不等于 Windows 桌面实测；不调用付费 API。用户可见操作不变，使用指南无需增加内部架构说明；版本号与 releaseNotes 不变，本次不发版。

## 本次核对

类型检查和构建通过，421 项模拟测试全部通过，实际 Harness 输出 Schema 校验覆盖无可选配置服务时的 9 个工具。macOS 临时 profile 成品安装检查通过，包含 strictDepBuilds、中文与空格路径、资源完整性、配置/任务哨兵保留及移动原包后仍可导入；升级检查使用从当前成品派生的 0.0.0 测试夹具，不是历史正式版成品升级或桌面 GUI 验收。未安装到真实本地 profile，未运行 Windows 实机或付费生成，未发版。

总控助手采用 Harness 原生任务机制，见 [云智工坊委派](./delegation.md)。
