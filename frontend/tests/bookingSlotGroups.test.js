import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatTimeOnly,
  formatSelectedSlotSummary,
  groupSlots,
} from '../src/utils/bookingSlotGroups.js';

const TZ = 'America/Chicago';

describe('formatTimeOnly / formatSelectedSlotSummary', () => {
  it('formats a slot time in the shop timezone', () => {
    // 2026-08-10 15:00 UTC = 10:00 AM CDT
    const t = formatTimeOnly('2026-08-10T15:00:00.000Z', TZ);
    assert.match(t, /10:00\s*AM/i);
  });

  it('builds confirmation summary with duration once', () => {
    const summary = formatSelectedSlotSummary('2026-08-10T15:00:00.000Z', TZ, 30);
    assert.match(summary, /Monday, August 10/i);
    assert.match(summary, /10:00\s*AM/i);
    assert.match(summary, /30-minute drop-off/);
  });

  it('returns empty/fallback on invalid inputs', () => {
    assert.equal(formatTimeOnly('nope', TZ), '');
    assert.equal(formatSelectedSlotSummary('nope', 'Not/AZone', 30), 'nope');
  });
});

describe('groupSlots', () => {
  it('groups by en-CA calendar day in shop TZ and sorts days', () => {
    const grouped = groupSlots(
      [
        { slot_start_iso: '2026-08-11T15:00:00.000Z' }, // Tue CDT
        { slot_start_iso: '2026-08-10T20:00:00.000Z' }, // Mon CDT
        { slot_start_iso: '2026-08-10T15:00:00.000Z' }, // Mon CDT
      ],
      TZ,
      30
    );
    assert.equal(grouped.length, 2);
    assert.equal(grouped[0].dayKey, '2026-08-10');
    assert.equal(grouped[1].dayKey, '2026-08-11');
    assert.deepEqual(grouped[0].isoList, [
      '2026-08-10T20:00:00.000Z',
      '2026-08-10T15:00:00.000Z',
    ]);
    assert.match(grouped[0].label, /Monday, August 10/);
    assert.match(grouped[0].compactDay, /Mon.*Aug.*10/);
  });

  it('buckets invalid timestamps under the Suggested times fallback key', () => {
    // Intl.DateTimeFormat#format throws on Invalid Date → catch path uses dayKey '_'
    const broken = groupSlots([{ slot_start_iso: 'definitely-not-iso' }], TZ, 30);
    assert.equal(broken.length, 1);
    assert.equal(broken[0].dayKey, '_');
    assert.equal(broken[0].label, 'Suggested times');
    assert.equal(broken[0].compactDay, 'Open times');
    assert.deepEqual(broken[0].isoList, ['definitely-not-iso']);
  });

  it('returns empty list for null/empty slots', () => {
    assert.deepEqual(groupSlots(null, TZ, 30), []);
    assert.deepEqual(groupSlots([], TZ, 30), []);
  });
});
