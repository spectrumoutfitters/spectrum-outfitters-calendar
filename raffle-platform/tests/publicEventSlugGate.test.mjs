import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  PUBLIC_EVENT_SLUG_MAX,
  isValidPublicEventSlug,
} from '../src/lib/publicEventSlugGate.js';

describe('isValidPublicEventSlug', () => {
  it('rejects missing / empty / falsy slugs; accepts "0"', () => {
    assert.equal(isValidPublicEventSlug(''), false);
    assert.equal(isValidPublicEventSlug(null), false);
    assert.equal(isValidPublicEventSlug(undefined), false);
    assert.equal(isValidPublicEventSlug(0), false);
    assert.equal(isValidPublicEventSlug('0'), true);
    assert.equal(isValidPublicEventSlug('grand-opening'), true);
  });

  it('does not trim: whitespace-only is valid if length ≤ 80', () => {
    assert.equal(isValidPublicEventSlug(' '), true);
    assert.equal(isValidPublicEventSlug('  grand-opening  '), true);
  });

  it('allows length 80 inclusive and rejects 81+', () => {
    const max = 'a'.repeat(PUBLIC_EVENT_SLUG_MAX);
    const over = 'a'.repeat(PUBLIC_EVENT_SLUG_MAX + 1);
    assert.equal(max.length, 80);
    assert.equal(isValidPublicEventSlug(max), true);
    assert.equal(isValidPublicEventSlug(over), false);
  });

  it('does not strip special characters (unlike upload safeSlugSegment)', () => {
    assert.equal(isValidPublicEventSlug('../etc'), true);
    assert.equal(isValidPublicEventSlug('event slug!'), true);
  });
});
