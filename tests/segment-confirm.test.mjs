import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { test } from 'node:test';

// 每段确认挂在 resume 入口（preflightGate 统一弹一次），文案由这个函数产出，
// 从构建产物里取出来单独验证，避免「源码改了、发的还是旧包」。
const source = readFileSync(new URL('../index.js', import.meta.url), 'utf8');
function extract(name) {
  const start = source.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `${name} 不在构建产物里`);
  const indent = source.slice(source.lastIndexOf('\n', start) + 1, start);
  const end = source.indexOf('\n' + indent + '}', start);
  return source.slice(start, end + indent.length + 2);
}

const context = vm.createContext({});
vm.runInContext(extract('segmentContinueLine'), context);

test('续做确认说清第几段做完、接下来第几段、整条还差多少', () => {
  const generated = context.segmentContinueLine({ toolName: 'video_generate', done: 1, lastSeconds: 15, nextSeconds: 5 });
  assert.equal(generated.zh, '第 1 段（15 秒）已经生成好。接下来生成第 2 段（5 秒）');
  assert.match(generated.en, /Segment 1 \(15s\) is done/);
  assert.match(generated.en, /Next up: generate segment 2 \(5s\)/);

  const extended = context.segmentContinueLine({ toolName: 'video_extend', done: 2, lastSeconds: 15, nextSeconds: 4 });
  assert.equal(extended.zh, '第 2 段（15 秒）已经生成好。接下来延长第 3 段（4 秒）');
  assert.match(extended.en, /Next up: extend segment 3 \(4s\)/);

  const first = context.segmentContinueLine({ done: 0, lastSeconds: 0, nextSeconds: 15 });
  assert.match(first.zh, /还没有生成任何分段/);
  assert.doesNotMatch(first.zh, /已经生成好/);
  assert.doesNotMatch(first.en, /Segment 0/);
});
