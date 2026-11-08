# GitHub 同步核对

同步版本：v3.20.1；原始发布提交：92f628e51c6d2b9a94e78b7d7062f7b4f071be50。

Gitee 首次发布时未运行双平台CI的记录仍保留；本次补充了GitHub镜像发布验证。

- 将原提交和附注标签同步到GitHub，未覆盖已有标签。
- 取消标签推送自动重新打包的任务，使用workflow_dispatch复用Gitee原始tgz。
- 固定成品SHA256：8f369919c63f006d4d1f5f41580a37d793f74efa0f575e77c11c204d4a32b6f6。
- [发布工作流](https://github.com/wxsimon2022/metaontic-video/actions/runs/42437511295)的prepare、Windows安装、macOS安装及Release发布均通过。
- 两平台使用同一tgz做严格依赖安装与旧包升级，核对配置/任务保留、中文空格路径、资源和安装来源移动。自动检查不等于桌面实机验收，本次未做Windows桌面和付费视频验证。
- 标签与Release只保留面向用户的优化说明，验证信息仅记于此。

社区可发现性：补充官方建议的dsh-plugin Topic，更新GitHub简介和中英文README。Discussions草稿仅保存在.local/community，不随包发布；尚未向官方发帖，不宣称已被官方收录。
