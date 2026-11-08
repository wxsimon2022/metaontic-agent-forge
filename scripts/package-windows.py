"""Build a Windows-friendly ZIP from an existing npm pack; no dependency downloads."""
from pathlib import Path
import hashlib
import html
import json
import sys
import tarfile
import zipfile

root = Path(__file__).resolve().parent.parent
version = json.loads((root / 'package.json').read_text())['version']
source = Path(sys.argv[1]) if len(sys.argv) > 1 else root / '.local/windows' / f'metaontic-video-{version}.tgz'
out = Path(sys.argv[2]) if len(sys.argv) > 2 else root / '.local/windows' / f'MetaOnticVideo-Windows-{version}.zip'
folder = 'MetaOnticVideo-Windows'
steps = """MetaOnticVideo Windows 安装教程（先看这里）

你需要先打开 DeepSeek Harness。这个包是插件，不能当独立软件运行。

第1步：解压ZIP
右键下载的ZIP，选择“全部解压”。打开解压后的 MetaOnticVideo-Windows 文件夹。
不要在压缩包预览窗口里直接操作。

第2步：找到安装文件
找到 metaontic-video-VERSION.tgz。
只找这个文件，不用双击，也不用再次解压。package文件夹是说明资料和旧目录恢复用的。

第3步：复制这个文件的完整路径
右键.tgz文件，使用“复制文件地址”或“复制为路径”（名称以系统为准）。
如果没有该菜单，可复制文件夹地址，再在最后加上“\\”和.tgz文件名。
解压后常出现两层同名文件夹，所以完整路径可能是：
D:\\software\\MetaOnticVideo-Windows-VERSION\\MetaOnticVideo-Windows\\metaontic-video-VERSION.tgz
上面只是示例，盘符、层级和文件名都必须换成你电脑上的实际位置。
注意：安装框要的是文件路径，不是文件夹路径。选文件夹会提示“不是有效的插件包”。

第4步：粘贴到插件安装框
打开 DeepSeek Harness → 插件 → 添加插件。
把第3步的文件路径粘贴到安装地址输入框，再点击安装。
如果路径最前和最后有英文双引号，先删掉这两个引号，再点安装。
不要粘贴ZIP路径或发布网页地址，也不要填MetaOnticVideo-Windows文件夹或package目录。
在线安装（直接粘贴下载链接）只认以.tgz结尾的地址：本教程下面的两个地址就是.tgz结尾；
ZIP、package文件夹和发布页网址都不能当在线地址，填了会提示“不是有效的插件包”。
若界面提示“不是有效的插件包”，通常是填成了文件夹，请改填第2步的.tgz文件路径。
不想找本地路径时，也可以直接复制正式发布页里.tgz附件的下载链接粘贴安装，
本版本现成地址（可直接复制使用）：
Gitee：https://gitee.com/hadlooop/metaontic-agent-forge/releases/download/vVERSION/metaontic-video-VERSION.tgz
GitHub：https://github.com/wxsimon2022/metaontic-video/releases/download/vVERSION/metaontic-video-VERSION.tgz
两个地址内容相同，Gitee通常国内更快。要粘贴的是这种.tgz附件地址，
不是发布页网址，也不要选Source code源码包。

第5步：填写 API密钥并保存
打开 插件 → 已安装插件 → MetaOnticVideo → 查看。
选择 MetaOntic AI。没有 API密钥时，到 https://ai.bileego.com 注册并获取 API密钥。
填写 API密钥，选好视频和图片模型，再点保存。
两个模型共用 API密钥时，这把 API密钥需要同时支持两个模型；不共用则分别填写。

第6步：开始创作
新建会话，把会话模式改为“视频创作助手”。
描述视频内容、时长、横屏/竖屏，确认480P或720P。
先看脚本和示意图，再确认制作和费用。图片、视频调用会计费。

安装成功的样子
已安装列表里有MetaOnticVideo，能打开设置页，新会话能选“视频创作助手”。
只有软件明确提示需要重启时，才重启。

常见问题
• 为什么不是填package目录？目录也能安装，但属于本地链接。你遇到的旧安装更新问题就发生在这种方式。
  现在推荐填.tgz文件路径，让安装器管理文件。package用于看说明或恢复旧目录。
• 没有.tgz文件？可能拿到了旧ZIP。请从正式发布页下载.tgz成品，不选Source code。
• 无法识别地址？核对是否填成发布网页或ZIP；是否遗漏文件名；是否多了两端引号。
• 提示“不是有效的插件包”？安装框收到的是文件夹，不是插件成品。
  解压后的MetaOnticVideo-Windows文件夹和package资料目录都不是安装对象。
  请改填同目录下metaontic-video-VERSION.tgz文件的完整路径，注意复制的是文件。
• ERR_PNPM_GIT_RESOLVE_FAILED？说明仍在使用Git来源，请核对本次填写的是.tgz文件路径。
• ERR_PNPM_MISSING_TARBALL_INTEGRITY？插件安装目录里旧pnpm-lock.yaml缺少校验值，与成品包无关。
  完全退出软件，删除C:\\Users\\你的用户名\\.dsh\\profiles\\desktop\\pnpm-lock.yaml，再安装一次。
• 立即更新后原package目录空了/报locale缺失？先停下，不要反复更新。
  把本包完整package文件夹复制回错误提示的原路径，确保其中有locale/en.json和locale/zh.json。
  不要复制成package/package，不要只新建一个空locale文件夹，不要重置 API密钥或直接卸载。
  恢复后先核对实际安装来源；新版会拦截本地目录直接在线替换，不会自动迁移旧安装。
• 成品安装是否支持更新？支持在设置页“检查更新”。先等视频任务结束，再按提示处理。
• 多段视频合并提示缺工具？让助手检查ffmpeg/ffprobe，并在你同意后安装。

完整图文说明：package/MetaOnticVideo使用说明书.pdf。
本包不包含账号和 API密钥，生成时需要联网。
"""
steps = steps.replace('VERSION', version)
with tarfile.open(source, 'r:gz') as archive:
    files = {}
    for member in archive.getmembers():
        if not member.isfile():
            continue
        path = Path(member.name)
        if path.parts[0] != 'package' or '..' in path.parts or path.is_absolute():
            raise ValueError(f'Unsafe archive path: {member.name}')
        files[member.name] = archive.extractfile(member).read()
