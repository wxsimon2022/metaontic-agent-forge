---
name: metaontic-video-maintenance
description: 用于本仓库视频与图片接入、断点恢复、费用确认、清晰度设置、构建验证及发布维护；修改相关流程时读取并执行这些已验证约定。
---

# 项目维护经验

## 自主执行

用户已授权的开发和修复持续完成到构建、验证、文档同步，不反复询问例行实现选择。只有明确要求发版才发布，遵守根 AGENTS.md。开发授权不替代产品内付费处理同意、结果审核或环境权限。

## 接入与付费任务

- A/B 图片接入使用 Seedream 异步协议：POST `/v1/tasks/doubao`，GET `/v1/tasks/{id}`，GET `/v1/tasks/{id}/artifacts`；归一化 base 中的 `/v1`，查询不带通道。不恢复已验证不可用的同步备选。
- 图片模型当前允许 `doubao-seedream-5-0-260128` 和 `doubao-seedream-5-0-pro-260628`。图片参数使用 image 数组、2048x2048、n=1；真实能力以渠道验证为准。
- 仅明确真人限制触发转换。转换前获得同意并说明单独计费；转换完成展示全部参考图，再经用户核对确认后重试视频一次。普通审核、计价、鉴权、网络错误不得触发转换。
- 保存每张图片 taskId、结果、失败态以及转换/审核/视频重试阶段；先落盘后推进。恢复不重画已完成图片，不重置单次重试额度。保留首尾帧角色与精确原请求，包括本地图片归一化后的内容。
- POST 网络异常不能证明上游未创建任务。提交前持久化防重记录，结果不明返回 submission_unknown 并停住；经原渠道核对才能关联 taskId 或确认未创建后解锁。不要以换参数或清记录绕过防重。
- A 固定共用登录下发的 Key，只有 B 提供共用选择；B 图片默认共用视频 Key，关闭共用必须单独填写 imageApiKey，禁止缺失时回退。图片提交、轮询、取件及防重核对统一使用图片连接快照，视频凭据不受影响。
- Key 路由必须用模拟 HTTP Authorization 验证：A 固定登录 Key，B 共用/独立分别覆盖，C 仅火山 Key；覆盖转换后视频重试、图片取件与异常提交核对，缺失时不得回退其他模型 Key。
- 每次调用固定配置快照，后续轮询不得混用新地址或 Key。密钥不写断点/日志，私有状态文件限制权限。
- 分段续做的审批文案必须先合并暂停记录 options，再解析清晰度；不得用仅含 resume 的原始参数回退到 720P。覆盖30秒480P两段流程，断言确认文案、估价与两次实际请求一致。
- 清晰度不在插件设置中配置；工具参数、实际请求、估价和恢复保持一致：480p/720p，脚本阶段须由用户明确选择480P/720P（本次需求已指定不重复问），记录到脚本、制作确认并显式传入工具。恢复已提交任务使用原请求参数。

## 对白准确性

脚本审核前使用 video-director/references/pronunciation.md：正确原文与发音文本分离，仅对读音明确的易错词用同音常用字，不猜专名、不全局替换。生成和前后延长都保留对白执行约束，不覆盖无对白或关闭音频的选择。预算按实际发声时间，完整句不跨段；验收必须试听，不能把任务成功等同读音正确。误读重做仍需费用同意，不承诺自动配音/口型修复。

## 验证与构建

- 优先检查已有测试并覆盖失败恢复、部分完成、提交不明、拒绝授权、结果审核、配置切换和清晰度估价；模拟接口测试不得发起实际付费调用。
- 执行 `node scripts/check-active-video.mjs`；有活动任务先等待，不构建或热替换。
- 执行 `npm run build`、`node --test tests/*.test.mjs` 和 `git diff --check`。工具注册、schema、客户端与构建产物同步；按根约定优先热加载。
- 配置保存遇宿主旧 revision 被拒时，仅在恢复后的待写字段未变化、可写且就绪时原子重试一次；其他拒绝保留草稿，不能无限重试或拆为逐字段写入。后台设备同步期间的保存需等待后继续，避免静默忽略首次点击；React 使用 useSyncExternalStore 订阅宿主配置。
- 同步 README、操作指南和相关内置技能的操作说明；普通开发不修改版本号、releaseNotes 或标签。
- 真实测试仅在用户授权范围内进行，区分实际覆盖的接入、模型和输入类型；不要把普通图片成功等同真人转换或完整视频链路验证。

