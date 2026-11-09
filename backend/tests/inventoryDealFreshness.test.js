import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const sourcePath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '../routes/inventory.js'
);

const SIX_HOURS_MS = 360 * 60 * 1000;
const NOW = Date.parse('2026-06-15T18:00:00.000Z');

/**
 * Load the deal-cache and barcode-image helpers without importing the route.
 * inventory.js opens the database and mounts Express at import time.
 * The clock is injected only in this copy so the age comparison stays deterministic.
 */
function loadInventoryFreshnessHelpers() {
  const src = fs.readFileSync(sourcePath, 'utf8');
  const isStaleSrc = sliceFunction(src, 'function isStale(lastFetchedAt, maxAgeMinutes = 360)');
  const ageLine = 'const ageMs = Date.now() - last.getTime();';
  if (!isStaleSrc.includes(ageLine)) {
    throw new Error('isStale no longer reads Date.now() on the age line; update the clock injection');
  }
  const injected = isStaleSrc
    .replace(
      'function isStale(lastFetchedAt, maxAgeMinutes = 360)',
      'function isStale(lastFetchedAt, maxAgeMinutes = 360, nowMs = Date.now())'
    )
    .replace(ageLine, 'const ageMs = nowMs - last.getTime();');
  const pickImageUrl = sliceFunction(src, 'function pickImageUrl(product)');
  const loaded = new Function(
    `${injected}\n${pickImageUrl}\nreturn { isStale, pickImageUrl };`
  )();
  return { src, ...loaded };
}

function sliceFunction(src, signature) {
  const start = src.indexOf(signature);
  if (start < 0) {
    throw new Error(`${signature} moved in inventory.js`);
  }
  const open = src.indexOf('{', start);
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    const ch = src[i];
    if (ch === '{') depth += 1;
    else if (ch === '}') {
      depth -= 1;
      if (depth === 0) return src.slice(start, i + 1);
    }
  }
  throw new Error(`${signature} is unterminated in inventory.js`);
}

const { src, isStale, pickImageUrl } = loadInventoryFreshnessHelpers();

describe('isStale', () => {
  it('is the six-hour gate on cached inventory deals', () => {
    assert.match(src, /autoRefresh && isStale\(meta\.last_fetched_at, 360\)/);
  });

  it('treats a missing or unparseable fetch time as stale', () => {
    for (const value of [null, undefined, '', 0, false]) {
      assert.equal(isStale(value, 360, NOW), true, `value ${String(value)}`);
    }
    assert.equal(isStale('not-a-date', 360, NOW), true);
    assert.equal(isStale('   ', 360, NOW), true);
  });

  it('stays fresh at the exact window and refreshes one millisecond later', () => {
    const exact = new Date(NOW - SIX_HOURS_MS).toISOString();
    const justOver = new Date(NOW - SIX_HOURS_MS - 1).toISOString();
    assert.equal(isStale(exact, 360, NOW), false);
    assert.equal(isStale(justOver, 360, NOW), true);
    assert.equal(isStale(exact, undefined, NOW), false);
    assert.equal(isStale(justOver, undefined, NOW), true);
  });

  it('keeps a future fetch fresh and honors a one-minute window', () => {
    assert.equal(isStale(new Date(NOW + 60_000).toISOString(), 360, NOW), false);
    assert.equal(isStale(new Date(NOW - 59_000).toISOString(), 1, NOW), false);
    assert.equal(isStale(new Date(NOW - 60_000).toISOString(), 1, NOW), false);
    assert.equal(isStale(new Date(NOW - 60_001).toISOString(), 1, NOW), true);
  });
});

describe('pickImageUrl', () => {
  it('is the image chosen when a barcode lookup reads Open Food Facts', () => {
    assert.match(src, /const image_url = pickImageUrl\(product\);/);
  });

  it('returns null when the product has no image fields', () => {
    assert.equal(pickImageUrl(null), null);
    assert.equal(pickImageUrl(undefined), null);
    assert.equal(pickImageUrl({}), null);
  });

  it('prefers the small front image and skips empty strings', () => {
    const images = {
      image_front_small_url: 'https://img.example/small.jpg',
      image_front_url: 'https://img.example/front.jpg',
      image_url: 'https://img.example/generic.jpg',
      image_thumb_url: 'https://img.example/thumb.jpg',
    };
    assert.equal(pickImageUrl(images), images.image_front_small_url);
    assert.equal(
      pickImageUrl({ ...images, image_front_small_url: '' }),
      images.image_front_url
    );
    assert.equal(
      pickImageUrl({ ...images, image_front_small_url: null, image_front_url: '' }),
      images.image_url
    );
    assert.equal(pickImageUrl({ image_thumb_url: images.image_thumb_url }), images.image_thumb_url);
    assert.equal(
      pickImageUrl({
        image_front_small_url: '',
        image_front_url: null,
        image_url: undefined,
        image_thumb_url: '',
      }),
      null
    );
  });
});
