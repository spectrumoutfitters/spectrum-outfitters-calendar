import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  lunchDurationMinutes,
  computeLunchOvertimeMinutes,
  formatLunchOvertimeDuration,
  isLunchBreakNotes,
  isCleanupReminderEnabled,
  parseClockOutCentralHour,
  shouldShowCleanupReminder,
} from '../utils/lunchClockGates.js';

describe('lunchDurationMinutes / computeLunchOvertimeMinutes', () => {
  it('floors duration and alerts only after 70 minutes and before 24 hours', () => {
    const out = '2026-08-19T12:00:00.000Z';
    assert.equal(lunchDurationMinutes(out, '2026-08-19T13:10:00.000Z'), 70);
    assert.equal(computeLunchOvertimeMinutes(70), null);
    assert.equal(computeLunchOvertimeMinutes(71), 1);
    assert.equal(computeLunchOvertimeMinutes(24 * 60 - 1), 24 * 60 - 1 - 70);
    assert.equal(computeLunchOvertimeMinutes(24 * 60), null);
    assert.equal(computeLunchOvertimeMinutes(0), null);
  });
});

describe('formatLunchOvertimeDuration', () => {
  it('pluralizes hours/minutes and omits the hour clause under 60', () => {
    assert.equal(formatLunchOvertimeDuration(1), '1 minute');
    assert.equal(formatLunchOvertimeDuration(12), '12 minutes');
    assert.equal(formatLunchOvertimeDuration(60), '1 hour and 0 minutes');
    assert.equal(formatLunchOvertimeDuration(121), '2 hours and 1 minute');
  });
});

describe('isLunchBreakNotes', () => {
  it('requires a truthy string containing lunch break (case-insensitive)', () => {
    assert.equal(isLunchBreakNotes('Lunch break'), true);
    assert.equal(isLunchBreakNotes('LUNCH BREAK - extra'), true);
    assert.equal(isLunchBreakNotes('lunch'), false);
    assert.equal(isLunchBreakNotes(''), false);
    assert.equal(isLunchBreakNotes(null), false);
  });
});

describe('isCleanupReminderEnabled', () => {
  it('only trips on enabled === 1', () => {
    assert.equal(isCleanupReminderEnabled({ enabled: 1 }), true);
    assert.equal(isCleanupReminderEnabled({ enabled: '1' }), false);
    assert.equal(isCleanupReminderEnabled({ enabled: true }), false);
    assert.equal(isCleanupReminderEnabled(null), false);
  });
});

describe('parseClockOutCentralHour / shouldShowCleanupReminder', () => {
  it('uses America/Chicago hours; noon inclusive, midnight does not show', () => {
    assert.equal(parseClockOutCentralHour('2026-08-19T17:00:00.000Z'), 12); // noon CDT
    assert.equal(parseClockOutCentralHour('2026-08-19T16:59:00.000Z'), 11);
    assert.equal(parseClockOutCentralHour('2026-08-19T05:00:00.000Z'), 0); // midnight CDT
    assert.equal(shouldShowCleanupReminder(12, 0), true);
    assert.equal(shouldShowCleanupReminder(11, 0), false);
    assert.equal(shouldShowCleanupReminder(12, 1), false);
    assert.equal(shouldShowCleanupReminder(0, 0), false);
  });
});
