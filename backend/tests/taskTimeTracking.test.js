import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateTaskWorkingTime,
  calculateTaskTotalDuration,
  getCurrentElapsedTime,
  formatDuration,
  formatDurationHHMM
} from '../utils/taskTimeTracking.js';

describe('calculateTaskWorkingTime', () => {
  it('returns zeros when task has not started', () => {
    assert.deepEqual(calculateTaskWorkingTime(null), {
      totalMinutes: 0,
      totalHours: 0,
      formatted: '0:00',
      formattedLong: '0 minutes',
      isActive: false
    });
    assert.equal(calculateTaskWorkingTime({}).totalMinutes, 0);
  });

  it('subtracts completed breaks from a finished task window', () => {
    const result = calculateTaskWorkingTime({
      started_at: '2026-07-26T09:00:00.000Z',
      completed_at: '2026-07-26T17:00:00.000Z',
      breaks: [
        {
          break_start: '2026-07-26T12:00:00.000Z',
          break_end: '2026-07-26T12:30:00.000Z'
        }
      ]
    });

    // 8h elapsed − 30m break = 7h 30m
    assert.equal(result.totalMinutes, 450);
    assert.equal(result.totalHours, 7.5);
    assert.equal(result.formatted, '7:30');
    assert.equal(result.formattedLong, '7 hours 30 minutes');
    assert.equal(result.totalBreakMinutes, 30);
    assert.equal(result.breakCount, 1);
    assert.equal(result.isActive, false);
  });

  it('ignores breaks that start outside the task window', () => {
    const result = calculateTaskWorkingTime({
      started_at: '2026-07-26T10:00:00.000Z',
      completed_at: '2026-07-26T11:00:00.000Z',
      breaks: [
        {
          break_start: '2026-07-26T09:00:00.000Z',
          break_end: '2026-07-26T09:30:00.000Z'
        },
        {
          break_start: '2026-07-26T11:30:00.000Z',
          break_end: '2026-07-26T12:00:00.000Z'
        }
      ]
    });

    assert.equal(result.totalMinutes, 60);
    assert.equal(result.totalBreakMinutes, 0);
    assert.equal(result.breakCount, 2);
  });

  it('clamps an unfinished break to the task end when break_end is missing', () => {
    const result = calculateTaskWorkingTime({
      started_at: '2026-07-26T09:00:00.000Z',
      completed_at: '2026-07-26T12:00:00.000Z',
      breaks: [{ break_start: '2026-07-26T11:00:00.000Z' }]
    });

    // break_end absent → breakEnd is null → falls back to effectiveEndTime (12:00)
    // 3h elapsed − 1h unfinished break = 2h
    assert.equal(result.totalMinutes, 120);
    assert.equal(result.totalBreakMinutes, 60);
  });

  it('never returns negative working time when breaks exceed elapsed time', () => {
    const result = calculateTaskWorkingTime({
      started_at: '2026-07-26T09:00:00.000Z',
      completed_at: '2026-07-26T10:00:00.000Z',
      breaks: [
        {
          break_start: '2026-07-26T09:00:00.000Z',
          break_end: '2026-07-26T12:00:00.000Z'
        }
      ]
    });

    assert.equal(result.totalMinutes, 0);
    assert.equal(result.formatted, '0:00');
    assert.equal(result.formattedLong, '0 minutes');
  });
});

describe('active task / live elapsed helpers', () => {
  it('counts an active break against live working time', () => {
    mock.timers.enable({ apis: ['Date'], now: new Date('2026-07-26T15:00:00.000Z') });
    try {
      const result = calculateTaskWorkingTime({
        started_at: '2026-07-26T13:00:00.000Z',
        active_break: { break_start: '2026-07-26T14:30:00.000Z' }
      });

      // 2h wall − 30m active break = 90m
      assert.equal(result.totalMinutes, 90);
      // Current helper returns started_at string (truthy) rather than boolean true
      assert.equal(result.isActive, '2026-07-26T13:00:00.000Z');
      assert.equal(result.totalBreakMinutes, 30);
    } finally {
      mock.timers.reset();
    }
  });

  it('returns null for getCurrentElapsedTime when task is finished or not started', () => {
    assert.equal(getCurrentElapsedTime(null), null);
    assert.equal(
      getCurrentElapsedTime({
        started_at: '2026-07-26T09:00:00.000Z',
        completed_at: '2026-07-26T10:00:00.000Z'
      }),
      null
    );
  });

  it('marks live elapsed time for an in-progress task', () => {
    mock.timers.enable({ apis: ['Date'], now: new Date('2026-07-26T10:45:00.000Z') });
    try {
      const live = getCurrentElapsedTime({
        started_at: '2026-07-26T10:00:00.000Z'
      });
      assert.equal(live.isLive, true);
      assert.equal(live.totalMinutes, 45);
      assert.equal(live.formatted, '0:45');
      assert.equal(live.lastUpdated, '2026-07-26T10:45:00.000Z');
    } finally {
      mock.timers.reset();
    }
  });
});

describe('calculateTaskTotalDuration', () => {
  it('reports wall-clock duration including breaks', () => {
    const result = calculateTaskTotalDuration({
      started_at: '2026-07-26T09:00:00.000Z',
      completed_at: '2026-07-26T11:15:00.000Z'
    });
    assert.equal(result.totalMinutes, 135);
    assert.equal(result.formatted, '2:15');
    assert.equal(result.formattedLong, '2 hours 15 minutes');
  });
});

describe('formatDuration helpers', () => {
  it('formatDuration handles zero, singular, and plural units', () => {
    assert.equal(formatDuration(0), '0 minutes');
    assert.equal(formatDuration(-5), '0 minutes');
    assert.equal(formatDuration(1), '1 minute');
    assert.equal(formatDuration(45), '45 minutes');
    assert.equal(formatDuration(60), '1 hour');
    assert.equal(formatDuration(120), '2 hours');
    assert.equal(formatDuration(61), '1 hour 1 minute');
    assert.equal(formatDuration(125), '2 hours 5 minutes');
  });

  it('formatDurationHHMM pads minutes and rejects invalid input', () => {
    assert.equal(formatDurationHHMM(0), '0:00');
    assert.equal(formatDurationHHMM(-1), '0:00');
    assert.equal(formatDurationHHMM(5), '0:05');
    assert.equal(formatDurationHHMM(75), '1:15');
  });
});
