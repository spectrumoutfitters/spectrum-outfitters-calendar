import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getWeekEndingDate } from '../utils/helpers.js';

describe('getWeekEndingDate', () => {
  it('returns the Houston Sunday of the week for a date-only string', () => {
    assert.equal(getWeekEndingDate('2026-07-15'), '2026-07-19');
    assert.equal(getWeekEndingDate('2026-07-19'), '2026-07-19');
    assert.equal(getWeekEndingDate('2026-07-20'), '2026-07-26');
  });

  it('crosses the year boundary', () => {
    assert.equal(getWeekEndingDate('2026-01-01'), '2026-01-04');
    assert.equal(getWeekEndingDate('2026-12-31'), '2027-01-03');
  });

  it('uses the leading YYYY-MM-DD of a timestamp, not the Houston wall date', () => {
    // 2026-07-20T04:00:00Z is still July 19 in Houston, but the report key slices first.
    assert.equal(getWeekEndingDate('2026-07-20T04:00:00.000Z'), '2026-07-26');
  });
});
