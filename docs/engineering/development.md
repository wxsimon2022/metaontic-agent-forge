# 开发与发布

以下命令均在仓库根目录执行。开发前阅读 [维护经验](./SKILL.md) 和 [双平台兼容规范](./platform-compatibility.md)。仅在用户明确要求发版时执行发布。

## 本地开发热加载

Harness 默认启用 HMR 配置重载，但不监听本地插件源码。对于链接源码目录的安装，可在对应 profile 的 `cordis.patch.yml` 中配置 `hmr` 条目，监听已构建的宿主入口：

```yaml
- id: hmr
  disabled: false
  config:
    base: /你的路径/metaontic-video
    root: [index.js]
```

`base` 使用本机插件目录绝对路径，仅配置在本机 profile，不写入插件发布配置。已有 HMR 配置时合并调整，保留其他项目的监听需求。配置由运行中的宿主加载；之后修改 TypeScript 并执行 `npm run build`，宿主入口热替换，客户端通过宿主 Client HMR 更新。构建失败先修复，不通过重启解决语法错误。`package.json` 的依赖或加载入口变化可能仍需按宿主提示重新安装或重启；插件规则变化在现有对话的下一轮请求生效，旧确认窗口需重新发起。正在生成视频时先等任务返回，再构建或更新，避免热替换中断当前调用；已有任务按任务 ID 查询或续做，勿重复提交。

## 开发与验证

源码入口为 `src/index.ts`（宿主装配）和 `src/client.ts`（浏览器装配）；功能按职责拆分：

```text
src/
├── config.ts       # 配置定义、默认值与公共常量
├── tools/          # 生成、续拍、查询、环境检查、配置工具
├── providers/      # 渠道解析、Seedance 请求、网络轮询与结果类型
├── workflow/       # 分段规划、费用审批、暂停续做、执行信号
├── media/          # 参考图处理、下载、FFmpeg 与合成
├── prompts/        # 生成提示词与动态操作规则
├── utils/          # 校验、错误转换、文件、JSON 与日志
├── client/         # 设置、更新、进度、样式与界面字典
└── locale/         # 插件元信息字典
```

根目录 `index.js`、`client.js` 和 `locale/*.json` 是构建产物，修改 TypeScript 后重新构建。宿主源码中的本地模块统一打包进 `index.js`，浏览器模块统一打包进 `client.js`，插件安装与热加载入口保持不变。
元信息文案在 `src/locale/`，导演预设在 `cordis.patch.yml`，脚本与提示词指南在 `skills/video-director/`。

```bash
npm install
npm run build
node --test tests/*.test.mjs
npm pack --dry-run
```

`npm run build` 包含类型检查、文案生成和两端打包。测试覆盖模型时长、图片角色、配置保存、进度显示，以及当前接入的模拟生成、查询、暂停续做和续拍链路；模拟测试不调用付费服务，不能替代真实生成或界面验收。

## 发布规范

标签（tag）的附注和发行版（Release）正文仅包含版本标题及面向用户的“新增”“优化”，不写构建、测试、校验、CI、平台实测覆盖、未验证范围或宣传页同步等验证信息。所有验证结果与限制统一记录在 `docs/engineering/release-<版本>.md`；不得为调整说明强制覆盖已公开标签。

只有用户明确提出“发版”时才执行发布。平时开发、修复和验证不因改动完成而自动更新版本号、改写 `releaseNotes`、创建版本标签、推送发布或创建 Release 或上传发布包。

收到发版指令后，先以最近一次已发布版本为起点，检查此后的提交和当前工作区，汇总所有尚未发布的逻辑改动；按新增、优化整理成一份完整的更新内容（修复并入优化），先向用户展示，再核对源码、构建产物、README、CHANGELOG、`releaseNotes` 和标签说明一致，最后按下述步骤一次发版。不能只总结最后一次修改，也不能遗漏此前积累的未发布改动。

仅发布正式版，使用 `X.Y.Z` 并设置 `releaseNotes.prerelease: false`。两仓 Release、附注标签、说明及插件包须保持一致，不再提供预发布渠道。正式发布须汇总从最近正式版以来的全部变化，包括此前已验证的改动，不覆盖历史标签。

插件版本卡片只保留“检查更新”和更新到最新正式版。过滤草稿与预发布，仅远端版本严格高于本机时显示更新入口，二次确认后安装对应 Release 成品包；Gitee 不可用时仅尝试同版 GitHub 附件。不提供历史版本选择、同版本重装或降级，不回退默认分支，也不先卸载现有插件。

版本采用语义化版本号：修复用patch，新增兼容功能用minor，不兼容变更用major。