## 发布经验

- 先比较最近发布到当前工作区的全部逻辑变化，展示完整说明，再按 README 发布；操作指南必须复核且纳入包；用户要求指南只面向使用，只讲选择 MetaOntic AI 的配置路线，不列其他接入方式，不写 A/B 标记、版本号、更新记录或发布信息；配图优先真实插件组件预览。核对结论及适用版本只写入 docs/engineering/release-<版本>.md，不写进指南或配图；发布时检查指南正文和配图，不得添加“适用版本”“本次更新”“发布核对”等章节。更新内容统一留在 CHANGELOG、README 更新区和 releaseNotes。
- CI checkout 后显式取回注解标签，再读取完整发布说明，避免 checkout 将标签覆盖为提交引用而只读出提交标题。
- Gitee 更新已有 Release 使用 PATCH，携带 tag_name；发布后核对 GitHub/Gitee 的说明与附件，不只看工作流绿色。
- 发布慢的主因是等 GitHub Actions（GitHub SSH 443 还常整段超时）；改成本地成品直传 Gitee 后，一次发版只剩本地构建测试打包约 3 分钟加三个附件上传，双仓并行推送也避免一仓超时拖累另一仓。GitHub Actions 只在--both时使用，作为双平台安装校验证据；仅 Gitee 发布的 Windows 缺口写进 release 文档。
- 测试包不进 Release：`npm run pack:test -- X.Y.Z-test.N` 会构建、跑测试、打 `.tgz`，直接上传 `https://video.mybfs.cn/test/` 并核对线上 sha256，最后还原包内版本号；版本核心号压在当前正式版之下，更新检查只读正式 Release，因此测试包不影响他人正式版，`--no-upload` 可只出本地包。线上 `/test/` 由 moyubang 仓库 `deploy/nginx/video.mybfs.cn.conf` 提供，目录放在部署目录之外，`deploy.sh` 的 `rsync --delete` 不会清理已上传包。
- Gitee Go 流水线 `.workflow/MetaOnticVideo.yml` 只在 master 推送、面向 master 的 PR、`v*` 标签时做构建与测试校验，并打出 tgz 与 Windows ZIP（ZIP 依赖构建机 Python3，缺失时自动安装、仍失败则跳过并在日志提示）留作流水线制品（制品有保留期），不发版；GitHub/Gitee Release 成品统一由 GitHub Actions `publish` 产出，不在 Gitee 侧另打一份包。标签触发时用 `git describe --tags --exact-match` 核对标签与包内版本一致，不一致立即失败（取不到标签时只提示，不阻断）；`ci-` 开头的演练标签跳过该强校验，只演练不出发布件；脚本里变量后紧跟中文标点时必须写 `${VAR}`，否则 bash 会把全角标点并入变量名导致展开为空；构建机不保证自带 Node，命令里先探测常见安装路径，找不到就从 `cdn.npmmirror.com` 下载 Node 20（glibc 低于 2.28 时自动换 `node-unofficial-builds` 的 glibc-217 兼容版），并缓存到 `~/.local/node`，不依赖插件下拉版本；Gitee 免费构建机的 Node 版本字段因此只作占位。

Key 共用规则：A 接入固定共用登录下发的 Key，模型配置中不显示 Key、Key 状态或共用开关；仅 B 接入可以选择共用或分别填写视频模型 Key、图片模型 Key。A 忽略旧配置中残留的独立图片 Key。

## 脚本审核费用对比

