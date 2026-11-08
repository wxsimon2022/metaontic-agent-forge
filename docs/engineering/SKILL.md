---
name: metaontic-agent-forge-maintenance
description: 用于本仓库视频与图片接入、断点恢复、费用确认、清晰度设置、构建验证及发布维护；修改相关流程时读取并执行这些已验证约定。
---

# 项目维护经验

## 自主执行

用户已授权的开发和修复持续完成到构建、验证、文档同步，不反复询问例行实现选择。只有明确要求发版才发布，遵守根 AGENTS.md。开发授权不替代产品内付费处理同意、结果审核或环境权限。

## 接入与付费任务

- A/B 图片接入使用 Seedream 异步协议：POST `/v1/tasks/doubao`，GET `/v1/tasks/{id}`，GET `/v1/tasks/{id}/artifacts`；归一化 base 中的 `/v1`，查询不带通道。不恢复已验证不可用的同步备选。
- 图片模型当前只提供 `doubao-seedream-5-0-pro-260628`；旧型号 `doubao-seedream-5-0-260128` 已下线，读取时由 resolveImageModel 归一到 pro 版。图片参数使用 image 数组、2048x2048、n=1；真实能力以渠道验证为准。
- 仅明确真人限制触发转换。转换前获得同意并说明单独计费；转换完成展示全部参考图，再经用户核对确认后重试视频一次。普通审核、计价、鉴权、网络错误不得触发转换。
- 保存每张图片 taskId、结果、失败态以及转换/审核/视频重试阶段；先落盘后推进。恢复不重画已完成图片，不重置单次重试额度。保留首尾帧角色与精确原请求，包括本地图片归一化后的内容。
- POST 网络异常不能证明上游未创建任务。提交前持久化防重记录，结果不明返回 submission_unknown 并停住；经原渠道核对才能关联 taskId 或确认未创建后解锁。不要以换参数或清记录绕过防重。
- MetaOntic AI 图片默认共用视频 API密钥，关闭共用必须单独填写 imageApiKey，禁止缺失时回退。图片提交、轮询、取件及防重核对统一使用图片连接快照，视频凭据不受影响。
- API密钥路由必须用模拟 HTTP Authorization 验证：MetaOntic AI 共用/独立分别覆盖，火山仅用火山 API密钥；覆盖转换后视频重试、图片取件与异常提交核对，缺失时不得回退其他模型 API密钥。
- 每次调用固定配置快照，后续轮询不得混用新地址或 API密钥。密钥不写断点/日志，私有状态文件限制权限。
- 分段续做的审批文案必须先合并暂停记录 options，再解析清晰度；不得用仅含 resume 的原始参数回退到 720P。覆盖30秒480P两段流程，断言确认文案、估价与两次实际请求一致。
- 清晰度不在插件设置中配置；工具参数、实际请求、估价和恢复保持一致：480p/720p，脚本阶段须由用户明确选择480P/720P（本次需求已指定不重复问），记录到脚本、制作确认并显式传入工具。恢复已提交任务使用原请求参数。
- 对话边界：对话只做视频创作，无关话题不承接（一句话说明后请用户回到视频需求，不展开、不代办）；插件配置（接入方式、API密钥、模型、地址等）只能在设置页修改，`metaontic_agent_forge_video_config` 只读、`action=set` 直接拒绝并引导设置页，不索取/展示 API密钥。提示词、metaontic-agent-forge-video-director 技能、README（中英）与使用说明书同步维护；回归用例在 `tests/host-integration.test.mjs`、`tests/config-tool-save.test.mjs`、`tests/image-tasks.test.mjs`。

## 对白准确性

脚本审核前使用 metaontic-agent-forge-video-director/references/pronunciation.md：正确原文与发音文本分离，仅对读音明确的易错词用同音常用字，不猜专名、不全局替换。生成和前后延长都保留对白执行约束，不覆盖无对白或关闭音频的选择。预算按实际发声时间，完整句不跨段；验收必须试听，不能把任务成功等同读音正确。误读重做仍需费用同意，不承诺自动配音/口型修复。

## 验证与构建

- 优先检查已有测试并覆盖失败恢复、部分完成、提交不明、拒绝授权、结果审核、配置切换和清晰度估价；模拟接口测试不得发起实际付费调用。
- 执行 `node scripts/check-active-video.mjs`；有活动任务先等待，不构建或热替换。
- 执行 `npm run build`、`node --test tests/*.test.mjs` 和 `git diff --check`。工具注册、schema、客户端与构建产物同步；按根约定优先热加载。
- 配置保存遇宿主旧 revision 被拒时，仅在恢复后的待写字段未变化、可写且就绪时原子重试一次；其他拒绝保留草稿，不能无限重试或拆为逐字段写入。后台设备同步期间的保存需等待后继续，避免静默忽略首次点击；React 使用 useSyncExternalStore 订阅宿主配置。
- 同步 README、操作指南和相关内置技能的操作说明；普通开发不修改版本号、releaseNotes 或标签。
- 真实测试仅在用户授权范围内进行，区分实际覆盖的接入、模型和输入类型；不要把普通图片成功等同真人转换或完整视频链路验证。

## 发布经验

