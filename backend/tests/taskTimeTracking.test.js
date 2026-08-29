import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateTaskWorkingTime,
  calculateTaskTotalDuration,
  getCurrentElapsedTime,
  formatDuration,
  formatDurationHHMM,
} from '../utils/taskTimeTracking.js';

const TASK = {
  started_at: '2026-01-01T10:00:00.000Z',
  completed_at: '2026-01-01T12:00:00.000Z',
};

describe('calculateTaskWorkingTime', () => {
  it('returns zeros when started_at is missing', () => {
    const empty = calculateTaskWorkingTime(null);
    assert.equal(empty.totalMinutes, 0);
    assert.equal(empty.formatted, '0:00');
    assert.equal(empty.isActive, false);

    const noStart = calculateTaskWorkingTime({ completed_at: TASK.completed_at });
    assert.equal(noStart.totalMinutes, 0);
  });

  it('counts completed wall time with no breaks', () => {
    const result = calculateTaskWorkingTime(TASK);
    assert.equal(result.totalMinutes, 120);
    assert.equal(result.formatted, '2:00');
    assert.equal(result.formattedLong, '2 hours');
    assert.equal(result.isActive, false);
    assert.equal(result.breakCount, 0);
    assert.equal(result.totalBreakMinutes, 0);
    assert.equal(result.endTime, TASK.completed_at);
  });

  it('subtracts completed breaks that start inside the task window', () => {
    const result = calculateTaskWorkingTime({
      ...TASK,
      breaks: [
        { break_start: '2026-01-01T10:30:00.000Z', break_end: '2026-01-01T10:45:00.000Z' },
      ],
    });
    assert.equal(result.totalMinutes, 105);
    assert.equal(result.formatted, '1:45');
    assert.equal(result.breakCount, 1);
    assert.equal(result.totalBreakMinutes, 15);
  });

  it('ignores breaks that start before the task and clamps breaks that run past completed_at', () => {
    const result = calculateTaskWorkingTime({
      ...TASK,
      breaks: [
        { break_start: '2026-01-01T09:50:00.000Z', break_end: '2026-01-01T10:20:00.000Z' },
        { break_start: '2026-01-01T11:50:00.000Z', break_end: '2026-01-01T12:30:00.000Z' },
      ],
    });
    // First break starts before started_at → skipped. Second is clamped to 10 minutes.
    assert.equal(result.totalMinutes, 110);
    assert.equal(result.totalBreakMinutes, 10);
  });

  it('subtracts an active_break through completed_at even after the task is closed', () => {
    const result = calculateTaskWorkingTime({
      ...TASK,
      active_break: { break_start: '2026-01-01T11:00:00.000Z' },
    });
    assert.equal(result.totalMinutes, 60);
    assert.equal(result.totalBreakMinutes, 60);
    assert.equal(result.isActive, false);
  });

  it('floors working time at 0 when breaks exceed elapsed time', () => {
    const result = calculateTaskWorkingTime({
      ...TASK,
      breaks: [
        { break_start: '2026-01-01T10:00:00.000Z', break_end: '2026-01-01T13:00:00.000Z' },
      ],
    });
    assert.equal(result.totalMinutes, 0);
    assert.equal(result.formatted, '0:00');
    assert.equal(result.formattedLong, '0 minutes');
  });
});

describe('calculateTaskTotalDuration', () => {
  it('reports wall-clock minutes including breaks', () => {
    const result = calculateTaskTotalDuration({
      ...TASK,
      breaks: [
        { break_start: '2026-01-01T10:30:00.000Z', break_end: '2026-01-01T10:45:00.000Z' },
      ],
    });
    assert.equal(result.totalMinutes, 120);
    assert.equal(result.formatted, '2:00');
  });

  it('returns zeros without started_at', () => {
    const result = calculateTaskTotalDuration({});
    assert.equal(result.totalMinutes, 0);
    assert.equal(result.formatted, '0:00');
  });
});

describe('getCurrentElapsedTime', () => {
  it('returns null for completed or unstarted tasks (avoids live Date.now)', () => {
    assert.equal(getCurrentElapsedTime(TASK), null);
    assert.equal(getCurrentElapsedTime({ completed_at: TASK.completed_at }), null);
    assert.equal(getCurrentElapsedTime(null), null);
  });
});

describe('formatDuration / formatDurationHHMM', () => {
  it('treats 0 and negatives as empty (current !minutes guard)', () => {
    assert.equal(formatDuration(0), '0 minutes');
    assert.equal(formatDuration(-5), '0 minutes');
    assert.equal(formatDurationHHMM(0), '0:00');
    assert.equal(formatDurationHHMM(-5), '0:00');
  });

  it('pluralizes minutes and hours', () => {
    assert.equal(formatDuration(1), '1 minute');
    assert.equal(formatDuration(2), '2 minutes');
    assert.equal(formatDuration(60), '1 hour');
    assert.equal(formatDuration(120), '2 hours');
    assert.equal(formatDuration(90), '1 hour 30 minutes');
  });

  it('pads HH:MM minutes', () => {
    assert.equal(formatDurationHHMM(5), '0:05');
    assert.equal(formatDurationHHMM(65), '1:05');
    assert.equal(formatDurationHHMM(120), '2:00');
  });
});
