import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { scaleImageDimensions } from '../src/lib/imageScale.js';

describe('scaleImageDimensions', () => {
  it('returns null for non-positive sizes', () => {
    assert.equal(scaleImageDimensions(0, 100, 1200), null);
    assert.equal(scaleImageDimensions(100, 0, 1200), null);
    assert.equal(scaleImageDimensions(-10, 10, 1200), null);
    assert.equal(scaleImageDimensions('abc', 10, 1200), null);
  });

  it('keeps size when already within maxWidth', () => {
    assert.deepEqual(scaleImageDimensions(800, 600, 1200), { width: 800, height: 600 });
  });

  it('downscales width to maxWidth and preserves aspect ratio', () => {
    assert.deepEqual(scaleImageDimensions(2000, 1000, 1000), { width: 1000, height: 500 });
  });

  it('rounds the scaled height', () => {
    assert.deepEqual(scaleImageDimensions(1000, 333, 100), { width: 100, height: 33 });
  });
});