- 先比较最近发布到当前工作区的全部逻辑变化，展示完整说明，再按 README 发布；操作指南必须复核且纳入包；用户要求指南只面向使用，只讲选择 MetaOntic AI 的配置路线，不列其他接入方式，不写 A/B 标记、版本号、更新记录或发布信息；配图优先真实插件组件预览。核对结论及适用版本只写入 docs/engineering/release-<版本>.md，不写进指南或配图；发布时检查指南正文和配图，不得添加“适用版本”“本次更新”“发布核对”等章节。更新内容统一留在 CHANGELOG和 releaseNotes。
- CI checkout 后显式取回注解标签，再读取完整发布说明，避免 checkout 将标签覆盖为提交引用而只读出提交标题。
- Gitee 更新已有 Release 使用 PATCH，携带 tag_name；发布后核对 GitHub/Gitee 的说明与附件，不只看工作流绿色。
- 发布慢的主因是等 GitHub Actions（GitHub SSH 443 还常整段超时）；改成本地成品直传 Gitee 后，一次发版只剩本地构建测试打包约 3 分钟加三个附件上传，双仓并行推送也避免一仓超时拖累另一仓。GitHub Actions 只在--both时使用，作为双平台安装校验证据；仅 Gitee 发布的 Windows 缺口写进 release 文档。
- 测试包不进 Release：`npm run pack:test -- X.Y.Z-test.N` 会构建、跑测试、打 `.tgz`，直接上传 `https://video.mybfs.cn/test/` 并核对线上 sha256，最后还原包内版本号；版本核心号压在当前正式版之下，更新检查只读正式 Release，因此测试包不影响他人正式版，`--no-upload` 可只出本地包。线上 `/test/` 由 moyubang 仓库 `deploy/nginx/video.mybfs.cn.conf` 提供，目录放在部署目录之外，`deploy.sh` 的 `rsync --delete` 不会清理已上传包。
- Gitee Go 流水线 `.workflow/MetaOntic Agent Forge.yml` 只在 master 推送、面向 master 的 PR、`v*` 标签时做构建与测试校验，并打出 tgz 与 Windows ZIP（ZIP 依赖构建机 Python3，缺失时自动安装、仍失败则跳过并在日志提示）留作流水线制品（制品有保留期），不发版；GitHub/Gitee Release 成品统一由 GitHub Actions `publish` 产出，不在 Gitee 侧另打一份包。标签触发时用 `git describe --tags --exact-match` 核对标签与包内版本一致，不一致立即失败（取不到标签时只提示，不阻断）；`ci-` 开头的演练标签跳过该强校验，只演练不出发布件；脚本里变量后紧跟中文标点时必须写 `${VAR}`，否则 bash 会把全角标点并入变量名导致展开为空；构建机不保证自带 Node，命令里先探测常见安装路径，找不到就从 `cdn.npmmirror.com` 下载 Node 20（glibc 低于 2.28 时自动换 `node-unofficial-builds` 的 glibc-217 兼容版），并缓存到 `~/.local/node`，不依赖插件下拉版本；Gitee 免费构建机的 Node 版本字段因此只作占位。

API密钥共用规则：MetaOntic AI 可选择共用或独立图片 API密钥，关闭共用不得回退。

## 脚本审核费用对比

所有接入在写脚本时一并调用只读metaontic_agent_forge_video_estimate试算，将官方/插件两项基础估价写入script.md最后的“费用预估”一节并随脚本交付（不是脚本之前的前置步骤）；会话中展示脚本也在末尾展示本节，再弹审核窗，按实际分段计入上一段视频输入；手填 API密钥未核实分组按1，火山直连不套中转折扣。未知价目/画幅不猜价，最低用量补足未计入须注明。制作审批与账户额度预检保持独立，不能把本次一段价格当整条预算。用户另行生成的价格参考文档和宣传素材仍仅留本地，不纳入仓库或发布包。

- 版本卡片更新时间读取当前包releaseNotes.publishedAt（ISO时间，转换为UTC+8显示日期与时间，不附加时区字样），不得用检查时间、构建时间或远端其他版本时间代替；发版时同步真实发布时间，缺失则不显示。

## 实际费用（仅A/B）

完成后使用视频调用的连接快照和视频 API密钥查询/api/log/token，严格按other.task_id匹配type=2的最终other.actual_quota，每个任务只计一次；不得将其与预扣或补扣再相加。/api/status提供quota_per_unit与usd_exchange_rate后才换算金额，缺失只报额度。查询有界超时，费用失败不改变视频成功/交付/恢复状态，不触发重生成。metaontic_agent_forge_video_status可补查；C直接跳过，图片 API密钥不参与。partial为已结算小计，paused为已生成部分，pending不显示0元；只有预扣或最近日志窗口缺失都算待结算/待查询。

## 保存并发与诊断

批量写入和唯一一次安全重试均绑定检查时的 expectedRevision；第二次冲突停止，不覆盖其他编辑。保存成功后只清理本次已提交且未再修改的草稿。失败按配置冲突、页面不可用、只读、通信结果不明分类；诊断只记录固定错误分类及修订号，禁止记录 API密钥、ops、字段值和宿主原始错误。通信异常不自动重试，不把结果不明当未保存后重复提交。

重置后继续会话先用 metaontic_agent_forge_video_config 读取当前接入与密钥状态，不沿用原配置。缺 API密钥只引导登录/填写并保存，不建议重装、重新启用或重启；工具不可见先核对发现与安装状态。保留脚本审核事实与任务进度，仅补缺失确认，参数变更仍重审。

