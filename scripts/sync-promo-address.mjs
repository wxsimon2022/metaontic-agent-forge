#!/usr/bin/env node
/**
 * 宣传页安装地址同步：发版时把宣传页里写死的插件版本地址改成目标版本。
 *
 * 宣传页在服务端仓库（MetaOnticVideoService/frontend/public/promo/index.html），
 * 不在本插件包里；但用户会照它复制安装地址，所以每次发版必须一起更新，
 * 否则宣传页上贴的还是旧版本附件。release.mjs 会在打包前自动调用本脚本。
 *
 * 用法：
 *   node scripts/sync-promo-address.mjs 3.15.2            # 同步到目标版本
 *   node scripts/sync-promo-address.mjs 3.15.2 --check    # 只核对，不一致非零退出
 *   METAONTIC_PROMO_PATH=/abs/path/index.html node scripts/sync-promo-address.mjs 3.15.2
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** 宣传页里所有写死版本的地方；每条都要能被替换到，否则视为宣传页结构变了。 */
export const PROMO_RULES = [
  { name: 'Gitee 附件地址', re: /(releases\/download\/)v\d+\.\d+\.\d+\//g, to: (v) => `$1v${v}/` },
  { name: 'tgz 附件名', re: /(metaontic-video-)\d+\.\d+\.\d+(\.tgz)/g, to: (v) => `$1${v}$2` },
  { name: '结构化数据版本号', re: /("softwareVersion":\s*")\d+\.\d+\.\d+(")/g, to: (v) => `$1${v}$2` },
  { name: '页脚版本号', re: /(MetaOnticVideo · 为 DeepSeek Harness 而作 · )v\d+\.\d+\.\d+/g, to: (v) => `$1v${v}` },
];

/** 默认候选路径：先本机开发布局，再插件仓库同级/上级的同名服务项目。 */
export function defaultCandidates(root = REPO_ROOT, home = homedir()) {
  return [
    path.join(home, 'Documents/my_python/MetaOnticVideoService/frontend/public/promo/index.html'),
    path.resolve(root, '../MetaOnticVideoService/frontend/public/promo/index.html'),
    path.resolve(root, '../../MetaOnticVideoService/frontend/public/promo/index.html'),
  ];
}

/** 找到宣传页；显式指定 METAONTIC_PROMO_PATH 时只认它，找不到就返回空串。 */
export function findPromoPage(root = REPO_ROOT, env = process.env) {
  const explicit = String(env.METAONTIC_PROMO_PATH || '').trim();
  if (explicit) return existsSync(explicit) ? explicit : '';
  for (const candidate of defaultCandidates(root)) if (existsSync(candidate)) return candidate;
  return '';
}

/** 纯文本替换：返回新内容与每条规则的命中次数，方便发版时核对都改到了。 */
export function syncPromoText(text, version) {
  const results = [];
  let output = text.replaceAll('https://gitee.com/hackloop/metaontic-video/', 'https://gitee.com/hadlooop/metaontic-agent-forge/');
  for (const rule of PROMO_RULES) {
    const count = (output.match(rule.re) || []).length;
    output = output.replace(rule.re, rule.to(version));
    results.push({ name: rule.name, count, hit: count > 0 });
  }
  return { text: output, results };
}

/** 写回宣传页；内容没变就不写，避免把文件时间戳和增量改动弄脏。 */
export function syncPromoFile(file, version) {
  const before = readFileSync(file, 'utf8');
  const { text, results } = syncPromoText(before, version);
  if (text !== before) writeFileSync(file, text);
  return { file, changed: text !== before, results };
}

async function main(argv) {
  const version = String(argv[0] || '').trim();
  const check = argv.includes('--check');
  if (!/^\d+\.\d+\.\d+$/.test(version)) {
    console.error('用法：node scripts/sync-promo-address.mjs <X.Y.Z> [--check]');
    process.exitCode = 2;
    return;
  }
  const file = findPromoPage();
  if (!file) {
    console.warn('未找到宣传页（可用 METAONTIC_PROMO_PATH 指定），请手动同步安装地址。');
    process.exitCode = 3;
    return;
  }
  const { changed, results } = syncPromoFile(file, version);
  const missing = results.filter((item) => !item.hit);
  if (check && changed) {
    console.error(`宣传页仍指向旧版本：${file}`);
    process.exitCode = 1;
    return;
  }
  console.log(`${changed ? '已更新' : '已是目标版本'}：${file}`);
  for (const item of results) console.log(`  ${item.name}：${item.count} 处`);
  if (missing.length) console.warn(`注意：这些位置没匹配到，请人工核对：${missing.map((x) => x.name).join('、')}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).catch((error) => {
    console.error(`宣传页同步失败：${error.message}`);
    process.exitCode = 1;
  });
}