pkg = json.loads(files['package/package.json'])
assert pkg['version'] == version
assert not pkg.get('dependencies'), 'Windows package must have no runtime npm dependencies'
for name in files:
    assert 'node_modules/' not in name
    assert not any(word in name for word in ['价格对比', '计费参考', '比价视频'])
basic, faq = steps.split('常见问题', 1)
body = ('<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
        '<title>Windows安装教程</title><style>body{max-width:860px;margin:36px auto;padding:0 22px;font:17px/1.85 "Microsoft YaHei",sans-serif;color:#233143}'
        'h1{font-size:28px}h2{font-size:22px}img{max-width:100%;height:auto}pre{white-space:pre-wrap;font:inherit;overflow-wrap:anywhere}'
        '.tip{padding:16px 20px;background:#edf6ff;border-radius:10px;border-left:4px solid #2674bd}details{margin-top:30px;padding:18px;background:#f4f6f8}'
        'summary{cursor:pointer;font-weight:bold}a{color:#15649b}</style><img src="package/logo.svg" width="280" alt="MetaOnticVideo">'
        '<h1>Windows安装：照着这六步做</h1><p class="tip">先解压ZIP → 找到.tgz → 复制文件路径 → 粘贴到插件安装框。<br>新装填.tgz文件；恢复旧安装才复制package目录。</p>'
        '<pre>' + html.escape(basic) + '</pre><h2>安装操作示意</h2><img src="package/docs/guide/install.svg" alt="打开插件添加入口并填写安装地址">'
        '<h2>API密钥填在这里</h2><p>共用 API密钥：</p><img src="package/docs/guide/models-shared.png" alt="两个模型共用 API密钥的设置位置">'
        '<p>分别填写 API密钥：</p><img src="package/docs/guide/models-separate.png" alt="视频和图片分别填写 API密钥的位置">'
        '<details><summary>安装报错或旧目录空了？点这里</summary><pre>' + html.escape(faq) + '</pre></details>'
        '<p><a href="package/MetaOnticVideo使用说明书.pdf">打开完整使用说明书PDF</a></p></html>')

out.parent.mkdir(parents=True, exist_ok=True)
with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED) as target:
    def add(name, data):
        entry = zipfile.ZipInfo(f'{folder}/{name}', (2020, 1, 1, 0, 0, 0))
        entry.compress_type = zipfile.ZIP_DEFLATED
        entry.external_attr = 0o100644 << 16
        target.writestr(entry, data)
    for name, data in files.items():
        add(name, data)
    add(source.name, source.read_bytes())
    add('Windows安装教程.html', body.encode('utf-8'))
    add('先读我-Windows安装教程.txt', steps.replace('\n', '\r\n').encode('utf-8-sig'))
with zipfile.ZipFile(out) as check:
    assert check.testzip() is None
    assert len(check.namelist()) == len(files) + 3
    for name, data in files.items():
        assert check.read(f'{folder}/{name}') == data
sha = hashlib.sha256(out.read_bytes()).hexdigest()
out.with_suffix('.zip.sha256').write_text(f'{sha}  {out.name}\n')
print(json.dumps({'file': str(out), 'bytes': out.stat().st_size, 'sha256': sha, 'plugin_files': len(files)}, ensure_ascii=False))
