import { sourceOf } from './source.mjs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { test } from 'node:test';
const ctx = vm.createContext({});
vm.runInContext(sourceOf('businesses/video/connection-defaults') + '\nObject.assign(globalThis,{IMAGE_MODEL,resolveImageModel,connectionDefaults});', ctx);
test('the retired Seedream model is normalized to the in-sale pro model', () => {
  assert.equal(ctx.IMAGE_MODEL, 'doubao-seedream-5-0-pro-260628');
  for (const stored of ['doubao-seedream-5-0-260128', '', '   ', undefined]) {
    assert.equal(ctx.resolveImageModel(stored), 'doubao-seedream-5-0-pro-260628');
    assert.equal(ctx.connectionDefaults({ imageModel: stored }).imageModel, 'doubao-seedream-5-0-pro-260628');
  }
  assert.equal(ctx.resolveImageModel('custom-image-model'), 'custom-image-model');
  assert.equal(ctx.connectionDefaults({}).imageModel, 'doubao-seedream-5-0-pro-260628');
});
