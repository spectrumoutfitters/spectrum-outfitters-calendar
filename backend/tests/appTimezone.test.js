import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  APP_TIMEZONE,
  formatDateInHouston,
  parseHoustonDate,
  addDaysInHouston,
  getHoustonDayOfWeek,
  getWeekStartHouston,
  getWeekEndingSundayHouston,
  getWeekEndingFridayHouston,
  getTodayInHouston,
} from '../utils/appTimezone.js';

describe('appTimezone', () => {
  it('exports America/Chicago as the app timezone', () => {
    assert.equal(APP_TIMEZONE, 'America/Chicago');
  });

  it('formats UTC instants as Houston calendar dates', () => {
    // July is CDT (UTC-5): 04:59 UTC is still July 3 23:59 in Houston.
    assert.equal(formatDateInHouston(new Date('2026-07-04T04:59:00.000Z')), '2026-07-03');
    // 05:00 UTC is July 4 00:00 in Houston.
    assert.equal(formatDateInHouston(new Date('2026-07-04T05:00:00.000Z')), '2026-07-04');
  });

  it('getTodayInHouston matches formatting the current instant', () => {
    assert.equal(getTodayInHouston(), formatDateInHouston(new Date()));
    assert.match(getTodayInHouston(), /^\d{4}-\d{2}-\d{2}$/);
  });

  it('reports Houston weekdays for known calendar dates', () => {
    assert.equal(getHoustonDayOfWeek('2026-07-05'), 0); // Sunday
    assert.equal(getHoustonDayOfWeek('2026-07-06'), 1); // Monday
    assert.equal(getHoustonDayOfWeek('2026-07-10'), 5); // Friday
    assert.equal(getHoustonDayOfWeek('2026-07-11'), 6); // Saturday
  });

  it('adds and subtracts days across month boundaries', () => {
    assert.equal(addDaysInHouston('2026-01-31', 1), '2026-02-01');
    assert.equal(addDaysInHouston('2026-03-01', -1), '2026-02-28');
    assert.equal(addDaysInHouston('2026-07-10', 0), '2026-07-10');
  });

  it('keeps day arithmetic stable across spring-forward DST', () => {
    // 2026-03-08 is the America/Chicago spring-forward date.
    assert.equal(addDaysInHouston('2026-03-07', 1), '2026-03-08');
    assert.equal(addDaysInHouston('2026-03-08', 1), '2026-03-09');
    assert.equal(getHoustonDayOfWeek('2026-03-08'), 0); // Sunday
  });

  it('keeps day arithmetic stable across fall-back DST', () => {
    // 2026-11-01 is the America/Chicago fall-back date.
    assert.equal(addDaysInHouston('2026-10-31', 1), '2026-11-01');
    assert.equal(addDaysInHouston('2026-11-01', 1), '2026-11-02');
    assert.equal(getHoustonDayOfWeek('2026-11-01'), 0); // Sunday
  });

  it('maps a Friday week-ending date to its Monday week start', () => {
    assert.equal(getWeekStartHouston('2026-07-10'), '2026-07-06');
  });

  it('resolves week-ending Friday for each weekday in the week', () => {
    assert.equal(getWeekEndingFridayHouston('2026-07-05'), '2026-07-10'); // Sun → Fri
    assert.equal(getWeekEndingFridayHouston('  2026-07-08  '), '2026-07-10'); // Wed + trim
    assert.equal(getWeekEndingFridayHouston('2026-07-10'), '2026-07-10'); // Fri stays
    assert.equal(getWeekEndingFridayHouston('2026-07-11'), '2026-07-17'); // Sat → next Fri
  });

  it('resolves week-ending Sunday used by time-entry weeks', () => {
    assert.equal(getWeekEndingSundayHouston('2026-07-05'), '2026-07-05'); // Sun stays
    assert.equal(getWeekEndingSundayHouston('2026-07-06'), '2026-07-12'); // Mon → Sun
    assert.equal(getWeekEndingSundayHouston('2026-07-11'), '2026-07-12'); // Sat → Sun
  });

  it('parseHoustonDate lands near noon Houston for calendar arithmetic', () => {
    const d = parseHoustonDate('2026-07-10');
    assert.ok(d instanceof Date);
    assert.ok(!Number.isNaN(d.getTime()));
    // Hour in Houston should be 12 (noon) regardless of UTC offset / DST.
    const hour = new Intl.DateTimeFormat('en-US', {
      timeZone: APP_TIMEZONE,
      hour: 'numeric',
      hour12: false,
    }).format(d);
    assert.equal(Number(hour) % 24, 12);
    assert.equal(formatDateInHouston(d), '2026-07-10');
  });
});
