import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  getHoustonDayOfWeek,
  getHoustonDayOfMonth,
} from '../utils/houstonCalendarParts.js';

describe('getHoustonDayOfWeek / getHoustonDayOfMonth', () => {
  it('uses America/Chicago across the CST midnight boundary', () => {
    // 2026-01-02 05:59:59Z = Jan 1 11:59 PM CST
    const before = new Date('2026-01-02T05:59:59.000Z');
    assert.equal(getHoustonDayOfWeek(before), 4); // Thursday
    assert.equal(getHoustonDayOfMonth(before), 1);

    // 2026-01-02 06:00:00Z = Jan 2 12:00 AM CST (Friday)
    const after = new Date('2026-01-02T06:00:00.000Z');
    assert.equal(getHoustonDayOfWeek(after), 5); // Friday
    assert.equal(getHoustonDayOfMonth(after), 2);
  });

  it('uses America/Chicago across the CDT midnight boundary', () => {
    // 2026-08-07 04:59:59Z = Aug 6 11:59 PM CDT
    const before = new Date('2026-08-07T04:59:59.000Z');
    assert.equal(getHoustonDayOfWeek(before), 4); // Thursday
    assert.equal(getHoustonDayOfMonth(before), 6);

    // 2026-08-07 05:00:00Z = Aug 7 12:00 AM CDT (Friday)
    const after = new Date('2026-08-07T05:00:00.000Z');
    assert.equal(getHoustonDayOfWeek(after), 5); // Friday
    assert.equal(getHoustonDayOfMonth(after), 7);
  });

  it('handles spring-forward DST gap (no 2am CDT)', () => {
    // After spring forward 2026-03-08: 07:00Z = 1:00 AM CDT Sunday Mar 8
    const afterGap = new Date('2026-03-08T07:00:00.000Z');
    assert.equal(getHoustonDayOfWeek(afterGap), 0); // Sunday
    assert.equal(getHoustonDayOfMonth(afterGap), 8);

    // Still Saturday Mar 7 before local midnight
    const before = new Date('2026-03-08T05:59:59.000Z');
    assert.equal(getHoustonDayOfWeek(before), 6); // Saturday
    assert.equal(getHoustonDayOfMonth(before), 7);
  });

  it('returns Friday (5) for payroll/P&L smart-item gates', () => {
    // Known Friday in Houston
    const fridayNoonCdt = new Date('2026-08-07T17:00:00.000Z');
    assert.equal(getHoustonDayOfWeek(fridayNoonCdt), 5);
  });
});
