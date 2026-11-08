import assert from 'node:assert/strict';
import { test } from 'node:test';
import { sourceOf } from './source.mjs';
test('plugin no longer includes account, quota or recharge operations', () => {
  assert.doesNotMatch(sourceOf('businesses/video/client/settings', 'businesses/video/workflow/approval'), /api\/v1\/(register|wallet)|createAccountActions|rechargeEntryVisible/);
});
