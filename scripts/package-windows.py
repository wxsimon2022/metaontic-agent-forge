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
steps = '''MetaOnticVideo Windows 安装教程

1. 先安装并打开 DeepSeek Harness 桌面端。
2. 右键本 ZIP → 全部解压。不要在 ZIP 预览窗口中操作。
   包内包含 metaontic-video-VERSION.tgz 成品文件及 package 资料目录。
3. 打开 DeepSeek Harness → 插件 → 添加插件，填写 .tgz 文件的完整本地路径，例如：
   D:\\software\\MetaOnticVideo-Windows\\metaontic-video-VERSION.tgz
   实际路径以解压位置为准。不要填 ZIP、发布页面地址、package 文件夹或 index.js。
   安装器读取 .tgz 后把插件安装到自身管理目录，避免直接链接外部解压目录。
4. 按提示安装并启用，进入已安装插件 → MetaOnticVideo → 查看。
   只有软件明确提示需要重启时才重启。
5. 打开 https://ai.bileego.com/ 注册、登录并获取 API Key。
   在插件中选择 MetaOntic AI，填写 Key、选择视频与图片模型并保存。
   共用 Key 时，该 Key 必须同时具备两个模型权限；关闭共用则分别填写。
6. 新建会话，将模式切换为“视频创作助手”。描述内容、时长、画幅，
   确认 480P 或 720P，审核脚本与分镜后，再单独确认制作与费用。

重要说明
• 这是插件安装资料包，需配合 DeepSeek Harness 使用，不是独立 EXE。
• 本地 .tgz 安装不需要从 Gitee/GitHub 拉取代码；生成视频仍需要联网。
• package 目录用于阅读图文资料和恢复旧目录，不作为推荐安装来源。
• 本包不包含账号或 Key。生成图片、视频可能计费，调用前需确认。
• 多段视频本地合并需要 ffmpeg / ffprobe，可让助手先检查环境，
  在你同意后安装；它们不包含在本 ZIP 中。

常见问题
• ERR_PNPM_GIT_RESOLVE_FAILED：检查是否仍使用旧 Git 来源。
  本次添加应指定本地 .tgz 文件，而不是 git+https 地址。
  无需全局 Git 重写、SSH 密钥或关闭供应链策略。仍失败请保留完整错误。
• 提示找不到 dsh 命令：优先使用桌面端插件界面，不需要为此安装全局 CLI。
• 没有视频创作助手：确认插件已启用，再打开会话模式列表。
• 找不到模型或鉴权失败：核对 Key 的余额及所选模型权限，保存后再检查。
• 更新插件时先等待当前视频任务结束；不要删除任务记录或重新提交已付费任务。

更多图文步骤：打开 package/MetaOnticVideo使用说明书.pdf。
可选命令行（仅在本机已有 dsh 命令时）：
dsh plugin --profile desktop add "D:\\software\\MetaOnticVideo-Windows\\metaontic-video-VERSION.tgz"
'''
steps = steps.replace('VERSION', version)
steps += '\n旧安装目录变空/locale缺失：先将本包完整package目录恢复到原安装路径，使package.json、index.js、client.js、locale及skills等文件恢复。不要重置Key或删除配置。之后核对插件当前版本及更新状态；若需改为tgz安装，使用软件支持的安装/修复入口，提示已安装时不要直接卸载，请保留错误进一步排查。\n'
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
body = '<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>Windows 安装教程</title><style>body{max-width:900px;margin:40px auto;padding:0 24px;font:17px/1.85 "Microsoft YaHei",sans-serif;color:#233143}img{max-width:100%;height:auto}pre{white-space:pre-wrap;font:inherit}a{color:#15649b}</style><img src="package/logo.svg" width="300" alt="MetaOnticVideo"><h1>Windows 安装教程</h1><pre>' + html.escape(steps) + '</pre><h2>插件安装流程</h2><img src="package/docs/guide/install.svg" alt="插件安装流程"><h2>共用 Key 配置</h2><img src="package/docs/guide/models-shared.png" alt="共用 Key 配置"><h2>分别填写 Key</h2><img src="package/docs/guide/models-separate.png" alt="分别填写 Key"><p><a href="package/MetaOnticVideo使用说明书.pdf">打开完整使用说明书 PDF</a></p></html>'
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
    add('先读我-Windows安装教程.txt', steps.encode('utf-8-sig'))
with zipfile.ZipFile(out) as check:
    assert check.testzip() is None
    assert len(check.namelist()) == len(files) + 3
    for name, data in files.items():
        assert check.read(f'{folder}/{name}') == data
sha = hashlib.sha256(out.read_bytes()).hexdigest()
out.with_suffix('.zip.sha256').write_text(f'{sha}  {out.name}\n')
print(json.dumps({'file': str(out), 'bytes': out.stat().st_size, 'sha256': sha, 'plugin_files': len(files)}, ensure_ascii=False))
