import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  PUBLIC_WINNERS_SLUG_MAX,
  resolvePublicWinnersFeedUrl,
} from '../src/lib/publicWinnersFeedUrl.js';

const BASE = 'https://script.google.com/macros/s/abc/exec';

describe('resolvePublicWinnersFeedUrl', () => {
  it('rejects a bad slug before checking the Apps Script base', () => {
    assert.deepEqual(resolvePublicWinnersFeedUrl(null, ''), { error: 'invalid_slug' });
    assert.deepEqual(resolvePublicWinnersFeedUrl(BASE, null), { error: 'invalid_slug' });
    assert.deepEqual(resolvePublicWinnersFeedUrl(BASE, undefined), { error: 'invalid_slug' });
    assert.deepEqual(
      resolvePublicWinnersFeedUrl(BASE, 'a'.repeat(PUBLIC_WINNERS_SLUG_MAX + 1)),
      { error: 'invalid_slug' },
    );
  });

  it('reports a missing base only after the slug is acceptable', () => {
    assert.deepEqual(resolvePublicWinnersFeedUrl('', 'grand-opening'), {
      error: 'server_misconfigured',
    });
    assert.deepEqual(resolvePublicWinnersFeedUrl(null, '0'), {
      error: 'server_misconfigured',
    });
  });

  it('accepts "0" and a length-80 slug without trimming whitespace', () => {
    assert.equal(resolvePublicWinnersFeedUrl(BASE, '0').url, `${BASE}?action=getPublicWinnersFeed&slug=0`);
    const max = 'a'.repeat(PUBLIC_WINNERS_SLUG_MAX);
    assert.equal(
      resolvePublicWinnersFeedUrl(BASE, max).url,
      `${BASE}?action=getPublicWinnersFeed&slug=${max}`,
    );
    assert.equal(
      resolvePublicWinnersFeedUrl(BASE, '  summer  ').url,
      `${BASE}?action=getPublicWinnersFeed&slug=${encodeURIComponent('  summer  ')}`,
    );
  });

  it('encodes slug characters that would rewrite the Apps Script query', () => {
    const resolved = resolvePublicWinnersFeedUrl(BASE, 'summer&action=draw?x=1');
    assert.equal(
      resolved.url,
      `${BASE}?action=getPublicWinnersFeed&slug=summer%26action%3Ddraw%3Fx%3D1`,
    );
    assert.equal(resolved.url.includes('action=draw'), false);
    const actions = resolved.url.match(/action=/g) || [];
    assert.equal(actions.length, 1);
  });
});