## 正式版更新

仅发布 X.Y.Z 正式版（prerelease:false），只保留检查更新与二次确认更新到最新正式版；不提供历史版本选择和降级。读取已发布正式 Release，过滤草稿及预发布；仅目标严格高于本机时才能执行安装，工具动作直接调用也必须防止同版本或低版本安装。使用同版本 Release 成品包，不回退 master、不先卸载。

## 宿主 Schema 兼容性

工具注册必须使用 Harness 支持的 JSON Schema 子集：type 只能为单个字符串，可空字段用 oneOf（如 number/null），不能写 type 数组或 anyOf。宿主会在注册时拒绝整个插件；仅导入构建包和模拟 register 成功不足以验收。注册测试遍历嵌套输出 schema，并用本机实际 dsh-tools assertSupportedJsonSchema 校验全部工具，覆盖结算金额、币种、换算参数和任务明细的 null 分支。

## 安装依赖

Hyperframes 属于隐藏的内部开发能力，只能放 devDependencies，不能随公共插件运行依赖引入 esbuild/sharp 等安装脚本。在线更新优先使用对应 Release 的 tgz 成品包，避免 Git 开发依赖；Gitee 附件不可用时只尝试同版本 GitHub 附件，不放宽 pnpm 供应链策略，不指导 approve-builds。发布前在空白 profile 使用同一 pnpm 运行时、strictDepBuilds:true 安装成品包验证，断言运行依赖树不存在 esbuild/hyperframes。

版本选择与降级入口已移除，只允许更新到更高的最新正式版本。

pnpm 11 安装前会校验整份 `pnpm-lock.yaml` 的所有 entries：只要留下一条本插件「远程 tgz 但拿不出合法 `sha512`」的记录，任何地址、任何版本的安装/更新都会以 `ERR_PNPM_MISSING_TARBALL_INTEGRITY` 失败，与插件包和操作系统无关。判定要按「本插件所有远程记录里哪些没有合法校验值」来做，不能只看被 importers 引用的那条：旧版本残留、已经没人引用的记录照样让整次安装失败，`integrity: null`／空串、只删了 `packages` 留下 `snapshots` 的半条记录同样算坏记录。宿主侧自愈见 `src/core/installation/update-lockfile.ts`：profile 根、下面两层与同级 `.<名字>.staging-*` 目录里的锁文件都扫，加载时检查一次、之后每 2 秒复查，只清本插件这类记录、改前留 `pnpm-lock.yaml.metaontic-backup-时间`、原子替换；客户端命中该错误先等一次清理再退避重试（最多 `UPDATE_ATTEMPTS` 次、不换镜像），仍然失败才提示手动删除。

复现与定性（不要再靠猜，改用宿主自带运行时在临时目录直接跑 pnpm）：`~/.dsh/dsh-runtimes/dsh-primary-runtime/dependencies/node/bin/node`（v24，node 20 会因缺 `node:sqlite` 直接报错）加 `/Applications/DeepSeek Harness.app/Contents/Resources/runtime/primary-runtime/dependencies/pnpm/dist/pnpm.mjs install --registry=https://registry.npmmirror.com/`。三种造好的锁文件对应三种结论：①只有 importer 声明地址、没有 `packages` 条目 → pnpm 重新解析、安装成功；②`packages` 条目只有 `tarball:` 没有 `integrity:` → `ERR_PNPM_MISSING_TARBALL_INTEGRITY`；③旧版本残记录没人引用但缺 `integrity`（Windows 现场形态）→ 同样失败，把这条删掉后 pnpm 重新下载并写回合法 `sha512`。macOS 正常路径（全新安装、store 命中、换版本、本地 tgz 转在线地址、附件 404 下载失败）都写不出这种记录，所以只能按现场锁文件定性，不能凭 Mac 结果下结论。

长视频交付须逐项展示所有已完成分段及真实合并结果，完成30秒两段时展示第一段、第二段、合并后完整视频；暂停/失败不虚构未完成分段或完整成片。仅单段直出时不为了交付再拆付费任务，沿用已确认生成计划。

## 续拍过渡与官方提示词

脚本按主体、动作、场景、光影、镜头、风格、画质、约束组织；定义稳定主体标签，分镜按事件顺序而非付费任务数，动作写部位与幅速力度、惯性及可见情绪，景别/视角/运镜分开。每段续拍先审核具体过渡。单行【过渡画面】优先于通用transitionDescription，续做持久化两者；只进入本地拼接的text，不增加上游参数。自动文案不得使用参考视频1；reference_video协议字段不改。明确过渡安排切镜时取消相同机位/景别/焦段硬约束，未明确时沿用连续默认；不承诺无接缝，不擅自换场景或增加生成调用。

续拍方式由已审核脚本决定，设置页和 metaontic_agent_forge_video_config 移除 mode。旧 Config.mode 仅兼容读取，不再控制新请求；本次调用按 args.mode 或默认 continuous，写入断点；已记录的 resume.mode 与原请求优先，过渡描述仍覆盖默认衔接限制。

## 分段确认与续做入口

