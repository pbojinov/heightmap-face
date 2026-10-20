import test from 'node:test';
import assert from 'node:assert/strict';
import { createMeshIndices, heightMapFromRgba } from '../src/heightmap.ts';

test('transparent background never becomes a surface', () => {
  const pixels = new Uint8ClampedArray([255,255,255,0, 255,255,255,255, 0,0,0,255, 128,128,128,255]);
  const result = heightMapFromRgba(pixels, 2, 2);
  assert.deepEqual([...result.mask], [0,1,1,1]);
  assert.equal(result.heights[0], 0);
  assert.equal(result.heights[1], 1);
  assert.equal(result.heights[2], 0);
  const indices = createMeshIndices(result.mask, 2, 2);
  assert.equal(indices.length, 3);
  assert.ok(indices.every(index => result.mask[index] === 1));
});
test('a full mask forms both triangles and an empty mask forms none', () => {
  assert.equal(createMeshIndices(new Uint8Array(4).fill(1),2,2).length,6);
  assert.equal(createMeshIndices(new Uint8Array(4),2,2).length,0);
});
test('mesh indices stay inside the image and exclude masked pixels', () => {
  const mask = new Uint8Array([0,1,1,0, 1,1,1,1, 0,1,1,0]);
  const indices = createMeshIndices(mask,4,3);
  assert.ok(indices.length > 0);
  assert.ok(indices.every(index => index >= 0 && index < mask.length && mask[index] === 1));
});
test('malformed image and mask dimensions fail explicitly', () => {
  assert.throws(() => heightMapFromRgba(new Uint8ClampedArray(4),2,2));
  assert.throws(() => createMeshIndices(new Uint8Array(3),2,2));
});
