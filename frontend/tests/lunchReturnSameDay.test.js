import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  isLunchReturnSameDayCandidate,
  isLunchReturnTimeMatch,
  notesLookLikeLunchBreak,
  pickEarliestLunchReturn,
} from '../src/utils/lunchReturnSameDay.js';

const lunchOutIso = '2026-03-10T17:00:00.000Z';

describe('notesLookLikeLunchBreak', () => {
  it('matches lunch break notes case-insensitively', () => {
    assert.equal(notesLookLikeLunchBreak('Lunch break'), true);
    assert.equal(notesLookLikeLunchBreak('went to LUNCH BREAK early'), true);
    assert.equal(notesLookLikeLunchBreak('left for parts'), false);
    assert.equal(notesLookLikeLunchBreak(''), false);
    assert.equal(notesLookLikeLunchBreak(null), false);
  });
});

describe('isLunchReturnTimeMatch', () => {
  it('matches a same-entry clock-in within 5 minutes and excludes lunch rows', () => {
    assert.equal(
      isLunchReturnTimeMatch(
        { id: 2, clock_in: '2026-03-10T17:03:00.000Z' },
        { lunchEntryId: 1, originalReturnIso: '2026-03-10T17:00:00.000Z' },
      ),
      true,
    );
    assert.equal(
      isLunchReturnTimeMatch(
        { id: 2, clock_in: '2026-03-10T17:06:00.000Z' },
        { lunchEntryId: 1, originalReturnIso: '2026-03-10T17:00:00.000Z' },
      ),
      false,
    );
    assert.equal(
      isLunchReturnTimeMatch(
        { id: 1, clock_in: '2026-03-10T17:00:00.000Z' },
        { lunchEntryId: 1, originalReturnIso: '2026-03-10T17:00:00.000Z' },
      ),
      false,
    );
    assert.equal(
      isLunchReturnTimeMatch(
        { id: 2, clock_in: '2026-03-10T17:00:00.000Z', notes: 'Lunch break' },
        { lunchEntryId: 1, originalReturnIso: '2026-03-10T17:00:00.000Z' },
      ),
      false,
    );
  });
});

describe('isLunchReturnSameDayCandidate', () => {
  it('accepts the next clock-in after lunch on the same UTC day', () => {
    assert.equal(
      isLunchReturnSameDayCandidate(
        { id: 2, clock_in: '2026-03-10T18:00:00.000Z' },
        { lunchEntryId: 1, lunchOutIso },
      ),
      true,
    );
  });

  it('rejects the next calendar day even when it is after lunch-out', () => {
    assert.equal(
      isLunchReturnSameDayCandidate(
        { id: 9, clock_in: '2026-03-11T13:00:00.000Z' },
        { lunchEntryId: 1, lunchOutIso },
      ),
      false,
    );
  });

  it('rejects self, lunch-break notes, missing clock-in, and punches before lunch-out', () => {
    assert.equal(
      isLunchReturnSameDayCandidate(
        { id: 1, clock_in: '2026-03-10T18:00:00.000Z' },
        { lunchEntryId: 1, lunchOutIso },
      ),
      false,
    );
    assert.equal(
      isLunchReturnSameDayCandidate(
        { id: 2, clock_in: '2026-03-10T18:00:00.000Z', notes: 'Lunch break' },
        { lunchEntryId: 1, lunchOutIso },
      ),
      false,
    );
    assert.equal(
      isLunchReturnSameDayCandidate({ id: 2 }, { lunchEntryId: 1, lunchOutIso }),
      false,
    );
    assert.equal(
      isLunchReturnSameDayCandidate(
        { id: 2, clock_in: '2026-03-10T16:59:00.000Z' },
        { lunchEntryId: 1, lunchOutIso },
      ),
      false,
    );
  });
});

describe('pickEarliestLunchReturn', () => {
  it('returns the earliest same-day candidate and ignores next-day punches', () => {
    const picked = pickEarliestLunchReturn(
      [
        { id: 1, clock_in: lunchOutIso, notes: 'Lunch break' },
        { id: 4, clock_in: '2026-03-10T19:00:00.000Z' },
        { id: 3, clock_in: '2026-03-10T18:15:00.000Z' },
        { id: 9, clock_in: '2026-03-11T13:00:00.000Z' },
      ],
      { lunchEntryId: 1, lunchOutIso },
    );
    assert.equal(picked?.id, 3);
  });

  it('returns null when no same-day return exists', () => {
    assert.equal(
      pickEarliestLunchReturn(
        [{ id: 9, clock_in: '2026-03-11T13:00:00.000Z' }],
        { lunchEntryId: 1, lunchOutIso },
      ),
      null,
    );
  });
});
