"""成品包裁剪：把 .tgz 里的 package/README.md 去掉。

宿主（DeepSeek Harness）的插件页会把「安装目录里的 README」当成插件详细介绍渲染：
locale/<语言>.json 的 meta.detail 没有声明时，就按 README.md → readme.md →
Readme.md → README.markdown → README 找文档，找到就整篇显示，找不到才不显示。
所以想让插件页不出现这块内容，只能让装出来的包里没有这个文件（仓库首页的 README 不受影响）。

用法：python3 scripts/strip-package-readme.py <成品.tgz>
"""

import os
import sys
import tarfile

if len(sys.argv) != 2:
    raise SystemExit('用法：python3 scripts/strip-package-readme.py <成品.tgz>')

path = sys.argv[1]
if not os.path.isfile(path):
    raise SystemExit(f'未找到成品包：{path}')

DROPPED = 'package/README.md'
temp = f'{path}.tmp'
removed = False
with tarfile.open(path, 'r:gz') as source, tarfile.open(temp, 'w:gz') as target:
    for member in source.getmembers():
        if member.name == DROPPED:
            removed = True
            continue
        target.addfile(member, source.extractfile(member) if member.isfile() else None)
os.replace(temp, path)
print(f'成品包已裁剪 {DROPPED if removed else "（包里没有 README.md，未改动）"}：{path}')
