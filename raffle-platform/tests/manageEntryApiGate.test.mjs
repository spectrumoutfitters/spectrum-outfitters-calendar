import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  MANAGE_ENTRY_RATE_MAX,
  MANAGE_ENTRY_RATE_WINDOW_MS,
  filterHitsInWindow,
  isHoneypotManagePatch,
  isMissingIdentity,
  normalizeIdentityField,
  recordRateHit,
} from '../src/lib/manageEntryApiGate.js';

describe('normalizeIdentityField / isMissingIdentity', () => {
  it('trims slug/token and treats falsy or whitespace as missing', () => {
    assert.equal(normalizeIdentityField('  abc  '), 'abc');
    assert.equal(normalizeIdentityField(''), '');
    assert.equal(normalizeIdentityField('   '), '');
    assert.equal(normalizeIdentityField(null), '');
    assert.equal(normalizeIdentityField(undefined), '');
    assert.equal(normalizeIdentityField(0), '');
    assert.equal(isMissingIdentity('slug', 'token'), false);
    assert.equal(isMissingIdentity('', 'token'), true);
    assert.equal(isMissingIdentity('slug', ''), true);
    assert.equal(isMissingIdentity('', ''), true);
    assert.equal(isMissingIdentity('slug', null), true);
  });
});

describe('isHoneypotManagePatch', () => {
  it('treats any truthy company field as a bot (no terms check)', () => {
    assert.equal(isHoneypotManagePatch({ company: 'Acme' }), true);
    assert.equal(isHoneypotManagePatch({ company: ' ' }), true);
    assert.equal(isHoneypotManagePatch({ company: 1 }), true);
    assert.equal(isHoneypotManagePatch({ company: '' }), false);
    assert.equal(isHoneypotManagePatch({ company: 0 }), false);
    assert.equal(isHoneypotManagePatch({}), false);
    assert.equal(isHoneypotManagePatch(undefined), false);
  });
});

describe('recordRateHit (manage-entry is 24/hour, not the public 12)', () => {
  it('allows 24 hits in the window and blocks the 25th', () => {
    const now = 1_000_000;
    let hits = [];
    for (let i = 0; i < MANAGE_ENTRY_RATE_MAX; i++) {
      const r = recordRateHit(hits, now + i);
      assert.equal(r.limited, false);
      hits = r.hits;
    }
    assert.equal(hits.length, MANAGE_ENTRY_RATE_MAX);
    const blocked = recordRateHit(hits, now + MANAGE_ENTRY_RATE_MAX);
    assert.equal(blocked.limited, true);
    assert.equal(blocked.hits.length, MANAGE_ENTRY_RATE_MAX);
  });

  it('drops timestamps outside the 1-hour window', () => {
    const now = 10_000_000;
    const stale = [now - MANAGE_ENTRY_RATE_WINDOW_MS - 1, now - MANAGE_ENTRY_RATE_WINDOW_MS];
    assert.deepEqual(filterHitsInWindow(stale, now), []);
    const r = recordRateHit(stale, now);
    assert.equal(r.limited, false);
    assert.deepEqual(r.hits, [now]);
  });
});
