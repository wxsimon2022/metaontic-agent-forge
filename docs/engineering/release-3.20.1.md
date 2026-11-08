# v3.20.1 发布核对

实际基线：v3.20.0。

MetaOnticVideo v3.20.1

优化
- 鉴权异常提供设置检查与客服入口，不再直接判定密钥无效；视频接口401/403准确提示鉴权失败。

验证
- 本地构建及测试通过。
- 本条按仅 Gitee 发布处理：未运行 GitHub 双平台 CI，也没做 Windows 桌面实测，Windows 兼容性只有构建与打包层面的保证。
- 宣传页安装地址已同步为 v3.20.1（/Users/simon/Documents/my_python/MetaOnticVideoService/frontend/public/promo/index.html，属服务端仓库，需在那里提交并部署）。
- 桌面GUI与付费调用未由发布脚本自动验证。

指南核对：以v3.20.0为基线核对全部未发布变化：聊天AUTH错误通过宿主官方keyed slot显示友好提示并引导Harness模型设置，其他错误委托原组件；视频401/403保留provider_auth和HTTP状态、引导插件设置与客服，不回显上游鉴权错误。指南补充区分模型连接与视频接口鉴权的排查步骤，在线安装地址同步本版，PDF重建；不写版本更新、发布或核对记录。406项模拟测试与宿主9工具Schema通过；本机已安装并触发重载，实际鉴权错误界面尚未复现、未调用付费API。默认仅Gitee发布，未运行GitHub双平台CI，Windows只有构建和打包层面保证，未做Windows桌面实测。
