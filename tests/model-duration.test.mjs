import { api as context } from './module-test-api.mjs';
import assert from 'node:assert/strict';
import {test} from 'node:test';
for (const [model, max] of [['doubao-seedance-2-0-mini-260615', 15], ['doubao-seedance-2-0-fast-260128', 15], ['doubao-seedance-2-5-260628', 30], ['seedance-2.5', 30]]) {
 test(`${model}: mapped limits and boundary plans`, () => {
  const config = { model, singleMaxSeconds: 15, duration: 15 };
  assert.equal(context.resolveSingleMax(config), max);
  assert.equal(context.resolveSegmentSeconds(config), max);
  assert.equal(context.resolveSegmentSeconds(config, 99), max);
  for (let total = 4; total <= 120; total++) {
   const plan = context.planVideoSegments(total, max, max);
   assert.equal(plan.reduce((n, s) => n + s.seconds, 0), total);
   assert.ok(plan.every(s => s.seconds >= 4 && s.seconds <= max));
   assert.equal(plan.length === 1, total <= max);
  }
 });
}

test('segment prompts reject missing or incomplete multi-segment input before submission', () => {
  assert.equal(context.resolveSegmentPrompts(undefined, 1), null);
  assert.throws(() => context.resolveSegmentPrompts(undefined, 2), /segmentPrompts/);
  assert.throws(() => context.resolveSegmentPrompts(['first'], 2));
  assert.throws(() => context.resolveSegmentPrompts(['first', '  '], 2));
  assert.equal(context.resolveSegmentPrompts([' first ', ' next '], 2).join('|'), 'first|next');
});

test('official image limits and mutually exclusive input roles', () => {
  assert.throws(() => context.validateImageRoles({lastFrameUrl:'last'}, 'seedance-2-0'));
  assert.throws(() => context.validateImageRoles({firstFrameUrl:'first', referenceImages:['ref']}, 'seedance-2-0'));
  const refs = Array.from({length:10}, (_,i)=>`image-${i}`);
  assert.throws(() => context.validateImageRoles({referenceImages:refs}, 'seedance-2-0'));
  assert.equal(context.validateImageRoles({referenceImages:refs}, 'seedance-2-5').refs.length, 10);
  assert.equal(context.validateImageRoles({referenceImages:refs.slice(0, 9)}, 'seedance-2-0').limit, 9);
  assert.throws(() => context.validateImageRoles({referenceImages:['']}, 'seedance-2-0'));
});
