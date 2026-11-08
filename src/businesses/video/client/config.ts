/** 浏览器端 config：由入口注入宿主 React 与共享依赖。 */
import { VOLCENGINE_MODE_AVAILABLE, IMAGE_MODEL } from '../connection-defaults.js';

export function createClientConfig() {
/** Host 侧条目的 id，与 cordis.patch.yml 里那条覆盖项一致。 */
    const NAMESPACE = 'metaontic-agent-forge';
    /** 本模块自己的界面字典命名空间。 */
    const NS = 'settings.metaonticAgentForge';

    /**
     * 模型下拉的候选：中转站当前上架的 seedance 视频型号。
     * 两个都在插件的预估价目表里，所以换着选也不会把「预估费用」算歪；
     * 服务端下发的型号如果比这张表新，会照原样补进下拉，不会被静默换掉。
     */
    const MODEL_OPTIONS = [
      'doubao-seedance-2-0-mini-260615',
      'doubao-seedance-2-0-fast-260128',
    ];
    /** 可编辑字段；kind 决定控件，标注 secret 的字段宿主只会告知是否已配置。 */
    const SELECTS = {
      // MetaOntic AI；火山直连按开关提供。
      connectionMode: VOLCENGINE_MODE_AVAILABLE
        ? ['metaontic', 'volcengine']
        : ['metaontic'],
      model: MODEL_OPTIONS,
      // 图片模型只提供在售的 pro 版；旧型号已下线，存量配置由 resolveImageModel 归一到这一项。
      imageModel: [IMAGE_MODEL],
      ratio: ['16:9', '9:16', '4:3', '3:4', '1:1', 'adaptive'],
      mergeMode: ['copy', 'reencode'],
    };
    // 字段按用途分组，页面用分节标题隔开——字段铺一格太糊，分了组一眼能扫到自己要改的那项。
    // 注：singleMaxSeconds（单次直出上限）与 duration（每段延长秒数）不进设置页：
    // 前者由模型决定（2.0 为 15 秒、2.5 为 30 秒），调小只会把一条视频拆得更碎；
    // 后者默认按模型上限规划，段数最少，调小只会多出接缝。两者都作为旧配置保留，
    // 只有「上游对卡满 15 秒的延长段敏感」这种少数情况才需要改成 14。
    const SECTIONS = [
      { key: 'sectionConnection', fields: ['connectionMode'] },
      { key: 'sectionModels', fields: ['imageUseVideoKey', 'model', 'metaonticApiKey', 'volcengineApiKey', 'imageModel', 'imageApiKey'] },
      { key: 'sectionVideo', fields: ['ratio', 'generateAudio'] },
    ];
    const FIELDS = [
      { key: 'connectionMode', kind: 'select', wide: true },
      { key: 'metaonticApiKey', kind: 'text', secret: true, wide: true },
      { key: 'volcengineApiKey', kind: 'text', secret: true, wide: true },
      // 模型用下拉选（候选见 MODEL_OPTIONS），占一整行显示完整型号
      { key: 'model', kind: 'select', wide: true },
      { key: 'imageModel', kind: 'select', wide: true },
      { key: 'imageUseVideoKey', kind: 'switch', wide: true },
      { key: 'imageApiKey', kind: 'text', secret: true, wide: true },
      { key: 'ratio', kind: 'select' },
      { key: 'generateAudio', kind: 'switch' },
      { key: 'watermark', kind: 'switch' },
      { key: 'usageStatsEnabled', kind: 'switch' },
      { key: 'seamTrimSeconds', kind: 'text' },
      { key: 'mergeMode', kind: 'select', wide: true },
      { key: 'pollIntervalMs', kind: 'number' },
      { key: 'maxWaitMs', kind: 'number' },
      { key: 'ffmpegBinary', kind: 'text', mono: true },
      { key: 'ffprobeBinary', kind: 'text', mono: true },
    ];
    const FIELD_BY_KEY = Object.fromEntries(FIELDS.map((field) => [field.key, field]));

    /** 插件自己会写进配置的项：重置时兜底一起清，免得宿主没把它们列进 user。 */
    const PLUGIN_OWNED_KEYS = [
      'usageStatsEnabled', 'connectionMode', 'metaonticApiKey', 'volcengineApiKey', 'apiKey', 'baseUrl', 'model', 'imageModel', 'imageUseVideoKey', 'imageApiKey',
    ];

    /** 这台机器的系统（浏览器半侧只能这么看）：用来挑默认展示的 ffmpeg 安装命令。 */
    function currentOs() {
      const nav: any = window.navigator || {};
      const raw = String(
        nav.userAgentData?.platform || nav.platform || nav.userAgent || '',
      ).toLowerCase();
      if (/mac|darwin|iphone|ipad/.test(raw)) return 'macos';
      if (/win/.test(raw)) return 'windows';
      return 'linux';
    }

    /** 各系统的 ffmpeg 安装命令：主推一条，其余的折叠在「其他系统」里。 */
    const FFMPEG_INSTALLS = {
      macos: { label: 'macOS（Homebrew）', command: 'brew install ffmpeg' },
      windows: { label: 'Windows（winget）', command: 'winget install --id Gyan.FFmpeg -e' },
      linux: { label: 'Linux（Debian / Ubuntu）', command: 'sudo apt update && sudo apt install -y ffmpeg' },
    };
    const FFMPEG_ALL = [
      { os: 'macos', label: 'macOS（Homebrew）', command: 'brew install ffmpeg' },
      {
        os: 'macos',
        label: 'macOS（还没装 Homebrew）',
        command: '/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"',
      },
      { os: 'windows', label: 'Windows（winget）', command: 'winget install --id Gyan.FFmpeg -e' },
      { os: 'windows', label: 'Windows（Chocolatey）', command: 'choco install ffmpeg' },
      { os: 'linux', label: 'Linux（Debian / Ubuntu）', command: 'sudo apt update && sudo apt install -y ffmpeg' },
      { os: 'linux', label: 'Linux（Fedora / RHEL / CentOS）', command: 'sudo dnf install -y ffmpeg' },
    ];

    /** 金额显示与中转站一致：|x| ≥ 1 保留 2 位小数，否则保留 4 位，末尾多余的 0 去掉。 */
    function formatMoney(value) {
      const number = Number(value);
      if (!Number.isFinite(number)) return '0';
      const text = number.toFixed(Math.abs(number) >= 1 ? 2 : 4);
      return text.includes('.') ? text.replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '') : text;
    }

    function optionLabel(t, key, option) {
      if (key === 'connectionMode') return t(option);
      if (key === 'mergeMode') {
        if (option === 'reencode') return t('mergeModeReencode');
        return option === 'copy' ? t('mergeModeCopy') : t('mergeModeSeamless');
      }
      return option;
    }
  return { PLUGIN_OWNED_KEYS, SELECTS, optionLabel, FIELD_BY_KEY, SECTIONS, formatMoney, NS, NAMESPACE };
}