所有接入在审核前调用只读video_estimate并将官方/插件两项基础估价写入script.md最后的“费用预估”一节；会话中展示脚本也在末尾展示本节，再弹审核窗，按实际分段计入上一段视频输入；手填Key未核实分组按1，火山直连不套中转折扣。未知价目/画幅不猜价，最低用量补足未计入须注明。制作审批与账户额度预检保持独立，不能把本次一段价格当整条预算。用户另行生成的价格参考文档和宣传素材仍仅留本地，不纳入仓库或发布包。

- 版本卡片更新时间读取当前包releaseNotes.publishedAt（ISO时间，转换为UTC+8显示日期与时间，不附加时区字样），不得用检查时间、构建时间或远端其他版本时间代替；发版时同步真实发布时间，缺失则不显示。

## 实际费用（仅A/B）

完成后使用视频调用的连接快照和视频Key查询/api/log/token，严格按other.task_id匹配type=2的最终other.actual_quota，每个任务只计一次；不得将其与预扣或补扣再相加。/api/status提供quota_per_unit与usd_exchange_rate后才换算金额，缺失只报额度。查询有界超时，费用失败不改变视频成功/交付/恢复状态，不触发重生成。video_status可补查；C直接跳过，图片Key不参与。partial为已结算小计，paused为已生成部分，pending不显示0元；只有预扣或最近日志窗口缺失都算待结算/待查询。

## 保存并发与诊断

自动取回 Key/登录写入也必须暴露 connectionBusy.pending，让用户保存等待其完成，不得静默丢弃点击。批量写入和唯一一次安全重试均绑定检查时的 expectedRevision；第二次冲突停止，不覆盖其他编辑。保存成功后只清理本次已提交且未再修改的草稿。失败按配置冲突、页面不可用、只读、通信结果不明分类；诊断只记录固定错误分类及修订号，禁止记录 Key、ops、字段值和宿主原始错误。通信异常不自动重试，不把结果不明当未保存后重复提交。

重置后继续会话先用 video_config 读取当前接入与密钥状态，不沿用原配置。缺 Key 只引导登录/填写并保存，不建议重装、重新启用或重启；工具不可见先核对发现与安装状态。保留脚本审核事实与任务进度，仅补缺失确认，参数变更仍重审。

## 正式版更新

仅发布 X.Y.Z 正式版（prerelease:false），只保留检查更新与二次确认更新到最新正式版；不提供历史版本选择和降级。读取已发布正式 Release，过滤草稿及预发布；仅目标严格高于本机时才能执行安装，工具动作直接调用也必须防止同版本或低版本安装。使用同版本 Release 成品包，不回退 master、不先卸载。

## 宿主 Schema 兼容性

工具注册必须使用 Harness 支持的 JSON Schema 子集：type 只能为单个字符串，可空字段用 oneOf（如 number/null），不能写 type 数组或 anyOf。宿主会在注册时拒绝整个插件；仅导入构建包和模拟 register 成功不足以验收。注册测试遍历嵌套输出 schema，并用本机实际 dsh-tools assertSupportedJsonSchema 校验全部工具，覆盖结算金额、币种、换算参数和任务明细的 null 分支。

## 安装依赖

Hyperframes 属于隐藏的内部开发能力，只能放 devDependencies，不能随公共插件运行依赖引入 esbuild/sharp 等安装脚本。在线更新优先使用对应 Release 的 tgz 成品包，避免 Git 开发依赖；Gitee 附件不可用时只尝试同版本 GitHub 附件，不放宽 pnpm 供应链策略，不指导 approve-builds。发布前在空白 profile 使用同一 pnpm 运行时、strictDepBuilds:true 安装成品包验证，断言运行依赖树不存在 esbuild/hyperframes。

版本选择与降级入口已移除，只允许更新到更高的最新正式版本。