更新内容只展示**新增**与**优化**两类（修复并入优化，不单列一节），而且要短：整篇合计不超过 **100 字**（不含分类前缀），只写用户能感知的结论，不写实现细节、内部开关与提交记录；`scripts/release.mjs` 的 `notesFor` 会校验分类并按 `notesLength` 统计字数，出现修复分类或超限都直接失败，模板见 `docs/engineering/release-plan.example.json`。

每次发布必须：

1. 更新 `package.json` 的版本及 `releaseNotes`，其 `version` 必须与包版本一致，`items` 写用户能理解的变更；将 `CHANGELOG.md` 的未发布内容整理到对应版本，记录日期并同步完整更新说明。
2. 同步更新本地根目录 `MetaOnticVideo使用说明书.md`（Markdown、PDF 和配图不提交源码仓库），逐项核对本次全部变更涉及的配置、操作步骤、默认行为及常见问题，删除过时说明，确保指南与当前版本一致；指南里写死的 `.tgz` 成品地址（Gitee 与 GitHub 各一条）同步改为本次版本，发布脚本会校验不一致直接失败；指南仅面向用户使用，不得加入插件版本号、适用版本、版本更新内容、更新日志、发布说明或发布核对记录；配图也遵守此约定。适用版本和本次核对结果仅记录在 `docs/engineering/release-<版本>.md`，更新内容统一放在 CHANGELOG、README 的更新区及包内 releaseNotes。未完成指南同步不得发布。
3. 同步宣传页的最新安装地址：宣传页在服务端仓库 `MetaOnticVideoService/frontend/public/promo/index.html`，用户会照它复制 `.tgz` 地址，发版脚本会在打包前用 `scripts/sync-promo-address.mjs` 把上面的 Gitee 附件地址、`.tgz` 文件名、结构化数据与页脚版本号一并改为本次版本（用 `METAONTIC_PROMO_PATH` 指定路径，`--no-promo` 才跳过），并把结果写进发布记录的「验证」；找不到宣传页时脚本给出提示，必须手动同步。
4. 同步锁文件，构建并执行相关验证，检查打包清单，确认包含更新后的操作指南。
5. 提交源码、构建产物与说明。
6. 创建**附注标签（annotated tag）**，仅包含版本标题和用户可感知的新增、优化。
7. 默认只发 Gitee：推送分支和标签到 Gitee，由发布脚本用本地成品直接创建 Gitee Release、仅上传通用 `.tgz` 并核对附件；需要同步 GitHub、拿到双平台安装校验证据时，再给发布脚本加 `--both`，等 GitHub Actions 通过后上传两处附件。

标签说明统一格式如下；只保留本次适用分类；验证结果与限制仅写入工程发布记录：

```text
MetaOnticVideo v<版本>

新增
- 面向用户的新增能力

优化
- 行为或体验变化，含本次修复的问题

```

将说明保存到UTF-8文件，例如 `/tmp/metaontic-video-release.txt`，再执行：

```bash
# 将 <版本> 换成实际版本号
git tag -a "v<版本>" -F /tmp/metaontic-video-release.txt
git push origin master "v<版本>"
git show --no-patch "v<版本>"
```

当前 `origin` 配置有GitHub与Gitee两个推送地址；其他开发环境须自行核对 `git remote -v`，确保两边均已推送。
`v*` 标签会触发 GitHub Actions 构建插件包并上传到 GitHub Release。不要为补写说明强制覆盖已经公开的旧标签；从下次发布起采用附注标签。

### 插件包下载

