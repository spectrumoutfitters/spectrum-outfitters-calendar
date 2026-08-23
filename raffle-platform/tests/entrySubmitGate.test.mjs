import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  ENTRY_RATE_MAX,
  ENTRY_RATE_WINDOW_MS,
  isHoneypotEntry,
  isTermsRejected,
  filterHitsInWindow,
  recordRateHit,
} from '../src/lib/entrySubmitGate.js';

describe('isHoneypotEntry', () => {
  it('treats any truthy company field as a bot', () => {
    assert.equal(isHoneypotEntry({ company: 'Acme' }), true);
    assert.equal(isHoneypotEntry({ company: ' ' }), true);
    assert.equal(isHoneypotEntry({ company: 1 }), true);
    assert.equal(isHoneypotEntry({ company: '' }), false);
    assert.equal(isHoneypotEntry({ company: 0 }), false);
    assert.equal(isHoneypotEntry({}), false);
    assert.equal(isHoneypotEntry(undefined), false);
  });
});

describe('isTermsRejected', () => {
  it('requires a truthy termsAccepted (1 / "true" pass; 0 / false fail)', () => {
    assert.equal(isTermsRejected({}), true);
    assert.equal(isTermsRejected({ termsAccepted: false }), true);
    assert.equal(isTermsRejected({ termsAccepted: 0 }), true);
    assert.equal(isTermsRejected({ termsAccepted: '' }), true);
    assert.equal(isTermsRejected({ termsAccepted: true }), false);
    assert.equal(isTermsRejected({ termsAccepted: 1 }), false);
    assert.equal(isTermsRejected({ termsAccepted: 'true' }), false);
  });
});

describe('recordRateHit', () => {
  it('allows 12 hits in the window and blocks the 13th', () => {
    const now = 1_000_000;
    let hits = [];
    for (let i = 0; i < ENTRY_RATE_MAX; i++) {
      const r = recordRateHit(hits, now + i);
      assert.equal(r.limited, false);
      hits = r.hits;
    }
    assert.equal(hits.length, ENTRY_RATE_MAX);
    const blocked = recordRateHit(hits, now + ENTRY_RATE_MAX);
    assert.equal(blocked.limited, true);
    assert.equal(blocked.hits.length, ENTRY_RATE_MAX);
  });

  it('drops timestamps outside the 1-hour window', () => {
    const now = 10_000_000;
    const stale = [now - ENTRY_RATE_WINDOW_MS - 1, now - ENTRY_RATE_WINDOW_MS];
    assert.deepEqual(filterHitsInWindow(stale, now), []);
    const r = recordRateHit(stale, now);
    assert.equal(r.limited, false);
    assert.deepEqual(r.hits, [now]);
  });
});
