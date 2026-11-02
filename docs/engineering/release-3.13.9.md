# v3.13.9 发布核对

实际基线：v3.13.8。

MetaOnticVideo v3.13.9

优化
- 使用说明书、README 与 Windows 压缩包教程统一写明在线安装只认以 .tgz 结尾的成品附件地址，并给出本版本可直接复制的 Gitee 与 GitHub 地址；MetaOnticVideo-Windows 压缩包、解压出的 package 文件夹、发布页网址和 Source code 只能用于本地安装，粘贴到在线安装框会提示「不是有效的插件包」。
- Windows 压缩包图文教程第 4 步同步补充在线安装地址要求，图文版与文本版内容一致；使用说明书 PDF 重新导出后随包发布。

修复
- 安装报 ERR_PNPM_MISSING_TARBALL_INTEGRITY（提示 lockfile 记录缺少 integrity 字段）时，换在线地址、换本地 .tgz 路径或重装旧版本都会一样失败；使用说明书、README 与 Windows 压缩包教程新增处理方法：完全退出 DeepSeek Harness，删除插件安装目录下的 pnpm-lock.yaml 后重新安装，安装器会重建该文件，已保存的插件设置不受影响。
- 在线安装填入 ZIP、package 文件夹、发布页网址或 Source code 时只提示「不是有效的插件包」，用户难以判断原因；三处文档现在都写明只认以 .tgz 结尾的附件地址，并给出可直接复制的真实地址。

验证
- 本地构建及测试通过。
- Windows/macOS成品安装及升级为CI上传前置条件。
- 桌面GUI与付费调用未由发布脚本自动验证。

指南核对：本次改动涉及 Windows 在线与本地安装的地址要求和两类安装报错：使用说明书 1.2 节第 3 步、1.3 节「直接粘贴成品地址」段与第 5 节故障排查表补充「在线安装的地址必须以 .tgz 结尾」，第 5 节新增「安装报 ERR_PNPM_MISSING_TARBALL_INTEGRITY」小节，写明退出 Harness、删除插件安装目录 pnpm-lock.yaml、重新安装的步骤与「只删该文件、不动 package.json」的注意事项；1.3 节写死的 Gitee 与 GitHub 两条成品地址同步改为本版本。Windows 压缩包图文教程的地址要求与常见问题、README 安装说明与常见问题同步更新并保持一致。指南其余配置项、操作步骤、默认行为与常见问题逐条核对后无变化；指南不含版本号、更新日志与发布核对记录，Markdown 与重新导出的 PDF 内容一致并随包发布。