每段生成完先结束本次调用交付成果、由助手询问、用户确认后再 resume，是既定交互；所以“每段确认”的代码卡口必须挂在续做入口（preflightGate 的 resume 分支），不能在生成循环中间阻塞——工具内部卡在审批框时宿主拿不到工具输出，用户还没看到刚生成的分段就被问要不要继续。v2.13–2.14 的 confirmNextSegment 曾在循环里直接调 approval.request，v2.15 删掉调用点后遗留成未使用的导出。现改为 segmentContinueLine 只产出“第几段做完、接下来第几段、整条还差多少”文案，连同 remainingCostText 的整条预估并入 preflightGate 已有的那次 ask，同一份进度始终只弹一个确认框，不重复提问；拒绝即停止、已完成分段保留且不影响 resume。

## 示意图实际展示

present仅登记文件交付，卡片可能在轮次结束后出现；脚本审核前需先检查图文件存在、present成功，再在正文输出Markdown内嵌SVG/PNG与打开原图链接，然后才问审核。read_image供模型查看，不证明用户看到。优先PNG/SVG，HTML作附加；格式不支持时用已有工具渲染，不擅自付费或安装。用户反馈未见图，先找对应项目文件补展示，不空口重复已画好。

MetaOntic AI 使用手填 API密钥。界面保存及metaontic_agent_forge_video_config写入须原子补齐非敏感连接默认值（baseUrl、提交/查询路径、视频/图片模型）；不从脱敏快照复制 API密钥。运行端同样提供中转默认地址兜底。火山切回中转不可沿用火山路径。诊断检查effective而非仅看stored；没有HTTP响应不能证明请求未到达上游，不解锁提交不明任务。

视频交付正文必须逐项附Markdown可点击链接，例如[观看第一段](<绝对文件路径>)，路径含空格也用尖括号包裹；有present仍须给正文链接，普通文本或反引号路径不算链接，未经验证不得说上方卡片可直接播放。缺文件先查原任务和交付路径，不重新生成。

所有用户交付的文件（脚本、分镜示意图、转换图片、单段/续拍预览、合并成片、恢复后成果、导出PDF等）都须在用户可见正文给出逐项可点击Markdown链接，不能只给目录、反引号或普通文本路径；本地路径先确认文件存在并转绝对路径，用尖括号包裹。图片另须内嵌，脚本另须完整展示正文；present登记成功仍保留链接，不声称卡片已播放。只链接真实返回或已核实文件，不编造路径，不为补链接重新付费生成。恢复目录、任务ID、配置文件等内部参数继续按原参数使用，不当作可播放成果。

交付卡片只登记「最终成片 + 各分段」（成片第一，其后按段号），脚本、分镜示意图、参考图、转换图片、单段预览、暂停时的部分合并都只在正文内联/链接交付。原因是宿主交付卡片按本轮首次出现路径顺序排列、按路径去重、第5项起折叠（@deepseek-ai/dsh-client-ui-deliverables 的 COLLAPSED_PRESENTED_COUNT=4，注释写明 in first-seen path order），中途登记过的过程材料会把成片挤到后面，事后补发 present 也挪不回来——2026-11-04 事故：同一轮先 present 脚本+分镜、再 present 15s 部分合并+第一段、最后才 present 30s 成片+两段，卡片渲染出来仍是脚本、分镜、第一段、15s 预览，30s 成片排第 5 被折叠隐藏，而原始 present 参数顺序本身是对的。该约束由 workflow/delivery-order 卡口强制：视频工具返回时按 segmentsDir 分组记录真实分段与合并成片，present 提交前依次校验四件事——这次是否最终交付（status=succeeded 且 merged=true 且无 paused/partial/pendingTaskId，否则 deny run_not_finished）、是否带了中间版本成片（deny intermediate_merge_listed）、成片是否排在所有分段之前（deny merged_not_first）、本轮是否漏掉成片（deny merged_missing；成片本轮已登记过则放行追加的分段）。认领交付文件必须逐级降级：绝对路径 → 同名 → 文件字节数；助手交付时经常把成片改名成 final/<项目>-60s.mp4、把分段换成交付目录里的 15s 副本，只比路径会整批漏判、卡口静默失效（曾因此线上一直报「成片没排第一」却没有任何 delivery_order_blocked 记录）。定位这类问题先查插件日志里有没有 delivery_order_blocked，没有就是没认领上，不要先改提示词。暂停时已有累计合并视频标为“已完成部分合并视频”，不标成完整成片；合并失败或未合并时只按段号交付真实文件。

阶段计时：编写脚本前用metaontic_agent_forge_video_stage(stage:script_design,action:start)，完整脚本保存后finish原spanId；示意图绘制用storyboard_design，展示脚本用script_present。审核/制作/参考图/分段预览等待分别用script_review_wait、production_confirm_wait、reference_review_wait、segment_review_wait，展示成果用result_present。用户回复后结束对应等待标记；不得把等待混入脚本设计时间，不为计时重复生成内容。标记仅记录边界墙钟耗时，不等于模型纯推理时间；标记不可用仍正常推进，不猜耗时。

估价按真实输入区分档位：首段生成无视频输入（参考图/首尾帧仍为无视频输入），每个续拍段有视频输入，用上一段完整视频时长加本段输出时长计token，切换到含视频输入单价；不把累计成片时长当上一段输入。脚本费用预估逐段列档位、输入/输出时长、单价与金额再合计；制作确认和恢复预检同口径，外部视频时长不明就明确无法可靠估价，不按纯生成费用兜底，不调用付费任务试算。

