import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { findPromoPage, syncPromoFile, syncPromoText } from '../scripts/sync-promo-address.mjs';
import { promoStatus } from '../scripts/release.mjs';

const FIXTURE = [
  '<script type="application/ld+json">{"softwareVersion": "3.13.9"}</script>',
  '<code id="install-windows-tgz">https://gitee.com/hackloop/metaontic-video/releases/download/v3.13.13/metaontic-video-3.13.13.tgz</code>',
  '<footer>MetaOnticVideo · 为 DeepSeek Harness 而作 · v3.13.13</footer>',
].join('\n');

test('promo page version addresses are rewritten to the release version', () => {
  const { text, results } = syncPromoText(FIXTURE, '3.15.1');
  assert.ok(text.includes('https://gitee.com/hadlooop/metaontic-agent-forge/releases/download/'));
  assert.match(text, /releases\/download\/v3\.15\.1\/metaontic-video-3\.15\.1\.tgz/);
  assert.match(text, /"softwareVersion": "3\.15\.1"/);
  assert.match(text, /而作 · v3\.15\.1</);
  assert.doesNotMatch(text, /3\.13\.13|3\.13\.9/);
  assert.deepEqual(results.map((item) => item.hit), [true, true, true, true]);
});

test('promo sync reports which places stopped matching instead of failing silently', () => {
  const { results } = syncPromoText('<p>宣传页换了写法，没有版本号</p>', '3.15.1');
  assert.deepEqual(results.map((item) => item.hit), [false, false, false, false]);
});

test('promo file is only written when the version actually changed', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'meta-promo-'));
  const file = path.join(dir, 'index.html');
  try {
    await writeFile(file, FIXTURE);
    const first = syncPromoFile(file, '3.15.1');
    assert.equal(first.changed, true);
    assert.equal(await readFile(file, 'utf8'), syncPromoText(FIXTURE, '3.15.1').text);
    const second = syncPromoFile(file, '3.15.1');
    assert.equal(second.changed, false);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('promo page path comes from METAONTIC_PROMO_PATH and missing pages are reported', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'meta-promo-path-'));
  const file = path.join(dir, 'index.html');
  try {
    await writeFile(file, FIXTURE);
    assert.equal(findPromoPage(undefined, { METAONTIC_PROMO_PATH: file }), file);
    assert.equal(findPromoPage(undefined, { METAONTIC_PROMO_PATH: path.join(dir, 'nope.html') }), '');
    assert.equal(promoStatus('3.15.1', file).needsSync, true);
    syncPromoFile(file, '3.15.1');
    assert.equal(promoStatus('3.15.1', file).needsSync, false);
    assert.deepEqual(promoStatus('3.15.1', ''), { file: '', needsSync: false, missing: [] });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