版本包在 [GitHub Releases](https://github.com/wxsimon2022/metaontic-video/releases) 或 [Gitee Releases](https://gitee.com/hackloop/metaontic-video/releases) 下载，通用插件包为 `metaontic-video-<版本>.tgz`。Windows与Mac使用同一个 `.tgz`，不再发布ZIP；指南和PDF已包含在通用包中。不再向 npm 注册表发布，无需配置 `NPM_TOKEN` 或 Trusted Publishing。

`v*` 标签触发完整构建与测试，通过双平台安装检查后，使用 GitHub 自动令牌上传通用tgz。`--both`发布脚本再下载这个同一成品，用本地 `GITEE_TOKEN` 发布Gitee；CI未通过时不上传Gitee，不将单仓成功报告为双仓成功。手动运行工作流时须选择与包版本匹配的标签。

某次发布只补齐镜像时，手动运行 `sync-gitee` 工作流并填写对应标签；它从 GitHub Release 取回该版本的 通用 `.tgz`，逐个补传到 Gitee 发布页并核对大小，不会覆盖或改动已有附件。

Gitee 侧另有一条 Gitee Go 流水线（`.workflow/MetaOnticVideo.yml`）：向 `master` 推送、发起面向 `master` 的 PR 或推送 `v*` 标签时，在 Gitee 构建机上安装依赖、构建并运行单元测试，再校验版本元数据；每次运行都会打出成品并作为该次流水线的制品留存，可在 Gitee 的流水线运行结果页直接下载：`metaontic-video-<版本>.tgz` 总会生成，两平台使用同一个tgz，不再生成Windows ZIP。标签触发时还会核对 `v<版本>` 标签与 `package.json` 里的版本是否一致，不一致直接失败，保证成品按标签出。想在发版前演练一次按标签的流程，可以打以 `ci-` 开头的演练标签（如 `ci-test`）：它同样触发构建与打包，但跳过标签与版本的强校验，制品只作演练用。这条流水线只生成成品，不发布版本：GitHub 与 Gitee 的 Release 成品始终由 `publish` 工作流按 `v*` 标签产出，避免两处各打一份包导致成品不一致。流水线不依赖 Gitee 下拉里提供的版本：构建机上没有可用 Node 时，它会自己从 npmmirror 下载 Node 20（按 glibc 自动选择官方构建或 glibc 2.17 兼容版），并缓存到 `~/.local/node`；因此免费构建机即使镜像较旧也能跑通。

本机打包可执行 `npm pack --pack-destination /tmp`。需要目录安装时，将 `.tgz` 解压后使用其中的 `package` 目录：

```bash
mkdir metaontic-video-plugin
tar -xzf metaontic-video-<版本>.tgz -C metaontic-video-plugin
dsh plugin --profile desktop add "/你的绝对路径/metaontic-video-plugin/package"
```

### 推送后的更新总结规范

向用户汇报发布状态时可提供以下信息，其中“更新内容”须与 package.json 的 releaseNotes 和附注标签一致。验证、限制与发布状态仅用于汇报和工程记录，不得写入 tag 或 Release 正文：

```text
版本：vX.Y.Z
提交：短提交号
推送：GitHub / Gitee 各自是否成功，附注标签是否成功

更新内容（只列新增与优化，修复并入优化）：
- 新增：用户可以使用的新能力
- 优化：变化后的交互或行为

验证：实际执行的构建、测试和打包检查
限制：未进行的付费生成、界面验收等
发布状态：源码与标签已推送 / 打包工作流已触发 / Release插件包已验证
```

更新分类只有新增与优化两类，整篇不超过 100 字。未核实 Release 附件时不能写“插件包上传成功”；部分仓库推送失败时明确列出，不能笼统称全部成功。
发布前检查工作区差异，确认本次提交范围；完成后报告实际提交号。

### 定期清理历史标签与发行版（维护者）

历史版本会不断累积标签、Release 和发行版附件，插件只对外提供最新正式版，因此可以定期回收旧版本。清理脚本同时处理 GitHub 与 Gitee，先演练、后删除：

```text
npm run clean:releases
npm run clean:releases -- --apply
```

默认只打印清理计划，加 `--apply` 才真正删除；发行版与标签各保留最近 5 个，演练标签等不符合 `v*` 模式的标签默认忽略。常用参数：

- `--keep <n>`：保留最近 n 个正式版发行版，默认 5；小于 1 会被拒绝。
- `--keep-tags <n>`：保留最近 n 个标签，默认与 `--keep` 相同；两条保留线取并集，避免只推过标签没建发行版的版本被误删。
- `--max-age-days <n>`：只清理 n 天以前发布的版本，新版本本次不动，适合先小步试跑。
- `--patterns 'v*,ci-*'`：参与清理的标签模式，默认 `v*`；加 `ci-*` 可一并回收演练标签。
- `--keep-prerelease`：额外保留最新的预发布，默认连同其他预发布一起删除。
- `--prune-assets`：删除保留版本里不属于该版本的残留附件（例如旧命名或手动上传的文件），执行前会重新读取远端实际列表。
- `--host github|gitee|all`：只清理其中一个仓库，默认两个都清理。
- `--json`：以 JSON 输出计划，便于日志归档。

不管参数怎么配，最新正式版、当前 `package.json` 版本、以及 README、使用说明书、CHANGELOG、工程经验里 `.tgz` 下载地址引用过的版本都会保留，避免现成链接失效；演练会同时给出预计释放的附件体积，便于对照 Gitee 配额。

删除顺序是先附件、再 Release、最后标签，两个仓库与本地同名标签同步处理；单个仓库缺发行版时只删标签。待删标签默认取 GitHub 与 Gitee 标签接口的并集，不依赖本机 SSH；显式传 `--remote <名称>` 时再补充该 Git 远端标签，只在 Gitee 推过的标签同样进计划。GitHub 标签用 `gh api` 删除；Gitee 开放接口只有标签的读取与创建、没有删除端点，所以 Gitee 标签靠带 `GITEE_TOKEN` 的 HTTPS 推送删除引用（令牌只从环境变量读取，不进入命令行与日志）。脚本只删除计划内的对象，失败项会汇总后非零退出，可重复执行。

需要长期无人值守时可启用 `.github/workflows/clean-releases.yml`：它每周运行一次，默认只演练；在仓库变量里设置 `CLEANUP_APPLY=true`（或手动运行工作流并勾选 apply）才会按同一计划删除，`keep` 可在手动运行时指定。Gitee 的读取、删除以及标签的 HTTPS 推送删除都需要 Actions Secret `GITEE_TOKEN`，GitHub 侧使用工作流自带令牌。

## 请求日志

创建与查询视频任务会写入 `~/.dsh/logs/metaontic-video/YYYYMMDD/requests.jsonl`（目录日期使用本机时间；设置 `DSH_HOME` 时跟随该目录）。
每次请求都有独立 `requestId`，记录开始、完成或失败事件，以及接入方式、模型、时长、素材数量、HTTP状态、耗时、任务ID和上游请求ID（接口提供时）。
统计 `operation=create_task` 且 `event=request_started` 可核对插件尝试提交的次数；`query_task` 只表示查询，不能算新增生成。
开始后没有结束日志可能是进程退出；网络错误也不能证明上游未受理，先复查任务与上游记录。
日志不记录 API密钥、请求体、完整提示词、Base64或签名视频链接。日志按日保留，未自动清理。

## 独立浏览器样式预览

运行 `npm install` 后，执行 `npm run preview`，打开 <http://127.0.0.1:4174>。
直接复用 `src/client.ts` 的设置页与生成进度卡片，修改源码后浏览器自动刷新，无需安装插件或重新构建。

顶部可切换MetaOntic AI、火山直连、请求失败场景，以及明暗主题、宽窄屏和中英文；可模拟保存失败。进度卡片支持生成、延长、成功与失败状态。
配置快照方便核对交互，刷新后恢复模拟初始值。所有请求均由预览页拦截，不连接真实服务、不生成视频、不写入 Harness 配置；请使用模拟 API密钥。
主题变量模拟宿主环境，最终样式仍以 Harness 中实际呈现为准。
可用 `PREVIEW_PORT=4175 npm run preview` 更换端口。

普通更新提示：打开插件设置页时后台检查新版本，发现更新后在顶部提示，可选择“立即更新”或“稍后再说”。安装前仍需确认；稍后处理不影响继续使用，同一版本不再显示顶部提醒，底部版本卡片仍可更新。手动“检查更新”可重新显示提醒，更高版本出现时再次提示。更新检查不会自动安装或限制生成。

### 安装与运行依赖

插件宿主入口已打包所需Schema库及运行依赖，成品包无需额外安装运行时npm依赖。曾配置本地开发HMR时，须将加载目标恢复到当前已安装插件目录；安装新包不会自动删除用户自行配置的本地加载覆盖。第三方许可见[THIRD_PARTY_NOTICES.md](../../THIRD_PARTY_NOTICES.md)。

角色图选择在需求阶段由video_project记录到项目；同项目改提示词、时长或清晰度不重复问，新项目重新选择。空镜跳过，已有图片直接审核素材。视频提交前只核验既有选择和本版脚本审核；取消或未答不默认同意。

角色参考图风格建议依次为真人写实、二维动画、卡通、插画；文生角色图可显式设置characterType=realistic生成真人写实。默认沿用非真人类型，真人限制转换仍只用非真人风格；所有出图均需费用同意及结果审核，上游拒绝不自动重画。

开发与发布需遵守[Windows/macOS兼容规范](../../docs/engineering/platform-compatibility.md)。上传正式版前必须通过双平台成品安装检查；自动检查不替代桌面GUI实机验证。

更新前会核对实际安装来源。本地目录链接安装会停止直接在线替换；来源未知或元信息异常也停止，不清目录或配置。tgz成品与仓库安装继续支持在线更新。旧目录已空需先恢复完整内容，不能靠重复点击更新修复；此前已失效或被错误迁移的加载路径仍需单独核对。

### 一键发布脚本（Windows / Mac）

首次在开发环境安装 Node.js、Git、GitHub CLI、Python 3，并执行 `gh auth login`；两个仓库的推送权限及 GitHub Actions 的 `GITEE_TOKEN` 需先配置好。它们仅用于开发发布，插件用户不需要安装。

发布前把 [说明模板](../../docs/engineering/release-plan.example.json) 复制为根目录 `release-plan.json`，填写本次**全部尚未发布**的更新条目及具体指南核对结果，删除占位文字。同步使用说明书、配图和 PDF。此本地计划文件不会提交到仓库。

只检查计划、不修改文件或发布：

```text
npm run release -- 3.13.3 --dry-run
```

也可双击根目录 `release.cmd`（Windows），或双击 `release.command`（Mac；也可运行 `bash release.command`），按提示输入版本号。它们会执行正式发布，不是预览；需要先准备好 `release-plan.json`。

一键正式发布（示例版本号需改为实际目标）：

```text
npm run release -- 3.13.3
```

脚本显示待发布范围与说明，更新版本、锁文件和发布元数据，构建、测试、打包、创建提交及附注标签，推送仓库（默认只推 Gitee，加 `--both` 时与 GitHub 并行推送、各自失败退避重试三次），然后用本地成品直接创建 Gitee Release 并上传核对通用 `.tgz`；带 `--both` 时还会等待 GitHub Actions 的双平台安装/升级检查与附件上传，最后输出发布页及 `.tgz` 安装地址。使用说明书不写入版本记录。失败立即停止，不强推或覆盖旧标签。

发布文件已提交但上传中断时，保留同一版本续跑：

```text
npm run release -- 3.13.3 --resume
```

也可指定 `--notes /你的实际路径/说明.json`、`--branch master`、`--both`、`--github https://github.com/wxsimon2022/metaontic-video.git`、`--gitee https://gitee.com/hackloop/metaontic-video.git`。默认只发 Gitee，`--both`（或带地址的 `--github`）才同步 GitHub，默认使用当前仓库的 SSH 443 地址；Gitee 发布需要环境变量 `GITEE_TOKEN`，Gitee 目标与当前 CI 镜像配置绑定，修改项目归属前需同步 CI，不会静默发布到其他仓库。

脚本依赖事先写好的完整说明，不能自动判断业务变化或代替指南审核。推送或上传中断时会明确报告未全部完成，使用 `--resume` 重试，不要重新递增版本；默认的仅 Gitee 发布不含 GitHub 双平台安装校验，缺少 Windows 实测证据时要在发布记录里写明。

### 测试包（发给他人试用，不进发布页）

要验证还没发布的改动时，用测试版版本号打一个包，脚本会自动构建、跑测试、打出 `.tgz`、上传到线上目录，再核对线上包与本地一致：

```text
npm run pack:test -- 3.13.9-test.1
```

版本号必须是 `X.Y.Z-后缀` 形式，核心版本号压在当前正式版之下；只改包内版本号，不提交、不打标签、不建 Release，因此不影响其他人的正式版，测试者之后仍会收到下一次正式版的更新提示。脚本结束后会把 `package.json`、锁文件和构建产物还原成正式版本。

上传完成后直接给出安装地址，形如 `https://video.mybfs.cn/test/metaontic-video-3.13.9-test.1.tgz`，发给测试者粘进「插件 → 添加插件」即可；目录页 `https://video.mybfs.cn/test/` 可看到历史测试包。加 `--no-upload` 只出本地包，用 `--out <目录>` 换输出目录；上传目标可用 `PACK_TEST_SERVER`、`PACK_TEST_DIR`、`PACK_TEST_URL` 覆盖。该目录由 moyubang 仓库的 `deploy/nginx/video.mybfs.cn.conf` 提供，刻意放在代码部署目录之外，`deploy.sh` 的 `rsync --delete` 不会清掉已上传的测试包。测试者用正式版 `.tgz` 地址重装即可回到正式版。

### 同步已发布正式版到 GitHub

同步使用原版本和 Gitee 已发布的通用 `.tgz` 成品，不重打包。publish.yml 的手动输入 existing_version 指定版本，同时传入原成品 existing_sha256，核对tgz原字节校验值与包版本，再执行 Windows/macOS 安装检查，全部通过后发布 GitHub；说明从结构化 releaseNotes 生成，不读取旧标签中的验证信息，不回写 Gitee 附件。README 首页仅保留在线安装链接，发版时同步至目标成品地址。

正式版和测试版仅提供 Windows/macOS 通用 `.tgz` 成品，不再生成或上传 Windows ZIP 及 `.zip.sha256`；Windows 与 macOS 仍须验证同一 `.tgz` 的安装与升级。历史已发布 ZIP 保留，避免旧链接失效。README 与宣传页仅展示在线安装，不推荐下载解压或目录安装。