脚本审核展示防漏：监听session/event，必须有assistant/message正文text内嵌本版分镜图（绝对路径解析后文件仍存在），才放行脚本审核ask_user_question。present 不再参与分镜展示——交付卡片只登记最终成片，present 登记的分镜图对用户不产生可见展示，只被留作提示；reasoning、工具看图、文字描述都不算。改稿是否发新版按同目录 mtime 判断：目录里存在比内嵌那张更新的分镜图（文件名含 storyboard/分镜/示意）就 deny stale_storyboard_version，避免改稿后仍发旧图。交付卡片在轮次结束后才可见，故先发独立图片正文再提问。只观测事件，不新增已弃用的session同步日志读取。反向漏问（2026-11-04 实例）：正文单独成一条消息且不带任何工具调用时，助手在正文后直接stop结束回合，审核窗不弹。对照同模型成功轮次，正文消息都同时带着metaontic_agent_forge_video_stage调用（收口script_present/开始script_review_wait）；失败那轮把start script_present提到present之前、提前用掉了这条锚点。因此提示词要求正文消息内必须带收口调用，禁止在present前提前start/finish；守卫在turn/end（或下一轮首个事件）见到已present未提问就记storyboard_review_missing，便于判断修复是否生效。

设置布局：模型按视频/图片分组，共用开关及共用 API密钥在上方，独立 API密钥各在所属模型下；画幅/音频等高排列、窄窗口堆叠。重置在底部。改布局用真实组件模拟当前渠道、共用切换、保存、键盘和明暗/窄屏验证，不写实际宿主配置；同步真实指南截图，截图不含版本或真实 API密钥。

更多设置按画面、视频合并、查询与等待、本地工具分组；相关帮助归各组，本地工具路径全宽，宽屏成对字段控件对齐、窄屏堆叠。浏览器验证秒数单位转换和水印保存，指南采用真实组件截图并同步PDF。

仓库可发现性：About简介、主页、相关Topics与README首屏准确说明DeepSeek Harness插件及Seedance 2.0多段续拍用途，不堆砌无关关键词、不承诺排名或效果。中英文README互链，新增README.en.md同步纳入package.files；修改简介/Topics后回读验证。SEO调整不将价格参考资料提交仓库。

最初角色图持续参考：每段续拍携带上一段视频与同一套最初已审核角色图；characterReferenceImages可明确指定，未指定时沿用首段referenceImages或首帧，首帧在续拍中改作reference_image而不是first_frame。角色图归一化后随断点保存，不使用后续段落截图替代初始角色，不自动重画；无初始图片时仍为纯视频续拍，不虚构角色参考图。真人限制须先获转换同意、展示审核，再单次视频重试；成功后复用已审核转换图。原已提交任务保留originalBody，不因加图而重新提交。

纯文生视频角色图选择：有需要固定外形的人物/主体且未提供图片时，在需求阶段通过metaontic_agent_forge_video_project(action:prepare)询问“是否先生成角色参考图？图片调用单独计费，生成后先看图确认。”两个选项为“直接文生视频/先生成角色图（单独计费）”。本次已明确同意或拒绝则记录到项目，不重复问；未答/取消/pending不表示同意，不调用图片或视频。用户拒绝时保留纯文生方案，不自动加图；没有固定主体的空镜不强加角色。用户同意后先明确外形与画面风格，依次提供真人写实（第一位）、二维动画、卡通、插画；必须按用户选择执行，调用metaontic_agent_forge_video_prepare_image(operation:create_character,prompt:角色设定,style:已确认风格,characterType:真人写实选realistic其余选stylized)，默认一次一张，不需要原图。记录taskId/imageUrl；超时查询原taskId，不重发；失败或不满意先停止，重画先确认新增费用。结果在正文内嵌并给原图链接，单独询问“这张角色图可以用于接下来的视频吗？”，待明确认可后，将imageUrl同时写入metaontic_agent_forge_video_generate.referenceImages和characterReferenceImages。再展示含角色图、脚本、分镜与费用预估的本版材料并审核，最后由视频工具付费审批确认制作。脚本末尾注明角色图单独计费且不包含在视频估价中；项目记录角色图选择、任务及审核状态，恢复后不重复出图或重复问已确认选择。火山直连无此图片通道时先说明限制，可让用户提供角色图，不谎称可代画。

安装稳定性：宿主入口必须内置schemastery及运行依赖（仅开发依赖），成品不依赖外部node_modules；同步第三方MIT声明。发布前把index.js复制到无依赖空目录导入并校验Config/工具，用实际Harness Schema解析器验证。卸载重装后若仍指本地路径，核对HMR覆盖；仅改本插件HMR目标为已安装目录，保留 API密钥与其他配置，工作区外修改走系统权限。

角色图选择在需求阶段用metaontic_agent_forge_video_project(action:prepare)完成，以projectId持久化，不随提示词、时长或清晰度重复询问。空镜选scenery不强加角色；生成入口仅核验既有选择。

Windows首次安装遇ERR_PNPM_GIT_RESOLVE_FAILED时先区分Git传输与供应链检查：供应链通过不代表Git可达。用户安装入口、说明书及配图统一推荐Release的.tgz成品附件或解压后的package目录，不引导全局Git重写、SSH配置或关闭策略；插件代码无法在尚未安装时修复宿主Git传输。保留完整错误核对旧Git来源，不盲目清配置或 API密钥。

