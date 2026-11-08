<img src="./logo.svg" width="240" alt="MetaOnticVideo" />

# MetaOnticVideo

[English](./README.en.md) · [Gitee](https://gitee.com/hadlooop/metaontic-agent-forge) · [GitHub](https://github.com/wxsimon2022/metaontic-agent-forge)

DeepSeek Harness 视频创作插件：**新手快速上手，低成本制作长视频。**

## 新手快速上手视频创作

不用先研究提示词或剪辑流程，把想拍的内容说出来，跟着助手完成第一条视频。

1. **说想法**：一句灵感或完整创意都可以，助手帮你整理；需要完善时沿着你的原意补充。
2. **看脚本**：先看懂要拍什么，再用口语提修改意见，满意后确认制作。
3. **看结果**：生成后直接预览，完成的视频保存到本机。

例如：“帮我做一条30秒竖屏720P的视频，表现清晨湖面的宁静。”已写明的时长、横竖屏和分辨率直接沿用，只询问缺失信息。

## 低成本长视频生成方案

通过 **分段生成 → 逐段续拍 → 本机合并**，把超过模型单段上限的创意做成长视频。

- 每段先看结果，确认后再续拍下一段，按段推进制作。
- 已完成的分段保留复用，可以暂停后接着做，避免从头重复生成。
- 全部分段完成后，用 FFmpeg 在本机合并，原始分段一并保留。

需要自行配置 API密钥；图片与视频按渠道实际用量计费，每段新增生成前确认费用。

## 在线安装

在 Harness「插件 → 添加插件」中粘贴在线安装链接。Windows 与 macOS 使用同一个成品。

Gitee：

```text
https://gitee.com/hackloop/metaontic-video/releases/download/v3.20.2/metaontic-video-3.20.2.tgz
```

GitHub 同版备用：

```text
https://github.com/wxsimon2022/metaontic-video/releases/download/v3.20.2/metaontic-video-3.20.2.tgz
```

安装后打开插件设置，选择 **MetaOntic AI**，填写 API密钥并保存；在会话中选择 **视频创作助手** 开始。制作产品、品牌或活动内容时，也可选择 **宣传视频助手**。这两个助手使用相同的制作流程。需要由总控分配任务时，选择 **云智工坊 · 智能体平台**；它只委派给上述专业助手，完成后汇总成果，视频仍按原流程审核和确认费用。标准模式保持通用用途。

[在线使用说明](https://ai.mybfs.cn) · [问题反馈](https://github.com/wxsimon2022/metaontic-agent-forge/issues) · [完整更新记录](./CHANGELOG.md) · [开发说明](./docs/engineering/development.md)

## 插件架构

Agent 声明业务依赖，公共框架负责装配；云智工坊负责统筹，两个专业助手共用视频业务。新增业务可独立接入，不必修改视频制作流程。

```mermaid
flowchart TB
    Harness[DeepSeek Harness]
    Harness --> Host["宿主入口 src/index.ts"]
    Harness --> Client["浏览器入口 src/client.ts"]
    Studio["云智工坊 · 智能体平台"] -->|白名单委派，限一层| Director["视频创作助手"]
    Studio -->|白名单委派，限一层| Promo["宣传视频助手"]
    Studio --> Agents["Agent 定义 src/agents"]
    Director --> Agents["Agent 定义 src/agents"]
    Promo["宣传视频助手"] --> Agents
    Agents --> Core["公共框架 src/core<br/>Agent 与工具注册 · 作用域 · 生命周期"]
    Host --> Core
    Core --> Video["视频业务 src/businesses/video<br/>项目审核 · 生成续拍 · 恢复交付"]
    Video --> Providers["图片与视频接口"]
    Video --> Media["本机下载与 FFmpeg 合并"]
    Client --> UI["公共界面 src/client<br/>业务装配 · 设置组合 · 更新"]
    UI --> VideoUI["视频业务界面<br/>设置 · 进度 · 媒体预览"]
```

[目录结构与新增 Agent / 业务接入方式](./docs/engineering/structure-refactor.md)


许可见 [LICENSE](./LICENSE)。