pnpm 11 安装前会校验整份 `pnpm-lock.yaml` 的所有 entries：只要留下一条本插件「远程 tgz 但拿不出合法 `sha512`」的记录，任何地址、任何版本的安装/更新都会以 `ERR_PNPM_MISSING_TARBALL_INTEGRITY` 失败，与插件包和操作系统无关。判定要按「本插件所有远程记录里哪些没有合法校验值」来做，不能只看被 importers 引用的那条：旧版本残留、已经没人引用的记录照样让整次安装失败，`integrity: null`／空串、只删了 `packages` 留下 `snapshots` 的半条记录同样算坏记录。宿主侧自愈见 `src/internal/update-lockfile.ts`：profile 根、下面两层与同级 `.<名字>.staging-*` 目录里的锁文件都扫，加载时检查一次、之后每 2 秒复查，只清本插件这类记录、改前留 `pnpm-lock.yaml.metaontic-backup-时间`、原子替换；客户端命中该错误先等一次清理再退避重试（最多 `UPDATE_ATTEMPTS` 次、不换镜像），仍然失败才提示手动删除。

复现与定性（不要再靠猜，改用宿主自带运行时在临时目录直接跑 pnpm）：`~/.dsh/dsh-runtimes/dsh-primary-runtime/dependencies/node/bin/node`（v24，node 20 会因缺 `node:sqlite` 直接报错）加 `/Applications/DeepSeek Harness.app/Contents/Resources/runtime/primary-runtime/dependencies/pnpm/dist/pnpm.mjs install --registry=https://registry.npmmirror.com/`。三种造好的锁文件对应三种结论：①只有 importer 声明地址、没有 `packages` 条目 → pnpm 重新解析、安装成功；②`packages` 条目只有 `tarball:` 没有 `integrity:` → `ERR_PNPM_MISSING_TARBALL_INTEGRITY`；③旧版本残记录没人引用但缺 `integrity`（Windows 现场形态）→ 同样失败，把这条删掉后 pnpm 重新下载并写回合法 `sha512`。macOS 正常路径（全新安装、store 命中、换版本、本地 tgz 转在线地址、附件 404 下载失败）都写不出这种记录，所以只能按现场锁文件定性，不能凭 Mac 结果下结论。

长视频交付须逐项展示所有已完成分段及真实合并结果，完成30秒两段时展示第一段、第二段、合并后完整视频；暂停/失败不虚构未完成分段或完整成片。仅单段直出时不为了交付再拆付费任务，沿用已确认生成计划。

## 续拍过渡与官方提示词

脚本按主体、动作、场景、光影、镜头、风格、画质、约束组织；定义稳定主体标签，分镜按事件顺序而非付费任务数，动作写部位与幅速力度、惯性及可见情绪，景别/视角/运镜分开。每段续拍先审核具体过渡。单行【过渡画面】优先于通用transitionDescription，续做持久化两者；只进入本地拼接的text，不增加上游参数。自动文案不得使用参考视频1；reference_video协议字段不改。明确过渡安排切镜时取消相同机位/景别/焦段硬约束，未明确时沿用连续默认；不承诺无接缝，不擅自换场景或增加生成调用。

续拍方式由已审核脚本决定，设置页和 video_config 移除 mode。旧 Config.mode 仅兼容读取，不再控制新请求；本次调用按 args.mode 或默认 continuous，写入断点；已记录的 resume.mode 与原请求优先，过渡描述仍覆盖默认衔接限制。

## 分段确认与续做入口

每段生成完先结束本次调用交付成果、由助手询问、用户确认后再 resume，是既定交互；所以“每段确认”的代码卡口必须挂在续做入口（preflightGate 的 resume 分支），不能在生成循环中间阻塞——工具内部卡在审批框时宿主拿不到工具输出，用户还没看到刚生成的分段就被问要不要继续。v2.13–2.14 的 confirmNextSegment 曾在循环里直接调 approval.request，v2.15 删掉调用点后遗留成未使用的导出。现改为 segmentContinueLine 只产出“第几段做完、接下来第几段、整条还差多少”文案，连同 remainingCostText 的整条预估并入 preflightGate 已有的那次 ask，同一份进度始终只弹一个确认框，不重复提问；拒绝即停止、已完成分段保留且不影响 resume。