角色图真人写实仅用于create_character，characterType=realistic；建议顺序真人写实第一，其后二维动画、卡通、插画。未指定类型保持原stylized行为，不能推断用户同意写实。真人限制转换仍必须非真人，不改变审核/单次重试规则；写实出图被拒就停止并如实报错，不自动去图、换风格、重画或重提视频，另选风格需用户同意及重新费用确认。

Windows解压目录安装在更新时出现空目录/locale缺失：先核对成品中语言文件，再恢复原路径完整package，不清 API密钥；空目录原因未实证时不归因宿主删除。新Windows ZIP包含原始tgz，推荐填写tgz绝对路径安装，由pnpm托管，减少外部目录依赖；保留package作资料和恢复用途。ZIP采用固定时间戳可复现，跨仓及重试使用同一内容，校验文件须对应实际附件。

双平台兼容为默认开发/发版要求，按platform-compatibility.md执行；CI的Windows/macOS成品安装检查必须先于Release上传，覆盖中文空格路径、locale、技能、说明书、入口与安装源移动。桌面GUI/更新实机未覆盖须明确记录，不用自动烟测代替。

更新安全：runOnlineUpdate先用pluginManager.listBundles读取本插件installed/source（兼容原数组和ok/value回包），本地目录/link一律禁止直接替换；来源未知、接口缺失、元信息异常失败关闭。用户已复现Windows点击立即更新清空外部目录，之前成品首次安装验收遗漏本地链接迁移；不能再以恢复目录代替修复更新动作。记录来源与实际解析路径可能在异常迁移后不同，来源检查不能宣称自动修复既有损坏。双平台烟测需真实旧成品升级并断言原安装文件、配置、任务保留。

一键发布使用scripts/release.mjs（npm run release -- X.Y.Z），先准备本地release-plan.json完整条目及指南核对；更新说明只写新增与优化两类（修复并入优化，出现修复分类直接失败），整篇不超过100字（分类前缀不计，notesFor按notesLength统计，超限直接失败），只写用户能感知的结论；纯文案与措辞替换（如设置页把“Key”统一改成“API密钥”）、链接地址调整（注册地址、下载地址、宣传页地址）、文档与配图改写、代码重构与注释、测试与发布脚本调整、版本号与宣传页同步动作都不计入更新说明，也不因此加条目；整版只有这类改动时不主动发版，用户仍要求发版时按用户可感知的结论写一条并先确认措辞；--dry-run不改文件/版本/标签，不触发发布。脚本从实际最新正式版核对范围（仅 Gitee 发布时读 Gitee 接口，取不到再退回本地标签），禁止覆盖标签；默认只发 Gitee：本地成品用GITEE_TOKEN直接建Release并逐个上传核对附件，加--both才同步GitHub并轮询publish.yml。推送按仓库并行、失败各退避重试三次，GitHub走ssh 443并带ServerAliveInterval；任一仓库最终失败即报告，同版本--resume续跑。跨平台构建使用scripts/build.mjs的esbuild API，禁止POSIX命令替换使Windows构建失败。发版同时用scripts/sync-promo-address.mjs把服务端仓库宣传页（MetaOnticVideoService/frontend/public/promo/index.html）的Gitee附件地址、tgz文件名与页脚版本号同步到本次版本，说明书地址由脚本强校验，宣传页同步结果写入发布记录的验证；未找到宣传页必须手动同步。编写或测试发布脚本本身不等于获准执行真实发布。

历史版本回收使用scripts/clean-releases.mjs（npm run clean:releases -- --apply）：默认演练，只删计划内对象，最新正式版、当前package.json版本以及README/说明书/CHANGELOG/本文件里.tgz下载地址引用过的版本永不删除；先附件、再发行版、最后标签，GitHub与Gitee同一计划并同步本地标签，演练同时给出预计释放的附件体积；待删标签默认取所选GitHub/Gitee平台标签API的并集，不依赖本机SSH；显式--remote才额外读取Git远端，API失败时停止而不按不完整本地数据删除，Gitee开放接口没有删除标签的端点（DELETE /tags只会404），只能用私人令牌走HTTPS推送删引用。定期删除由.github/workflows/clean-releases.yml按周演练，只有仓库变量CLEANUP_APPLY=true或手动勾选apply才真正执行。回收不是发版，但删除不可逆，先看演练输出的保留集与待删清单再执行，不在发布流程中间插入清理。
回收默认发行版与标签各保留最近5个（--keep / --keep-tags，后者默认跟随前者，两条保留线取并集）；Gitee标签只能用git push删引用，Gitee操作需要GITEE_TOKEN。

分段收尾与重复逻辑：metaontic_agent_forge_video_generate 与 metaontic_agent_forge_video_extend 的分段循环共用 workflow/segment-run.ts（结果落盘、中断收尾、暂停说明、merge:false、下载合并收尾），结果文案共用 tools/results.ts 的 renderVideoResult/renderResult（同一实现在 RENDER_WORDING 里分工具措辞），改措辞只改一处，不要再各自复制一份。media/merge.ts 的分段下载与 ffprobe 探测并发跑（mapLimit，上限 SEGMENT_TASK_CONCURRENCY=4），跑完仍按段号顺序处理，因为「累计成片」识别依赖 files 的推进顺序；下载失败仍按段号取最靠前的那一段报错。参考图适配缓存在系统临时目录只增不减，写入成功后调 pruneReferenceCache（7 天、上限 200 个，5 分钟内带 .fit- 的临时文件不删）；日志目录按天缓存 mkdir，失败不记缓存以便下次重试。

