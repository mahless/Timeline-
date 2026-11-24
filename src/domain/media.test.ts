import assert from 'node:assert/strict';
import test from 'node:test';
import { computeScaledDimensions, shouldCompressImageMime } from './media.ts';

test('computeScaledDimensions preserves small images and scales down large images proportionally', () => {
  assert.deepEqual(computeScaledDimensions(1200, 900, 1600), {
    width: 1200,
    height: 900,
    scaled: false,
  });

  assert.deepEqual(computeScaledDimensions(4000, 3000, 1600), {
    width: 1600,
    height: 1200,
    scaled: true,
  });

  assert.deepEqual(computeScaledDimensions(2000, 4000, 1600), {
    width: 800,
    height: 1600,
    scaled: true,
  });
});

test('shouldCompressImageMime targets raster photos and skips SVG/GIF/documents', () => {
  assert.equal(shouldCompressImageMime('image/jpeg'), true);
  assert.equal(shouldCompressImageMime('image/png'), true);
  assert.equal(shouldCompressImageMime('image/webp'), true);
  assert.equal(shouldCompressImageMime('image/gif'), false);
  assert.equal(shouldCompressImageMime('image/svg+xml'), false);
  assert.equal(shouldCompressImageMime('application/pdf'), false);
});
