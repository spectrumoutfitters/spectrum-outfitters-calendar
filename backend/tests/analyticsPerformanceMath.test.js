import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  getDefaultAnalyticsWeekRange,
  getWeeklyComparisonWeekRange,
  coerceAnalyticsWeekCount,
  formatTasksPerHour,
  formatCompletionRate,
  formatTaskHoursRatio,
  formatSubtaskCompletionRate,
  weekComparisonLabel,
} from '../utils/analyticsPerformanceMath.js';

describe('getDefaultAnalyticsWeekRange', () => {
  it('uses Monday through Sunday of the current UTC week', () => {
    // Wednesday 2026-08-12 15:00 UTC
    const range = getDefaultAnalyticsWeekRange(new Date('2026-08-12T15:00:00.000Z'));
    assert.deepEqual(range, { startDate: '2026-08-10', endDate: '2026-08-16' });
  });

  it('treats Sunday as the end of the week that started the prior Monday', () => {
    const range = getDefaultAnalyticsWeekRange(new Date('2026-08-16T18:00:00.000Z'));
    assert.deepEqual(range, { startDate: '2026-08-10', endDate: '2026-08-16' });
  });

  it('keeps Monday as the start of the current week', () => {
    const range = getDefaultAnalyticsWeekRange(new Date('2026-08-10T00:30:00.000Z'));
    assert.deepEqual(range, { startDate: '2026-08-10', endDate: '2026-08-16' });
  });
});

describe('getWeeklyComparisonWeekRange', () => {
  it('offset 0 is the previous week, not the current week', () => {
    // Wednesday 2026-08-12 → previous Monday 2026-08-03
    const range = getWeeklyComparisonWeekRange(new Date('2026-08-12T15:00:00.000Z'), 0);
    assert.deepEqual(range, { startDate: '2026-08-03', endDate: '2026-08-09' });
  });

  it('offset 1 walks back another seven days', () => {
    const range = getWeeklyComparisonWeekRange(new Date('2026-08-12T15:00:00.000Z'), 1);
    assert.deepEqual(range, { startDate: '2026-07-27', endDate: '2026-08-02' });
  });

  it('Sunday offset 0 is the week ending today (unlike weekdays, which skip the in-progress week)', () => {
    const range = getWeeklyComparisonWeekRange(new Date('2026-08-16T12:00:00.000Z'), 0);
    assert.deepEqual(range, { startDate: '2026-08-10', endDate: '2026-08-16' });
  });
});

describe('coerceAnalyticsWeekCount', () => {
  it('defaults unparseable or zero counts to 4', () => {
    assert.equal(coerceAnalyticsWeekCount(undefined), 4);
    assert.equal(coerceAnalyticsWeekCount(''), 4);
    assert.equal(coerceAnalyticsWeekCount('abc'), 4);
    assert.equal(coerceAnalyticsWeekCount(0), 4);
    assert.equal(coerceAnalyticsWeekCount('0'), 4);
  });

  it('keeps positive integers and negatives (loop may then run zero times)', () => {
    assert.equal(coerceAnalyticsWeekCount('8'), 8);
    assert.equal(coerceAnalyticsWeekCount(2), 2);
    assert.equal(coerceAnalyticsWeekCount('-1'), -1);
  });
});

describe('efficiency rate formatters', () => {
  it('formats tasks/hour to two decimals and zeros when hours are 0 or negative', () => {
    assert.equal(formatTasksPerHour(4, 2), '2.00');
    assert.equal(formatTasksPerHour(1, 3), '0.33');
    assert.equal(formatTasksPerHour(5, 0), '0.00');
    assert.equal(formatTasksPerHour(5, -1), '0.00');
  });

  it('formats completion rate to one decimal and zeros when assigned is 0', () => {
    assert.equal(formatCompletionRate(1, 3), '33.3');
    assert.equal(formatCompletionRate(2, 2), '100.0');
    assert.equal(formatCompletionRate(1, 0), '0.0');
  });

  it('formats task-hours ratio the same way as utilization', () => {
    assert.equal(formatTaskHoursRatio(6, 8), '75.0');
    assert.equal(formatTaskHoursRatio(8, 0), '0.0');
  });

  it('reports 100% when a task has no subtasks', () => {
    assert.equal(formatSubtaskCompletionRate(0, 0), '100.0');
    assert.equal(formatSubtaskCompletionRate(1, 4), '25.0');
  });
});

describe('weekComparisonLabel', () => {
  it('numbers weeks so the oldest offset is Week 1 of the requested count', () => {
    assert.equal(
      weekComparisonLabel(4, 0, '2026-08-03', '2026-08-09'),
      'Week 4 (2026-08-03 to 2026-08-09)'
    );
    assert.equal(
      weekComparisonLabel(4, 3, '2026-07-13', '2026-07-19'),
      'Week 1 (2026-07-13 to 2026-07-19)'
    );
  });
});
