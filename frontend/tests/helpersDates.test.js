import { describe, it, mock, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatDateInHouston,
  formatDate,
  formatDateTime,
  formatTime,
  getDueDateColor,
  getLastCompletedWeekFridayHouston,
  getUpcomingDayLabel,
} from '../src/utils/helpers.js';

describe('formatDateInHouston', () => {
  it('maps UTC instants across the July CDT midnight boundary', () => {
    // America/Chicago is UTC-5 in July; 05:00Z is Houston midnight.
    assert.equal(formatDateInHouston('2026-07-15T04:59:00.000Z'), '2026-07-14');
    assert.equal(formatDateInHouston('2026-07-15T05:00:00.000Z'), '2026-07-15');
  });

  it('accepts Date instances', () => {
    assert.equal(formatDateInHouston(new Date('2026-07-15T05:00:00.000Z')), '2026-07-15');
  });
});

describe('formatDate / formatDateTime SQLite and ISO parsing', () => {
  it('formats date-only strings without shifting the calendar day', () => {
    assert.equal(formatDate('2026-07-15'), 'Jul 15, 2026');
  });

  it('treats SQLite DATETIME as UTC and displays Houston calendar day', () => {
    // 04:30 UTC on July 15 is still July 14 in Houston (CDT).
    assert.equal(formatDate('2026-07-15 04:30:00'), 'Jul 14, 2026');
    // 12:00 UTC is 07:00 Houston → July 15.
    assert.equal(formatDate('2026-07-15 12:00:00'), 'Jul 15, 2026');
  });

  it('formats datetime with Houston wall clock', () => {
    const formatted = formatDateTime('2026-07-15T17:00:00.000Z');
    assert.match(formatted, /Jul 15, 2026/);
    assert.match(formatted, /12:00\s*PM/i);
  });

  it('formats SQLite time in Houston', () => {
    const formatted = formatTime('2026-07-15 17:00:00');
    assert.match(formatted, /12:00\s*PM/i);
  });

  it('returns empty / em dash for missing values', () => {
    assert.equal(formatDate(''), '');
    assert.equal(formatDate(null), '');
    assert.equal(formatDateTime(null), '');
    assert.equal(formatTime(null), '—');
  });
});

describe('getDueDateColor', () => {
  beforeEach(() => {
    // Fixed "now" in UTC so local midnight comparisons stay deterministic.
    mock.timers.enable({ apis: ['Date'], now: new Date('2026-07-15T17:00:00.000Z') });
  });

  afterEach(() => {
    mock.timers.reset();
  });

  it('returns overdue / today / soon / week / later classes', () => {
    assert.equal(getDueDateColor('2026-07-14'), 'text-red-600 font-semibold');
    assert.equal(getDueDateColor('2026-07-15'), 'text-orange-600 font-semibold');
    assert.equal(getDueDateColor('2026-07-17'), 'text-yellow-600 font-semibold');
    assert.equal(getDueDateColor('2026-07-20'), 'text-blue-600');
    assert.equal(getDueDateColor('2026-07-30'), 'text-gray-500');
  });

  it('returns empty for missing due dates', () => {
    assert.equal(getDueDateColor(null), '');
    assert.equal(getDueDateColor(''), '');
  });
});

describe('getLastCompletedWeekFridayHouston', () => {
  afterEach(() => {
    mock.timers.reset();
  });

  it('returns prior Friday from mid-week Houston dates', () => {
    // Wed Jul 15 2026 12:00 Houston = 17:00Z
    mock.timers.enable({ apis: ['Date'], now: new Date('2026-07-15T17:00:00.000Z') });
    assert.equal(getLastCompletedWeekFridayHouston(), '2026-07-10');
  });

  it('on Saturday still returns the Friday that just ended', () => {
    // Sat Jul 18 2026 12:00 Houston = 17:00Z
    mock.timers.enable({ apis: ['Date'], now: new Date('2026-07-18T17:00:00.000Z') });
    assert.equal(getLastCompletedWeekFridayHouston(), '2026-07-17');
  });

  it('on Friday itself still returns the previous completed Friday', () => {
    // Fri Jul 17 2026 12:00 Houston = 17:00Z
    mock.timers.enable({ apis: ['Date'], now: new Date('2026-07-17T17:00:00.000Z') });
    assert.equal(getLastCompletedWeekFridayHouston(), '2026-07-10');
  });
});

describe('getUpcomingDayLabel', () => {
  beforeEach(() => {
    mock.timers.enable({ apis: ['Date'], now: new Date('2026-07-15T17:00:00.000Z') });
  });

  afterEach(() => {
    mock.timers.reset();
  });

  it('labels today / tomorrow / yesterday relative to local calendar', () => {
    assert.equal(getUpcomingDayLabel('2026-07-15'), 'Today');
    assert.equal(getUpcomingDayLabel('2026-07-16'), 'Tomorrow');
    assert.equal(getUpcomingDayLabel('2026-07-14'), 'Yesterday');
  });

  it('falls back to weekday label for farther dates', () => {
    assert.equal(getUpcomingDayLabel('2026-07-20'), 'Mon, Jul 20');
  });
});
