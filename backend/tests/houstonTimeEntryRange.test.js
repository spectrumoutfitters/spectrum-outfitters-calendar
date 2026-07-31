/**
 * Regression: payroll/finance/compliance must bucket time entries by Houston
 * calendar days, not SQLite DATE(clock_in) which uses the UTC calendar day.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatDateInHouston,
  houstonInclusiveDateRangeToUtc,
  getHoustonWeekMondayToSundayUtcRange,
} from '../utils/appTimezone.js';

describe('houstonInclusiveDateRangeToUtc', () => {
  it('includes Friday evening Houston punches in a Mon–Fri week ending Friday', () => {
    // 2026-07-24 20:00 CDT = 2026-07-25T01:00:00Z (UTC calendar day is Saturday)
    const friEveHouston = '2026-07-25T01:00:00.000Z';
    assert.equal(formatDateInHouston(friEveHouston), '2026-07-24');

    const { startIso, endExclusiveIso } = houstonInclusiveDateRangeToUtc('2026-07-20', '2026-07-24');
    assert.ok(friEveHouston >= startIso && friEveHouston < endExclusiveIso);

    // Old SQLite DATE(clock_in) style would exclude this punch from Jul 20–24
    const sqliteDate = friEveHouston.slice(0, 10);
    assert.equal(sqliteDate, '2026-07-25');
    assert.equal(sqliteDate >= '2026-07-20' && sqliteDate <= '2026-07-24', false);
  });

  it('includes Sunday evening Houston punches in Mon–Sun payroll week', () => {
    // 2026-07-26 22:00 CDT = 2026-07-27T03:00:00Z
    const sunEveHouston = '2026-07-27T03:00:00.000Z';
    assert.equal(formatDateInHouston(sunEveHouston), '2026-07-26');

    const { weekStartMonday, weekEndSunday, startIso, endExclusiveIso } =
      getHoustonWeekMondayToSundayUtcRange('2026-07-26');
    assert.equal(weekStartMonday, '2026-07-20');
    assert.equal(weekEndSunday, '2026-07-26');
    assert.ok(sunEveHouston >= startIso && sunEveHouston < endExclusiveIso);

    const sqliteDate = sunEveHouston.slice(0, 10);
    assert.equal(sqliteDate, '2026-07-27');
    assert.equal(sqliteDate >= '2026-07-20' && sqliteDate <= '2026-07-26', false);
  });

  it('excludes the first instant of the next Houston day', () => {
    const { startIso, endExclusiveIso } = houstonInclusiveDateRangeToUtc('2026-07-20', '2026-07-24');
    // Saturday Jul 25 00:00 CDT
    const nextDayStart = endExclusiveIso;
    assert.equal(formatDateInHouston(nextDayStart), '2026-07-25');
    assert.equal(nextDayStart >= startIso && nextDayStart < endExclusiveIso, false);
  });

  it('rejects malformed dates', () => {
    assert.throws(() => houstonInclusiveDateRangeToUtc('07-20-2026', '2026-07-24'));
  });
});
