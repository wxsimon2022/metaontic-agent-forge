# v3.18.1 发布核对

实际基线：v3.18.0。

MetaOnticVideo v3.18.1

优化
- Windows 与 Mac 统一使用通用成品在线安装。

验证
- 本地构建及测试通过。
- 本条按仅 Gitee 发布处理：未运行 GitHub 双平台 CI，也没做 Windows 桌面实测，Windows 兼容性只有构建与打包层面的保证。
- 宣传页安装地址已同步为 v3.18.1（/Users/simon/Documents/my_python/MetaOnticVideoService/frontend/public/promo/index.html，属服务端仓库，需在那里提交并部署）。
- 桌面GUI与付费调用未由发布脚本自动验证。

指南核对：核对通用tgz在线安装和可选本地文件安装：删除Windows ZIP推荐及Mac目录安装推荐，统一两平台安装路径；README中英文及宣传页仅保留在线安装。同步说明书PDF与当前成品地址，现有配图为通用安装示意不含版本记录。发布只上传tgz，本次仅发Gitee，不运行GitHub双平台CI；本机macOS成品安装检查通过，Windows只有构建与打包层面的保证，未做桌面实测；tag和Release仅展示用户更新，验证细节留在工程发布记录。线上宣传页已完成静态部署与源码字节核对，浏览器安装及逐段结果/下一段费用确认流程通过。
