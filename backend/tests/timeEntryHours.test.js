import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateEntryHours,
  calculateHours,
  effectiveBreakMinutes,
  isLunchBreakNotes,
} from '../utils/helpers.js';

describe('isLunchBreakNotes', () => {
  it('detects lunch break notes case-insensitively', () => {
    assert.equal(isLunchBreakNotes('Lunch break'), true);
    assert.equal(isLunchBreakNotes('went to lunch break early'), true);
    assert.equal(isLunchBreakNotes('Regular break'), false);
    assert.equal(isLunchBreakNotes(null), false);
  });
});

describe('effectiveBreakMinutes', () => {
  it('zeros lunch-break rows even when break_minutes is 60', () => {
    assert.equal(effectiveBreakMinutes(60, 'Lunch break'), 0);
  });

  it('keeps positive non-lunch breaks', () => {
    assert.equal(effectiveBreakMinutes(15, 'Coffee'), 15);
    assert.equal(effectiveBreakMinutes(15, null), 15);
  });

  it('clamps negatives and invalid values to 0', () => {
    assert.equal(effectiveBreakMinutes(-480, null), 0);
    assert.equal(effectiveBreakMinutes('nope', null), 0);
    assert.equal(effectiveBreakMinutes(undefined, null), 0);
  });
});

describe('calculateHours / calculateEntryHours', () => {
  const morningIn = '2026-07-25T13:00:00.000Z'; // 8:00 AM CDT
  const lunchOut = '2026-07-25T17:00:00.000Z'; // 12:00 PM CDT (4h worked)

  it('does not underpay lunch segments that still store break_minutes=60', () => {
    const hours = calculateEntryHours({
      clock_in: morningIn,
      clock_out: lunchOut,
      break_minutes: 60,
      notes: 'Lunch break',
    });
    assert.equal(hours, 4);
  });

  it('still subtracts real unpaid breaks on non-lunch rows', () => {
    const hours = calculateEntryHours({
      clock_in: morningIn,
      clock_out: lunchOut,
      break_minutes: 30,
      notes: null,
    });
    assert.equal(hours, 3.5);
  });

  it('does not inflate hours from negative break_minutes', () => {
    const hours = calculateHours(morningIn, lunchOut, -60);
    assert.equal(hours, 4);
  });
});
