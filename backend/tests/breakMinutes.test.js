import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { calculateHours, normalizeBreakMinutes } from '../utils/helpers.js';

describe('normalizeBreakMinutes', () => {
  it('keeps a normal unpaid break', () => {
    assert.equal(normalizeBreakMinutes(30), 30);
    assert.equal(normalizeBreakMinutes('15'), 15);
  });

  it('treats missing values as no break', () => {
    assert.equal(normalizeBreakMinutes(undefined), 0);
    assert.equal(normalizeBreakMinutes(null), 0);
    assert.equal(normalizeBreakMinutes(''), 0);
    assert.equal(normalizeBreakMinutes('nope'), 0);
  });

  it('does not turn a negative break into extra paid time', () => {
    assert.equal(normalizeBreakMinutes(-120), 0);
    assert.equal(normalizeBreakMinutes('-45'), 0);
  });
});

describe('calculateHours with break minutes', () => {
  const clockIn = '2026-10-07T13:00:00.000Z';
  const clockOut = '2026-10-07T21:00:00.000Z';

  it('pays the full shift when break minutes are negative', () => {
    assert.equal(calculateHours(clockIn, clockOut, -120), 8);
  });

  it('still deducts a positive break', () => {
    assert.equal(calculateHours(clockIn, clockOut, 30), 7.5);
  });

  it('pays the full shift when no break is recorded', () => {
    assert.equal(calculateHours(clockIn, clockOut, 0), 8);
    assert.equal(calculateHours(clockIn, clockOut, null), 8);
  });
});
