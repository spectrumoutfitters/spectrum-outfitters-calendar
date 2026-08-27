import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  addDaysDateOnly,
  rescheduleSpan,
  scheduleSpanDays,
} from '../src/utils/scheduleSpanMath.js';

describe('addDaysDateOnly', () => {
  it('adds whole calendar days from local noon (month/year/leap edges)', () => {
    assert.equal(addDaysDateOnly('2026-01-31', 1), '2026-02-01');
    assert.equal(addDaysDateOnly('2026-12-31', 1), '2027-01-01');
    assert.equal(addDaysDateOnly('2024-02-28', 1), '2024-02-29');
    assert.equal(addDaysDateOnly('2025-02-28', 1), '2025-03-01');
    assert.equal(addDaysDateOnly('2026-08-27', 0), '2026-08-27');
    assert.equal(addDaysDateOnly('2026-08-27', -1), '2026-08-26');
  });
});

describe('scheduleSpanDays', () => {
  it('is inclusive (same day → 1) and never below 1', () => {
    assert.equal(scheduleSpanDays('2026-08-27', '2026-08-27'), 1);
    assert.equal(scheduleSpanDays('2026-08-27', '2026-08-29'), 3);
    assert.equal(scheduleSpanDays('2026-08-29', '2026-08-27'), 1);
  });
});

describe('rescheduleSpan', () => {
  it('keeps inclusive length when dragging a multi-day block', () => {
    const moved = rescheduleSpan('2026-08-10', '2026-08-12', '2026-09-01');
    assert.equal(moved.spanDays, 3);
    assert.equal(moved.start_date, '2026-09-01');
    assert.equal(moved.end_date, '2026-09-03');
  });

  it('single-day entries stay one day on the drop target', () => {
    const moved = rescheduleSpan('2026-08-10', '2026-08-10', '2026-08-15');
    assert.equal(moved.spanDays, 1);
    assert.equal(moved.end_date, '2026-08-15');
  });
});