宿主插件页的「详细介绍」不可关闭，只能靠包里没有文档来隐藏：Harness 的插件页（组合包页面）会读安装目录里的介绍文档，顺序是 locale/<界面语言>.json 的 meta.detail → 包内 README.md / readme.md / Readme.md / README.markdown / README（README.en.md 不在名单里，也没有任何开关或布尔配置能关掉这块）；找到就整篇渲染，找不到才整块不显示，因此成品包用 scripts/strip-package-readme.py 在打包后裁掉 package/README.md（release.mjs 与 pack-test.mjs 已接入，放在算 sha256/Windows ZIP 之前），仓库首页的 README 保持不动；本地 link 安装仍读工作区，会照旧显示，要看隐藏效果必须装成品包。给页面换成简短介绍才用 locale 的 meta.detail（文件也得进 files）。

插件已移除服务端登录接入、账户额度、钱包及充值逻辑。默认 MetaOntic AI，火山已有配置仍支持；独立服务端仓库保留。旧服务端凭据仅供清理，不迁移为其他渠道密钥。

项目流程由metaontic_agent_forge_video_project管理，review通过后生成工具付费审批即制作确认，不再另问开始制作；正文完整展示脚本并内嵌分镜才允许审核。状态绑定项目、脚本摘要和制作参数，改稿重审，审核后不再改script.md状态。分段暂停默认只交付新段，最终合并；resume+cumulativePreview:true只交付已有累计视频，不生成、不改变deliveryPending。动态创作提示词仅在当前agentPresets.presetForSession为metaontic-agent-forge-video-director时注入，标准模式返回空串，不能由历史header覆盖当前标准选择。

分段结果审核不得并入或省略：paused返回后，助手先正文展示最新分段可点击链接，再立即调用metaontic_agent_forge_video_project(action:review_segment,resume:原目录)；只在独立工具中用userQuestions弹窗，不能在生成循环里等待。续做入口和执行前校验segment-review.json中的会话/完成段数/末段taskId；未答、取消、拒绝均不放行，下一段必须新审。原任务查询、交付恢复及累计预览不新增任务则跳过，重载可复用已通过记录。Windows/macOS均用node:path和原子写入，Windows占用失败保留原文件并报错；已跑自动模拟，未跑付费与双平台桌面实测。

媒体预览使用output.presentationMeta投影成果字段，客户端读取block.meta.metaonticMedia；不投影请求、配置或密钥。本地媒体走宿主鉴权api/file，支持Windows盘符和macOS绝对路径，禁止file://及UNC；加载失败回退上游URL，保留正文原文件链接。预览不登记present、不改变交付顺序。

视频进度仅由providers/seedance.runTaskOnce的withGenerationProgress发起，结束等待即清除，不能由整个工具execute发起。外层只做finally清理与交付登记。客户端仅允许generate/extend运行时显示，完成结果只保留媒体预览；status和image不得显示视频进度。

文案按真实阶段陈述：上游成功及链接→本段生成成功，本地文件→下载完成，真实合并结果→合并完成，正文逐项链接→已交付。下载前不写已合并交付；暂停文件不称整条成片。查询失败只称状态未确认；续做复用已完成分段，新增分段仍计费；merge:false只给上游链接，无本地文件。不得保证上游链接24小时或建议因更新入口缺失直接卸载。

发布说明与验证记录分开：标签（tag）的附注和发行版（Release）正文仅包含版本标题及面向用户的“新增”“优化”，不写构建、测试、校验、CI、平台实测覆盖、未验证范围或宣传页同步等验证信息。所有验证结果与限制统一记录在 `docs/engineering/release-<版本>.md`；不得为调整说明强制覆盖已公开标签。

正式版和测试版仅提供 Windows/macOS 通用 `.tgz` 成品，不再生成或上传 Windows ZIP 及 `.zip.sha256`；Windows 与 macOS 仍须验证同一 `.tgz` 的安装与升级。历史已发布 ZIP 保留，避免旧链接失效。README 与宣传页仅展示在线安装，不推荐下载解压或目录安装。

结构维护：生成与续拍共用workflow/segment-executor.ts的executeSegmentPlan，仅请求构造、时长规划和方向游标保留在各工具；每次成功、查询不明、原始请求及onCreated仍先落盘，暂停不在工具内部弹审核。结果文案、媒体元信息与交付守卫统一读取workflow/result-state.ts；断点由validatePauseRecord验证，兼容无version及旧可选字段，损坏时保留文件并停止。进度只负责运行中的视频，tool-result独立切换成果预览。设置保存/重置/控件由settings-actions复用；测试用module-test-api导入源码，不按打包函数名或缩进截取代码，成品入口另有整包烟测。

需求时长不得默认15秒。metaontic_agent_forge_video_project.prepare只在用户已明确时传duration，否则由duration-choice弹15/30/45/60秒和自定义，选自定义后用无选项问题输入4–120整数秒。取消/未答/保存失败保持pending，不进入角色图、脚本或视频。时长绑定项目，已有审核时长兼容沿用，修改后重审；review核对完整目标时长，续拍为本次新增总时长。

