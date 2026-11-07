import { sourceOf } from './source.mjs';
import {api} from './module-test-api.mjs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { test } from 'node:test';


function harness() {
  const resolved = [];
  const context = vm.createContext({
    FIXED_RESOLUTION: '720p',
    resolveModel: config => config.model,
    isVolcengine: config => config.connectionMode === 'volcengine',
    ref: (config, key, fallback) => config[key] ?? fallback,
    canvasSize: () => null,
    buildGenerationPrompt: ({ prompt }) => prompt,
    parseExtraParams: config => config.extraParams ?? {},
    resolveImageInput: async (value, label) => {
      resolved.push({ value, label });
      return { url: value, source: 'test' };
    },
  });
  context.resolveResolution = api.resolveResolution;
  context.isOmniExtendModel = api.isOmniExtendModel;
  const mocks = {validateImageRoles: api.validateImageRoles, canvasSize: context.canvasSize, resolveImageInput: context.resolveImageInput};
  vm.runInContext(sourceOf('media/references','providers/seedance'), context);
  Object.assign(context,mocks);
  return { context, resolved };
}

for (const connectionMode of ['service', 'metaontic', 'volcengine']) {
  test(`${connectionMode}: 1, 2, 3 and 9 references all retain order and explicit roles`, async () => {
    const { context, resolved } = harness();
    const config = { connectionMode, model: 'doubao-seedance-2-0-mini-260615' };
    for (const count of [1, 2, 3, 9]) {
      const refs = Array.from({ length: count }, (_, i) => `https://example.com/image-${i + 1}.png`);
      const result = await context.buildGenerationBody(config, { prompt: '图片1人物，图片2场景', referenceImages: refs }, 5);
      const content = JSON.parse(JSON.stringify(result.body.content));
      assert.deepEqual(content.slice(1), refs.map(url => ({ type: 'image_url', image_url: { url }, role: 'reference_image' })));
      assert.deepEqual(JSON.parse(JSON.stringify(result.images)).map(image => image.url), refs);
      assert.equal(content[0].type, 'text');
      assert.equal(result.notes.length, 0);
      for (const key of ['metadata', 'reference_mode', 'image_urls']) assert.equal(Object.hasOwn(result.body, key), false);
    }
    assert.equal(resolved.length, 15);
  });

  test(`${connectionMode}: invalid count, roles and blank references fail before reading images`, async () => {
    const { context, resolved } = harness();
    const config = { connectionMode, model: 'doubao-seedance-2-0-mini-260615' };
    for (const args of [
      { referenceImages: Array(10).fill('https://example.com/ref.png') },
      { firstFrameUrl: 'first', referenceImages: ['ref'] },
      { firstFrameUrl: 'first', lastFrameUrl: 'last', referenceImages: ['ref'] },
      { lastFrameUrl: 'last' },
      { referenceImages: ['valid', '  '] },
    ]) await assert.rejects(context.buildGenerationBody(config, { prompt: 'test', ...args }, 5));
    assert.equal(resolved.length, 0);
  });

  test(`${connectionMode}: 2.5 accepts 30 references and rejects 31`, async () => {
    const { context, resolved } = harness();
    const config = { connectionMode, model: 'doubao-seedance-2-5-260628' };
    const refs = Array.from({ length: 30 }, (_, i) => `https://example.com/${i}.png`);
    const result = await context.buildGenerationBody(config, { referenceImages: refs }, 5);
    assert.equal(result.images.length, 30);
    await assert.rejects(context.buildGenerationBody(config, { referenceImages: [...refs, 'extra'] }, 5), /30/);
    assert.equal(resolved.length, 30);
  });

  test(`${connectionMode}: first/last-frame roles remain intact`, async () => {
    const { context } = harness();
    const config = { connectionMode, model: 'doubao-seedance-2-0-mini-260615' };
    const { body } = await context.buildGenerationBody(config, { firstFrameUrl: 'first', lastFrameUrl: 'last' }, 5);
    assert.deepEqual(Array.from(body.content.slice(1), item => item.role), ['first_frame', 'last_frame']);
  });
}

test('relay rejects an oversized inline-image body before sending any request', async () => {
  let fetchCalls = 0;
  const context = vm.createContext({
    Buffer, AbortSignal, RELAY_TIMEOUT_MS: 1000,
    resolveBaseUrl: () => 'https://example.com',
    fetch: async () => { fetchCalls++; throw new Error('unexpected network call'); },
  });
  vm.runInContext(sourceOf('providers/transport'), context);
  const oversized = { content: [{ type: 'image_url', image_url: { url: 'x'.repeat(64 * 1024 * 1024) } }] };
  await assert.rejects(context.relayRequestCore({ connectionMode: 'service' }, '/doubao/api/v3/contents/generations/tasks', {
    method: 'POST', body: oversized,
  }), error => error.code === 'request_too_large');
  assert.equal(fetchCalls, 0);
});
