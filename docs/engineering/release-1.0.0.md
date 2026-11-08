# v1.0.0 发布核对

实际基线：74899f4e940ded99dc1080bd4698d33d841d881f。

MetaOntic Agent Forge v1.0.0

新增
- 总控调度专业助手，支持任务关系查看与成果汇总。

优化
- 修复设置保存与总控入口兼容问题，补齐专业助手消息回传。

验证
- 本地构建及测试通过。
- 本条按仅 Gitee 发布处理：未运行 GitHub 双平台 CI，也没做 Windows 桌面实测，Windows 兼容性只有构建与打包层面的保证。
- 宣传页安装地址已同步为 v1.0.0（/Users/simon/Documents/my_python/MetaOnticVideoService/frontend/public/promo/index.html，属服务端仓库，需在那里提交并部署）。
- 桌面GUI与付费调用未由发布脚本自动验证。

指南核对：逐项核对总控白名单委派、专业助手回传、任务关系查看、设置保存/切换/重置、原任务审核及续做；本地指南补充回传说明并重新生成PDF，MD/PDF纳入成品且不提交源码仓库。实际Harness 0.2.2原生控制模块与Cordis验证消息工具名称、原生标记、参数及卸载清理；439项测试通过。临时profile安装与升级在提交前执行，不修改真实桌面安装。未覆盖真实LLM协作与付费视频链路、Windows桌面；仅Gitee发布不运行GitHub双平台CI，Windows只有构建与打包层面的保证。按用户删除远端旧发行版与标签后的指令重发1.0.0，保留旧提交历史。
