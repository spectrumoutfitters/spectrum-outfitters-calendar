import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isDuplicateOfLunchWorkEntry } from '../utils/lunchEntryDedupe.js';

describe('isDuplicateOfLunchWorkEntry', () => {
  const lunch = {
    id: 20,
    clock_in: '2026-08-01T15:00:00.000Z', // 10:00 Houston CDT
    clock_out: '2026-08-01T17:00:00.000Z', // 12:00 Houston CDT
    notes: 'Lunch break',
  };

  it('keeps an earlier non-overlapping work session before lunch work starts', () => {
    const early = {
      id: 10,
      clock_in: '2026-08-01T13:00:00.000Z', // 08:00
      clock_out: '2026-08-01T14:00:00.000Z', // 09:00
    };
    assert.equal(isDuplicateOfLunchWorkEntry(early, lunch), false);
  });

  it('flags a true duplicate that starts inside the lunch work window', () => {
    const dup = {
      id: 11,
      clock_in: '2026-08-01T15:00:00.000Z', // same start as lunch work
      clock_out: '2026-08-01T16:30:00.000Z',
    };
    assert.equal(isDuplicateOfLunchWorkEntry(dup, lunch), true);
  });

  it('flags a mid-morning duplicate that starts after lunch.clock_in but before lunch.clock_out', () => {
    const mid = {
      id: 12,
      clock_in: '2026-08-01T15:30:00.000Z', // 10:30
      clock_out: '2026-08-01T16:00:00.000Z',
    };
    assert.equal(isDuplicateOfLunchWorkEntry(mid, lunch), true);
  });

  it('keeps post-lunch return work that starts at or after lunch.clock_out', () => {
    const after = {
      id: 30,
      clock_in: '2026-08-01T18:00:00.000Z', // 13:00
      clock_out: '2026-08-01T22:00:00.000Z', // 17:00
    };
    assert.equal(isDuplicateOfLunchWorkEntry(after, lunch), false);
  });

  it('does not treat the lunch entry as a duplicate of itself', () => {
    assert.equal(isDuplicateOfLunchWorkEntry(lunch, lunch), false);
  });

  it('returns false when lunch clock_out is missing', () => {
    const openLunch = { id: 21, clock_in: '2026-08-01T15:00:00.000Z', clock_out: null };
    const early = { id: 10, clock_in: '2026-08-01T13:00:00.000Z' };
    assert.equal(isDuplicateOfLunchWorkEntry(early, openLunch), false);
  });
});