## 示意图实际展示

present仅登记文件交付，卡片可能在轮次结束后出现；脚本审核前需先检查图文件存在、present成功，再在正文输出Markdown内嵌SVG/PNG与打开原图链接，然后才问审核。read_image供模型查看，不证明用户看到。优先PNG/SVG，HTML作附加；格式不支持时用已有工具渲染，不擅自付费或安装。用户反馈未见图，先找对应项目文件补展示，不空口重复已画好。

服务端领Key与手填MetaOntic AI Key共用中转地址、模型和协议，只区分密钥来源。界面保存及video_config写入须原子补齐非敏感连接默认值（baseUrl、提交/查询路径、视频/图片模型）；不从脱敏快照复制Key。运行端同样提供中转默认地址兜底。火山切回中转不可沿用火山路径。诊断检查effective而非仅看stored；没有HTTP响应不能证明请求未到达上游，不解锁提交不明任务。

视频交付正文必须逐项附Markdown可点击链接，例如[观看第一段](<绝对文件路径>)，路径含空格也用尖括号包裹；有present仍须给正文链接，普通文本或反引号路径不算链接，未经验证不得说上方卡片可直接播放。缺文件先查原任务和交付路径，不重新生成。

所有用户交付的文件（脚本、分镜示意图、转换图片、单段/续拍预览、合并成片、恢复后成果、导出PDF等）都须在用户可见正文给出逐项可点击Markdown链接，不能只给目录、反引号或普通文本路径；本地路径先确认文件存在并转绝对路径，用尖括号包裹。图片另须内嵌，脚本另须完整展示正文；present登记成功仍保留链接，不声称卡片已播放。只链接真实返回或已核实文件，不编造路径，不为补链接重新付费生成。恢复目录、任务ID、配置文件等内部参数继续按原参数使用，不当作可播放成果。

交付文件顺序统一为：合并后的完整视频第一，其后依次为第一段、第二段及后续分段；present调用、正文文件链接和交付清单都遵守此顺序。该顺序由 workflow/delivery-order 卡口强制：视频工具返回时记录真实分段与合并成片，present 提交前校验成片是否排在所有分段之前、本轮是否漏掉成片，不合格直接 deny 并给出正确顺序（真实事故：present 传「第一段、第二段、合并成片」导致成片卡片排在最后）。暂停时已有累计合并视频标为“已完成部分合并视频”，不标成完整成片；合并失败或未合并时只按段号交付真实文件。

阶段计时：编写脚本前用video_stage(stage:script_design,action:start)，完整脚本保存后finish原spanId；示意图绘制用storyboard_design，展示脚本用script_present。审核/制作/参考图/分段预览等待分别用script_review_wait、production_confirm_wait、reference_review_wait、segment_review_wait，展示成果用result_present。用户回复后结束对应等待标记；不得把等待混入脚本设计时间，不为计时重复生成内容。标记仅记录边界墙钟耗时，不等于模型纯推理时间；标记不可用仍正常推进，不猜耗时。

估价按真实输入区分档位：首段生成无视频输入（参考图/首尾帧仍为无视频输入），每个续拍段有视频输入，用上一段完整视频时长加本段输出时长计token，切换到含视频输入单价；不把累计成片时长当上一段输入。脚本费用预估逐段列档位、输入/输出时长、单价与金额再合计；制作确认和恢复预检同口径，外部视频时长不明就明确无法可靠估价，不按纯生成费用兜底，不调用付费任务试算。

脚本审核展示防漏：监听session/event，当前视频流程的present分镜图登记后，必须有assistant/message正文text内嵌同一绝对路径的图片，且文件仍存在，才放行脚本审核ask_user_question。reasoning、工具看图及仅present登记不算；新版图重置展示状态，不使用上一轮图。交付卡片在轮次结束后才可见，故先发独立图片正文再提问。只观测事件，不新增已弃用的session同步日志读取。

