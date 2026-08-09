import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  daysOffWindowBounds,
  calendarDaysBetween,
  buildUpcomingDaysOffResult,
  buildRecentlyReturnedResult,
} from '../utils/upcomingDaysOffMath.js';

describe('daysOffWindowBounds', () => {
  it('builds today / +14 / -3 YYYY-MM-DD bounds from a fixed local noon', () => {
    // Local noon avoids UTC day-boundary drift for US-like offsets when asserting strings.
    const now = new Date(2026, 7, 9, 12, 0, 0); // Aug 9, 2026 local
    const { today, todayStr, in14Str, threeDaysAgoStr } = daysOffWindowBounds(now);

    assert.equal(today.getHours(), 0);
    assert.equal(today.getMinutes(), 0);
    assert.equal(todayStr, today.toISOString().split('T')[0]);
    assert.equal(in14Str, new Date(today.getFullYear(), today.getMonth(), today.getDate() + 14)
      .toISOString()
      .split('T')[0]);
    assert.equal(
      threeDaysAgoStr,
      new Date(today.getFullYear(), today.getMonth(), today.getDate() - 3)
        .toISOString()
        .split('T')[0]
    );

    // Explicit expected calendar strings for this fixture (UTC date of local-midnight Aug 9).
    const expectedToday = new Date(2026, 7, 9, 0, 0, 0).toISOString().split('T')[0];
    assert.equal(todayStr, expectedToday);
  });
});

describe('calendarDaysBetween', () => {
  it('returns 0 for the same local calendar day', () => {
    const today = new Date(2026, 7, 9, 0, 0, 0);
    assert.equal(calendarDaysBetween(today, today), 0);
  });

  it('counts forward and backward whole days', () => {
    const today = new Date(2026, 7, 9, 0, 0, 0);
    assert.equal(calendarDaysBetween(today, new Date(2026, 7, 12, 0, 0, 0)), 3);
    assert.equal(calendarDaysBetween(new Date(2026, 7, 6, 0, 0, 0), today), 3);
  });

  it('accepts YYYY-MM-DD strings (UTC midnight parse, then local hour zeroing)', () => {
    const today = new Date(2026, 7, 9, 0, 0, 0);
    // Assert current route behavior rather than "correcting" timezone parse quirks.
    assert.equal(
      calendarDaysBetween(today, '2026-08-09'),
      Math.round(
        (new Date(new Date('2026-08-09').setHours(0, 0, 0, 0)) - today) / 86400000
      )
    );
  });
});

describe('buildUpcomingDaysOffResult / buildRecentlyReturnedResult', () => {
  const today = new Date(2026, 7, 9, 0, 0, 0);

  it('returns null when no row', () => {
    assert.equal(buildUpcomingDaysOffResult(null, today), null);
    assert.equal(buildRecentlyReturnedResult(undefined, today), null);
  });

  it('sets days_remaining from start_date vs today', () => {
    const result = buildUpcomingDaysOffResult(
      { start_date: '2026-08-12', end_date: '2026-08-15' },
      today
    );
    assert.equal(result.start_date, '2026-08-12');
    assert.equal(result.end_date, '2026-08-15');
    assert.equal(result.days_remaining, calendarDaysBetween(today, '2026-08-12'));
  });

  it('sets days_since from end_date vs today', () => {
    const result = buildRecentlyReturnedResult(
      { start_date: '2026-08-01', end_date: '2026-08-07' },
      today
    );
    assert.equal(result.days_since, calendarDaysBetween('2026-08-07', today));
  });
});
