import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  displayTimeEntryClockOut,
  isTimeEntryStillInProgress,
  matchLunchBreak,
} from '../src/utils/timeEntryLunchPair.js';

const lunch = (clockOut, clockIn = '2026-08-31T17:00:00.000Z') => ({
  clockOut,
  clockIn,
});

describe('matchLunchBreak — pre-lunch (60s window)', () => {
  it('pairs when lunch-out is within 59s of entry clock_out', () => {
    const entry = { isPreLunchWork: true, clock_out: '2026-08-31T16:00:00.000Z' };
    const near = lunch('2026-08-31T16:00:59.000Z');
    const found = matchLunchBreak(entry, [near], [entry], 0);
    assert.equal(found, near);
  });

  it('does not primary-match at exactly 60s (strict <); single-lunch fallback still applies', () => {
    const entry = { isPreLunchWork: true, clock_out: '2026-08-31T16:00:00.000Z' };
    const edge = lunch('2026-08-31T16:01:00.000Z');
    assert.equal(matchLunchBreak(entry, [edge], [entry], 0, { fallback: 'employee' }), edge);
  });

  it('rejects a 60s miss when multiple lunches exist (no fallback)', () => {
    const entry = { isPreLunchWork: true, clock_out: '2026-08-31T16:00:00.000Z' };
    const far = lunch('2026-08-31T16:01:00.000Z');
    const other = lunch('2026-08-31T20:00:00.000Z');
    assert.equal(matchLunchBreak(entry, [far, other], [entry], 0, { fallback: 'employee' }), null);
  });

  it('requires both lunch.clockOut and entry.clock_out', () => {
    const entry = { isPreLunchWork: true, clock_out: null };
    const only = lunch('2026-08-31T16:00:00.000Z');
    // no primary match; employee single-lunch fallback still applies
    assert.equal(matchLunchBreak(entry, [only], [entry], 0), only);
    assert.equal(matchLunchBreak(entry, [only, lunch('2026-08-31T18:00:00.000Z')], [entry], 0), null);
  });
});

describe('matchLunchBreak — during work period', () => {
  it('matches lunch-out in [entryIn, nextEntryIn)', () => {
    const a = { clock_in: '2026-08-31T13:00:00.000Z', clock_out: '2026-08-31T21:00:00.000Z' };
    const b = { clock_in: '2026-08-31T21:30:00.000Z', clock_out: '2026-08-31T22:00:00.000Z' };
    const mid = lunch('2026-08-31T17:00:00.000Z');
    assert.equal(matchLunchBreak(a, [mid], [a, b], 0), mid);
  });

  it('is inclusive of entry clock-in and exclusive of next clock-in', () => {
    const a = { clock_in: '2026-08-31T13:00:00.000Z', clock_out: '2026-08-31T17:00:00.000Z' };
    const b = { clock_in: '2026-08-31T17:30:00.000Z', clock_out: '2026-08-31T21:00:00.000Z' };
    const atStart = lunch('2026-08-31T13:00:00.000Z');
    const atNext = lunch('2026-08-31T17:30:00.000Z');
    const decoy = lunch('2026-08-31T08:00:00.000Z');
    assert.equal(matchLunchBreak(a, [atStart, decoy], [a, b], 0), atStart);
    // two lunches so the employee single-row fallback cannot mask the exclusive bound
    assert.equal(matchLunchBreak(a, [atNext, decoy], [a, b], 0), null);
  });

  it('uses injected now when the entry is still open (no live Date.now)', () => {
    const open = { clock_in: '2026-08-31T13:00:00.000Z', clock_out: null };
    const later = lunch('2026-08-31T18:00:00.000Z');
    const nowBefore = '2026-08-31T17:00:00.000Z';
    const nowAfter = '2026-08-31T19:00:00.000Z';
    assert.equal(
      matchLunchBreak(open, [later], [open], 0, { now: nowBefore, fallback: 'employee' }),
      later, // single-lunch fallback
    );
    // two lunches: no fallback; lunch after `now` (used as entryOut/nextEntryIn) is excluded
    const other = lunch('2026-08-31T12:00:00.000Z');
    assert.equal(
      matchLunchBreak(open, [later, other], [open], 0, { now: nowBefore }),
      null,
    );
    assert.equal(
      matchLunchBreak(open, [later, other], [open], 0, { now: nowAfter }),
      later,
    );
  });
});

describe('matchLunchBreak — admin closest fallback', () => {
  it('picks the closest lunch-out within 2 hours', () => {
    const entry = { clock_in: '2026-08-31T13:00:00.000Z', clock_out: '2026-08-31T21:00:00.000Z' };
    const near = lunch('2026-08-31T20:00:00.000Z');
    const far = lunch('2026-08-31T12:00:00.000Z');
    assert.equal(matchLunchBreak(entry, [far, near], [entry], 0, { fallback: 'admin' }), near);
  });

  it('rejects closest lunch at/over 2 hours', () => {
    const entry = { clock_in: '2026-08-31T13:00:00.000Z', clock_out: '2026-08-31T21:00:00.000Z' };
    const twoHours = lunch('2026-08-31T23:00:00.000Z');
    const other = lunch('2026-08-31T08:00:00.000Z');
    assert.equal(matchLunchBreak(entry, [twoHours, other], [entry], 0, { fallback: 'admin' }), null);
  });
});

describe('isTimeEntryStillInProgress / displayTimeEntryClockOut', () => {
  it('regular entries are in progress only without clock_out', () => {
    assert.equal(isTimeEntryStillInProgress({ clock_out: null }, null), true);
    assert.equal(isTimeEntryStillInProgress({ clock_out: '2026-08-31T21:00:00.000Z' }, null), false);
  });

  it('pre-lunch in-progress reduces to !clock_out (first clause is redundant)', () => {
    const lunchBreak = { clockIn: '2026-08-31T17:00:00.000Z' };
    assert.equal(
      isTimeEntryStillInProgress(
        { isPreLunchWork: true, original_clock_out: '2026-08-31T16:00:00.000Z', clock_out: null },
        lunchBreak,
      ),
      true,
    );
    assert.equal(
      isTimeEntryStillInProgress(
        { isPreLunchWork: true, original_clock_out: '2026-08-31T16:00:00.000Z', clock_out: '2026-08-31T21:00:00.000Z' },
        lunchBreak,
      ),
      false,
    );
  });

  it('hides pre-lunch clock_out when it equals original_clock_out', () => {
    const same = '2026-08-31T16:00:00.000Z';
    assert.equal(
      displayTimeEntryClockOut({ isPreLunchWork: true, original_clock_out: same, clock_out: same }),
      null,
    );
    assert.equal(
      displayTimeEntryClockOut({
        isPreLunchWork: true,
        original_clock_out: same,
        clock_out: '2026-08-31T21:00:00.000Z',
      }),
      '2026-08-31T21:00:00.000Z',
    );
    assert.equal(
      displayTimeEntryClockOut({ isPreLunchWork: false, clock_out: same }),
      same,
    );
  });
});
