import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { calculateAnalyticsKpis } from '../src/utils/analyticsKpiMath.js';

describe('calculateAnalyticsKpis', () => {
  it('returns null when performance is missing', () => {
    assert.equal(calculateAnalyticsKpis(null), null);
    assert.equal(calculateAnalyticsKpis({}), null);
    assert.equal(calculateAnalyticsKpis({ performance: null }), null);
  });

  it('treats missing employees list as empty (zeros, not divide-by-zero)', () => {
    const kpis = calculateAnalyticsKpis({ performance: {} });
    assert.deepEqual(kpis, {
      totalHours: 0,
      totalTasks: 0,
      avgTasksPerHour: '0.00',
      avgCompletionRate: '0.0',
      totalCost: 0,
      activeEmployees: 0,
    });
  });

  it('uses hourly_rate when truthy and weekly_salary / 40 when hourly is falsy', () => {
    const kpis = calculateAnalyticsKpis({
      performance: {
        employees: [
          { total_hours_worked: 10, hourly_rate: 20, weekly_salary: 800, tasks_completed: 4, completion_rate: 80 },
          { total_hours_worked: 8, hourly_rate: 0, weekly_salary: 400, tasks_completed: 2, completion_rate: 50 },
          { total_hours_worked: 5, weekly_salary: 0, tasks_completed: 1, completion_rate: 20 },
        ],
      },
    });
    assert.equal(kpis.totalHours, 23);
    assert.equal(kpis.totalTasks, 7);
    assert.equal(kpis.activeEmployees, 3);
    // 10*20 + 8*(400/40) + 5*0 = 200 + 80 + 0
    assert.equal(kpis.totalCost, 280);
    assert.equal(kpis.avgTasksPerHour, (7 / 23).toFixed(2));
    assert.equal(kpis.avgCompletionRate, ((80 + 50 + 20) / 3).toFixed(1));
  });

  it('keeps avgTasksPerHour at 0.00 when hours are zero even if tasks exist', () => {
    const kpis = calculateAnalyticsKpis({
      performance: {
        employees: [{ total_hours_worked: 0, tasks_completed: 12, completion_rate: 100 }],
      },
    });
    assert.equal(kpis.avgTasksPerHour, '0.00');
    assert.equal(kpis.totalTasks, 12);
    assert.equal(kpis.totalCost, 0);
  });

  it('adds tasks_completed with || 0 (so 0 stays 0; missing becomes 0)', () => {
    const kpis = calculateAnalyticsKpis({
      performance: {
        employees: [
          { total_hours_worked: 1, tasks_completed: 0 },
          { total_hours_worked: 1 },
        ],
      },
    });
    assert.equal(kpis.totalTasks, 0);
  });
});