时长与完善创意同轮询问：先用一次ask_user_question分别列出完善/方向、时长、画幅、清晰度的缺失项；时长15/30/45/60秒及自定义，等回答后prepare传确认duration。prepare内询问仅作遗漏兜底，不能让“先prepare”把时长拆到创意之后。

创意完整也要确认是否完善：与缺失规格同轮询问，已明确选择不重复问。完善只补原意细节，不改主题、人物关系、核心情节或结尾；实质改动须另获同意。

流程修复：普通明确失败段重试前清除旧请求快照并按本次已审核参数构造，pending/真人转换保持原请求。费用卡口注册异常时工具执行也必须拒绝。metaontic_agent_forge_video_extend的duration是每段秒数，review/估价/执行共同校验上限与segments，禁止静默夹短。合并与单文件交付临时写入成功后rename，不能先删已有成片；Windows文件占用报错并保留旧文件。制作确认只用视频工具付费审批，需求时长在对话中改，不引导设置页。

用户原创意中的时长/横竖屏/分辨率直接作为确认值，仅询问缺失项；完善创意不清空规格。“30秒竖屏720P”不得再问这三项，不支持的参数单独说明并询问可执行替代，不静默改值。

宣传预设metaontic-agent-forge-promo-video与metaontic-agent-forge-video-director复用YAML插件列表锚点和公共工具/审批，仅宣传模式注入promo专题。作用域判断以当前预设registry为准，标准/未知预设不得注入。预设新增后核对宿主YAML解析、技能入包和动态模式切换；旧会话固定身份不追溯修改。

组件中文名称：宿主包含组件列表按row.moduleName读取<完整模块名>/locale/en.json及同目录语言文件，不读预设config.name。两个预设用metaontic-agent-forge/presets/<id>独立入口转导出宿主dsh-agent-preset，并导出对应locale；不修改宿主文件，不改预设id。打包核对wrapper与locale均纳入，宿主解析名称而非仅模式列表名称。

Agent组件图标使用<完整预设模块>/icon导出，SVG在presets/icons，场记板蓝紫/扩音器橙红区分两个预设；需核对宿主readPluginMeta返回各自图标、成品入包和24/40px明暗背景显示，不修改插件总Logo。

鉴权提示分层：聊天“本轮运行失败/API密钥无效”来自宿主AUTH turn-error，与视频接口工具错误不同。客户端通过conversation.chat.node官方keyed扩展包装原renderer，仅AUTH使用友好提示并引导Harness模型设置，其他code委托原组件；不得覆盖宿主词典或写宿主安装文件。视频HTTP401/403在classifyError中保留provider_auth与状态码，提示插件设置及客服，不直断密钥无效、不回显原始鉴权报错，不改轮询重试与防重。

说明书源码仓库政策：用户要求MD/PDF及其docs/guide配图仅留本地。git rm --cached保留本地，.gitignore阻止误提交；README统一链接https://ai.mybfs.cn，不重写历史。成品包是否附带属于独立范围，未明确要求时不擅自移除包内说明书。

插件对外亮点固定两点：新手快速上手视频创作、低成本长视频生成方案。README、插件描述、仓库简介、宣传页和社区介绍均围绕这两点，不把其他能力扩成独立卖点；操作说明保留必要事实，不承诺所有模型下固定低价。

README 不展示发版记录或最新更新区；发版只同步其在线安装地址，更新内容保留在 CHANGELOG、包内 releaseNotes 与正式发行版说明。

客户端槽位包装：`entriesOfSlot` 只返回当前优胜项，原组件会被本插件包装器遮住；需要追踪原注册项时必须用 `slots.entries` 完整视图，不能按优胜项列表判断原组件已卸载，否则异步通知会引发循环卸载/注册，阻断设置与侧栏装配。回归桩须区分完整注册与优胜视图，并验证重复通知后注册数量稳定；发布前用实际 Harness SlotCore 校验客户端入口、设置页和卸载恢复。

新旧插件共存：公共 `conversation.chat.node` 的 `turn-error` 单元不能重复相同优先级。旧插件按当前优胜项加1注册，且宿主最低值生效；平台用完整entries选出最小值再减2，预留旧插件的加1空位，两种加载顺序均验证。必须以旧插件真实成品与当前客户端共同装配验证，不能仅验证两套包名和工具前缀。

预设启动验收：只验证agent-preset外层schema不够，须验证所有原生子组件Config的必填项，尤其总控的fs-search.sampleOverCapGlobResults与todo.allowParallelInProgress。第三方预设控制组件通过ctx.loader.import解析宿主内置模块，入口使用平台固定前缀；以实际Cordis Loader激活并断言控制工具已注册，不能只对apply使用模拟ctx。浏览器验证要监听warning中的agent-preset/invalid，不能把按钮存在等同新会话创建成功。

设置写入必须对照当前Config：保存和重置不得写入已移除的apiKey等字段，否则宿主以非volatile字段拒绝整批写入。实际SettingsForms服务需验证保存、渠道切换与重置；测试桩不能默认接受任意字段。宿主0.2.2将list_agents合入subagent-control主模块且移除独立子路径；按主模块实际注册结果决定是否加载旧子路径。原生兼容验证必须读取当前安装app.asar，ASAR数据区基址为8+headerSize（不是16+JSON字节数），提取后核对运行库版本。
