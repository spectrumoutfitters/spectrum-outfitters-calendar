import { afterEach, describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import { getTodayCentralTime } from '../src/utils/helpers.js';

/**
 * Timesheets, the admin time clock, and the dashboard schedule query all
 * treat this string as "today" in America/Chicago. A UTC calendar date
 * would mark the wrong day for an hour around Houston midnight, and for
 * two hours in winter.
 */
describe('getTodayCentralTime', () => {
  afterEach(() => {
    mock.timers.reset();
  });

  it('stays on the previous Houston day until CDT midnight', () => {
    // July is UTC-5. 04:59Z is 23:59 in Houston; 05:00Z is midnight.
    mock.timers.enable({ apis: ['Date'], now: new Date('2026-07-15T04:59:00.000Z') });
    assert.equal(getTodayCentralTime(), '2026-07-14');

    mock.timers.reset();
    mock.timers.enable({ apis: ['Date'], now: new Date('2026-07-15T05:00:00.000Z') });
    assert.equal(getTodayCentralTime(), '2026-07-15');
  });

  it('uses the six-hour CST offset in January, not a fixed UTC-5', () => {
    // January is UTC-6. A hard-coded summer offset would already call this the 15th.
    mock.timers.enable({ apis: ['Date'], now: new Date('2026-01-15T05:59:00.000Z') });
    assert.equal(getTodayCentralTime(), '2026-01-14');

    mock.timers.reset();
    mock.timers.enable({ apis: ['Date'], now: new Date('2026-01-15T06:00:00.000Z') });
    assert.equal(getTodayCentralTime(), '2026-01-15');
  });

  it('follows standard time again after the November clock change', () => {
    // 2026-11-01 is the fall-back day. Nov 2 is CST (UTC-6) for the whole day.
    mock.timers.enable({ apis: ['Date'], now: new Date('2026-11-02T05:59:00.000Z') });
    assert.equal(getTodayCentralTime(), '2026-11-01');

    mock.timers.reset();
    mock.timers.enable({ apis: ['Date'], now: new Date('2026-11-02T06:00:00.000Z') });
    assert.equal(getTodayCentralTime(), '2026-11-02');
  });
});
