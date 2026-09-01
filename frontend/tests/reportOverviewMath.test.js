import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { calculateOverviewStats, groupTimePayrollByUser } from '../src/utils/reportOverviewMath.js';

describe('calculateOverviewStats', () => {
  it('returns null when overview is missing', () => {
    assert.equal(calculateOverviewStats(null), null);
    assert.equal(calculateOverviewStats(undefined), null);
  });

  it('zeros when time/tasks payloads are absent', () => {
    assert.deepEqual(calculateOverviewStats({}), {
      totalHours: 0,
      totalPay: 0,
      activeEmployees: 0,
      tasksCompleted: 0,
      tasksInProgress: 0,
      avgTaskCompletion: 0,
    });
  });

  it('sums hours/pay via parseFloat(x || 0) and counts unique user_id', () => {
    const stats = calculateOverviewStats({
      time: {
        report: [
          { user_id: 1, hours: '8.5', pay: '170' },
          { user_id: 1, hours: 1.5, pay: 30 },
          { user_id: 2, hours: '', pay: null },
          { user_id: 3 },
        ],
      },
    });
    assert.equal(stats.totalHours, 10);
    assert.equal(stats.totalPay, 200);
    assert.equal(stats.activeEmployees, 3);
  });

  it('treats missing hours/pay as 0 but non-numeric strings become NaN totals', () => {
    const stats = calculateOverviewStats({
      time: { report: [{ user_id: 1, hours: 'abc', pay: 'xyz' }] },
    });
    assert.ok(Number.isNaN(stats.totalHours));
    assert.ok(Number.isNaN(stats.totalPay));
    assert.equal(stats.activeEmployees, 1);
  });

  it('counts completed / in_progress by exact status only', () => {
    const stats = calculateOverviewStats({
      tasks: {
        tasks: [
          { status: 'completed', started_at: '2026-03-01T10:00:00Z', completed_at: '2026-03-01T12:00:00Z' },
          { status: 'in_progress' },
          { status: 'Completed' },
          { status: 'review' },
        ],
      },
    });
    assert.equal(stats.tasksCompleted, 1);
    assert.equal(stats.tasksInProgress, 1);
    assert.equal(stats.avgTaskCompletion, 2);
  });

  it('divides wall-clock hours by every completed+completed_at row (missing started_at still in denominator)', () => {
    const stats = calculateOverviewStats({
      tasks: {
        tasks: [
          { status: 'completed', started_at: '2026-03-01T10:00:00Z', completed_at: '2026-03-01T12:00:00Z' },
          { status: 'completed', completed_at: '2026-03-01T15:00:00Z' },
          { status: 'completed' },
        ],
      },
    });
    // 2h + 0h over 2 completed-with-completed_at rows (third omitted: no completed_at)
    assert.equal(stats.tasksCompleted, 3);
    assert.equal(stats.avgTaskCompletion, 1);
  });
});

describe('groupTimePayrollByUser', () => {
  it('returns {} for missing/empty report', () => {
    assert.deepEqual(groupTimePayrollByUser(undefined), {});
    assert.deepEqual(groupTimePayrollByUser(null), {});
    assert.deepEqual(groupTimePayrollByUser([]), {});
  });

  it('groups hours/pay by user_id and keeps first user_name', () => {
    const grouped = groupTimePayrollByUser([
      { user_id: 7, user_name: 'Ada', hours: '4', pay: '80' },
      { user_id: 7, user_name: 'Ada Updated', hours: 2, pay: 40 },
      { user_id: 8, user_name: 'Ben', hours: 1, pay: 25 },
    ]);
    assert.equal(grouped[7].user_name, 'Ada');
    assert.equal(grouped[7].totalHours, 6);
    assert.equal(grouped[7].totalPay, 120);
    assert.equal(grouped[7].entries.length, 2);
    assert.equal(grouped[8].totalHours, 1);
    assert.equal(grouped[8].totalPay, 25);
  });

  it('coerces missing hours/pay with || 0', () => {
    const grouped = groupTimePayrollByUser([{ user_id: 1, user_name: 'Cara' }]);
    assert.equal(grouped[1].totalHours, 0);
    assert.equal(grouped[1].totalPay, 0);
  });
});
