# 内部实验：暂不对外开放

默认关闭，不对客户宣布，也不放入插件包的技能或操作指南。仅内部测试可在宿主进程环境中设置 `METAONTIC_VIDEO_INTERNAL_HYPERFRAMES=1` 后注册工具；普通对话不会自行启用。正式开放前另行评审。

# Hyperframes 本地渲染

用于 HTML/CSS 动效、数据图表、产品片头、字幕和已有素材编排。实拍画面仍可用 Seedance 生成后作为素材引入。两道确认（脚本审核、制作确认）同样适用；本地渲染无 Seedance 调用费用，外部素材生成费用另行确认。

1. 调用 `metaontic_agent_forge_video_hyperframes`，`action: "check"`。插件直接使用 Harness 运行时和随插件安装的 Hyperframes，不调用系统 npm/npx。运行时最低 Node 22.12；旧宿主提示升级 Harness。
2. 将项目保存到会话工作目录下 `video-projects/<slug>/hyperframes/`，入口为 `index.html`，素材放项目内并使用相对路径。完整脚本照常保存并展示。
3. 使用单个根合成，明确画布尺寸、总时长和轨道。媒体及可见元素标记 `class="clip"`、`data-start`、`data-duration`、`data-track-index`。单位为秒。下面是可直接渲染的静态标题示例：

```html
<!doctype html>
<html><head><meta charset="utf-8"><style>
html,body { margin:0; background:#101827; }
#intro { width:720px; height:1280px; position:relative; overflow:hidden; }
h1 { position:absolute; top:480px; width:100%; text-align:center; color:white; font:64px sans-serif; }
</style></head><body>
<div id="intro" data-composition-id="intro" data-no-timeline data-start="0" data-duration="3" data-width="720" data-height="1280">
  <h1 id="title" class="clip" data-start="0" data-duration="3" data-track-index="0">你好，世界</h1>
</div>
</body></html>
```

4. 动画必须支持按时间定位。GSAP 使用暂停的时间线，注册 `window.__timelines = { intro: timeline }`，键与合成 ID 对应；不要使用 setInterval、Date.now 或随机数驱动动画。GSAP 文件保存在项目内再引用，避免渲染依赖 CDN。参见 [官方动画示例](https://github.com/heygen-com/hyperframes#how-it-works)。
5. 调用 `action: "lint", projectDir: "video-projects/<slug>/hyperframes"`；修正错误后，在两道确认通过的前提下调用 `action: "render"`。可传 `fps`（24/25/30/50/60）和 `output`（项目内的 .mp4 路径）；默认输出有时间戳，不覆盖已有文件。渲染失败查工具输出，不重复提交 Seedance 任务。
6. 只有返回 `succeeded` 和 `videoPath` 才报告出片，展示该本地视频供用户验收。取消或超时后检查已有输出，不能把半成品当成完整成片。

首次渲染可能由 Hyperframes 下载 Chromium，需要网络与磁盘空间；也可使用其支持的 `HYPERFRAMES_BROWSER_PATH` 指定浏览器。FFmpeg/FFprobe 使用插件已有绝对路径配置，否则由 Hyperframes 从 PATH 查找。缺少 FFmpeg 时用 `metaontic_agent_forge_video_setup` 检查，安装仍按现有确认流程。check 的诊断包含语音、音乐等可选组件，缺少可选组件不代表基本 HTML 渲染不可用。
