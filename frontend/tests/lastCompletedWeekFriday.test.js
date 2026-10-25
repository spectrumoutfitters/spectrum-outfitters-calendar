import assert from 'node:assert/strict';
import { afterEach, describe, it, mock } from 'node:test';
import { getLastCompletedWeekFridayHouston } from '../src/utils/helpers.js';

/**
 * Dashboard weekly P&L asks for this Friday. Monday–Friday still belong to the
 * previous completed week. The key advances at Houston midnight on Saturday,
 * including across the daylight-saving change, so a fixed UTC offset is wrong.
 */
const CASES = [
  ['2026-01-01T15:00:00.000Z', '2025-12-26', 'Thursday in a new year'],
  ['2026-01-02T15:00:00.000Z', '2025-12-26', 'Friday does not close its own week'],
  ['2026-01-03T05:59:00.000Z', '2025-12-26', 'CST Friday one minute before Saturday'],
  ['2026-01-03T06:00:00.000Z', '2026-01-02', 'CST Saturday midnight'],
  ['2026-01-04T15:00:00.000Z', '2026-01-02', 'Sunday stays on the Friday that just ended'],
  ['2026-01-05T15:00:00.000Z', '2026-01-02', 'Monday opens the next business week'],
  ['2026-03-07T05:59:00.000Z', '2026-02-27', 'Friday before spring-forward, still CST'],
  ['2026-03-07T06:00:00.000Z', '2026-03-06', 'Saturday before spring-forward'],
  ['2026-03-08T15:00:00.000Z', '2026-03-06', 'spring-forward Sunday'],
  ['2026-03-09T15:00:00.000Z', '2026-03-06', 'Monday after spring-forward'],
  ['2026-03-14T04:59:00.000Z', '2026-03-06', 'first CDT Friday, one minute before Saturday'],
  ['2026-03-14T05:00:00.000Z', '2026-03-13', 'first CDT Saturday midnight'],
  ['2026-07-04T04:59:00.000Z', '2026-06-26', 'midsummer CDT Friday'],
  ['2026-07-04T05:00:00.000Z', '2026-07-03', 'midsummer CDT Saturday'],
  ['2026-10-31T04:59:00.000Z', '2026-10-23', 'Friday before fall-back, still CDT'],
  ['2026-10-31T05:00:00.000Z', '2026-10-30', 'Saturday before fall-back'],
  ['2026-11-01T15:00:00.000Z', '2026-10-30', 'fall-back Sunday does not move the week'],
  ['2026-11-07T05:59:00.000Z', '2026-10-30', 'first CST Friday after fall-back'],
  ['2026-11-07T06:00:00.000Z', '2026-11-06', 'first CST Saturday after fall-back'],
];

describe('getLastCompletedWeekFridayHouston', () => {
  afterEach(() => {
    mock.timers.reset();
  });

  for (const [now, expected, label] of CASES) {
    it(`${label} (${now})`, () => {
      mock.timers.enable({ apis: ['Date'], now: new Date(now) });
      assert.equal(getLastCompletedWeekFridayHouston(), expected);
    });
  }
});
