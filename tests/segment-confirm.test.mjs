import { api as context } from './module-test-api.mjs';
import assert from 'node:assert/strict';
import {test} from 'node:test';

test('续做确认说清第几段做完、接下来第几段、整条还差多少', () => {
  const generated = context.segmentContinueLine({ toolName: 'metaontic_agent_forge_video_generate', done: 1, lastSeconds: 15, nextSeconds: 5 });
  assert.equal(generated.zh, '第 1 段（15 秒）已经生成好。接下来生成第 2 段（5 秒）');
  assert.match(generated.en, /Segment 1 \(15s\) is done/);
  assert.match(generated.en, /Next up: generate segment 2 \(5s\)/);

  const extended = context.segmentContinueLine({ toolName: 'metaontic_agent_forge_video_extend', done: 2, lastSeconds: 15, nextSeconds: 4 });
  assert.equal(extended.zh, '第 2 段（15 秒）已经生成好。接下来延长第 3 段（4 秒）');
  assert.match(extended.en, /Next up: extend segment 3 \(4s\)/);

  const first = context.segmentContinueLine({ done: 0, lastSeconds: 0, nextSeconds: 15 });
  assert.match(first.zh, /还没有生成任何分段/);
  assert.doesNotMatch(first.zh, /已经生成好/);
  assert.doesNotMatch(first.en, /Segment 0/);
});