设置布局：模型按视频/图片分组，共用开关及共用Key在上方，独立Key各在所属模型下；画幅/音频等高排列、窄窗口堆叠。登录入口归接入区，重置在底部。改布局用真实组件模拟三渠道、共用切换、保存、键盘和明暗/窄屏验证，不写实际宿主配置；同步真实指南截图，截图不含版本或真实Key。

更多设置按画面、视频合并、查询与等待、本地工具分组；相关帮助归各组，本地工具路径全宽，宽屏成对字段控件对齐、窄屏堆叠。浏览器验证秒数单位转换和水印保存，指南采用真实组件截图并同步PDF。

仓库可发现性：About简介、主页、相关Topics与README首屏准确说明DeepSeek Harness插件及Seedance 2.0多段续拍用途，不堆砌无关关键词、不承诺排名或效果。中英文README互链，新增README.en.md同步纳入package.files；修改简介/Topics后回读验证。SEO调整不将价格参考资料提交仓库。

最初角色图持续参考：每段续拍携带上一段视频与同一套最初已审核角色图；characterReferenceImages可明确指定，未指定时沿用首段referenceImages或首帧，首帧在续拍中改作reference_image而不是first_frame。角色图归一化后随断点保存，不使用后续段落截图替代初始角色，不自动重画；无初始图片时仍为纯视频续拍，不虚构角色参考图。真人限制须先获转换同意、展示审核，再单次视频重试；成功后复用已审核转换图。原已提交任务保留originalBody，不因加图而重新提交。

纯文生视频角色图选择：有需要固定外形的人物/主体且未提供图片时，在准备人物与风格后、最终脚本审核与视频制作前，必须用提问工具询问“是否先生成角色参考图？图片调用单独计费，生成后先看图确认。”两个选项为“先生成角色图（单独计费）/直接文生视频”。本次已明确同意或拒绝则记录到项目，不重复问；未答/取消/pending不表示同意，不调用图片或视频。用户拒绝时保留纯文生方案，不自动加图；没有固定主体的空镜不强加角色。用户同意后先明确外形与画面风格，依次提供真人写实（第一位）、二维动画、卡通、插画；必须按用户选择执行，调用video_prepare_image(operation:create_character,prompt:角色设定,style:已确认风格,characterType:真人写实选realistic其余选stylized)，默认一次一张，不需要原图。记录taskId/imageUrl；超时查询原taskId，不重发；失败或不满意先停止，重画先确认新增费用。结果在正文内嵌并给原图链接，单独询问“这张角色图可以用于接下来的视频吗？”，待明确认可后，将imageUrl同时写入video_generate.referenceImages和characterReferenceImages。再展示含角色图、脚本、分镜与费用预估的本版材料并审核，最后单独确认视频制作。脚本末尾注明角色图单独计费且不包含在视频估价中；项目记录角色图选择、任务及审核状态，恢复后不重复出图或重复问已确认选择。火山直连无此图片通道时先说明限制，可让用户提供角色图，不谎称可代画。

安装稳定性：宿主入口必须内置schemastery及运行依赖（仅开发依赖），成品不依赖外部node_modules；同步第三方MIT声明。发布前把index.js复制到无依赖空目录导入并校验Config/工具，用实际Harness Schema解析器验证。卸载重装后若仍指本地路径，核对HMR覆盖；仅改本插件HMR目标为已安装目录，保留Key与其他配置，工作区外修改走系统权限。

角色图选择必须由提交前代码校验：新建无图video_generate调用通过userQuestions服务询问两项选择，不能仅靠助手提示词。直接文生的明确选择才进入原视频制作审批；先生成角色图则停止该次视频提交、提示先出图和审核，带图后再制作。未答/取消/pending/交互不可用/记录失败均停止，不默认文生。按会话与当前脚本规格记录明确选择，重试相同任务不重复问；新项目重新选择。已有图片或resume续做不重问、不改变已提交任务。助手不要另行重复创建同一角色图选择问题；若提交前交互被拦截，按返回的真实用户选择推进。

Windows首次安装遇ERR_PNPM_GIT_RESOLVE_FAILED时先区分Git传输与供应链检查：供应链通过不代表Git可达。用户安装入口、说明书及配图统一推荐Release的.tgz成品附件或解压后的package目录，不引导全局Git重写、SSH配置或关闭策略；插件代码无法在尚未安装时修复宿主Git传输。保留完整错误核对旧Git来源，不盲目清配置或Key。

角色图真人写实仅用于create_character，characterType=realistic；建议顺序真人写实第一，其后二维动画、卡通、插画。未指定类型保持原stylized行为，不能推断用户同意写实。真人限制转换仍必须非真人，不改变审核/单次重试规则；写实出图被拒就停止并如实报错，不自动去图、换风格、重画或重提视频，另选风格需用户同意及重新费用确认。

Windows解压目录安装在更新时出现空目录/locale缺失：先核对成品中语言文件，再恢复原路径完整package，不清Key；空目录原因未实证时不归因宿主删除。新Windows ZIP包含原始tgz，推荐填写tgz绝对路径安装，由pnpm托管，减少外部目录依赖；保留package作资料和恢复用途。ZIP采用固定时间戳可复现，跨仓及重试使用同一内容，校验文件须对应实际附件。

双平台兼容为默认开发/发版要求，按platform-compatibility.md执行；CI的Windows/macOS成品安装检查必须先于Release上传，覆盖中文空格路径、locale、技能、说明书、入口与安装源移动。桌面GUI/更新实机未覆盖须明确记录，不用自动烟测代替。

更新安全：runOnlineUpdate先用pluginManager.listBundles读取本插件installed/source（兼容原数组和ok/value回包），本地目录/link一律禁止直接替换；来源未知、接口缺失、元信息异常失败关闭。用户已复现Windows点击立即更新清空外部目录，之前成品首次安装验收遗漏本地链接迁移；不能再以恢复目录代替修复更新动作。记录来源与实际解析路径可能在异常迁移后不同，来源检查不能宣称自动修复既有损坏。双平台烟测需真实旧成品升级并断言原安装文件、配置、任务保留。

一键发布使用scripts/release.mjs（npm run release -- X.Y.Z），先准备本地release-plan.json完整条目及指南核对；--dry-run不改文件/版本/标签，不触发发布。脚本从实际最新正式版核对范围（仅 Gitee 发布时读 Gitee 接口，取不到再退回本地标签），禁止覆盖标签；默认只发 Gitee：本地成品用GITEE_TOKEN直接建Release并逐个上传核对附件，加--both才同步GitHub并轮询publish.yml。推送按仓库并行、失败各退避重试三次，GitHub走ssh 443并带ServerAliveInterval；任一仓库最终失败即报告，同版本--resume续跑。跨平台构建使用scripts/build.mjs的esbuild API，禁止POSIX命令替换使Windows构建失败。编写或测试发布脚本本身不等于获准执行真实发布。

历史版本回收使用scripts/clean-releases.mjs（npm run clean:releases -- --apply）：默认演练，只删计划内对象，最新正式版、当前package.json版本以及README/说明书/CHANGELOG/本文件里.tgz下载地址引用过的版本永不删除；先附件、再发行版、最后标签，GitHub与Gitee同一计划并同步本地标签，演练同时给出预计释放的附件体积；待删标签取远端列表与Gitee标签接口的并集，Gitee开放接口没有删除标签的端点（DELETE /tags只会404），只能用私人令牌走HTTPS推送删引用。定期删除由.github/workflows/clean-releases.yml按周演练，只有仓库变量CLEANUP_APPLY=true或手动勾选apply才真正执行。回收不是发版，但删除不可逆，先看演练输出的保留集与待删清单再执行，不在发布流程中间插入清理。
回收默认发行版与标签各保留最近10个（--keep / --keep-tags，后者默认跟随前者，两条保留线取并集）；Gitee标签只能用git push删引用，Gitee操作需要GITEE_TOKEN。
