import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('payroll dedupe name matching', () => {
  it('matches Calendar users to payroll_people rows with middle-name variants', async () => {
    const {
      normalizedNamesWithWeeklySalary,
      payrollNameSetHasLikely,
      payrollNamesLikelySame,
    } = await import('../utils/payrollDedupe.js');

    assert.equal(payrollNamesLikelySame('Patrick Gaines', 'Patrick Tung Gaines'), true);

    const weeklyNames = normalizedNamesWithWeeklySalary([
      { full_name: 'Patrick Gaines', weekly_salary: 500 },
    ]);

    assert.equal(payrollNameSetHasLikely(weeklyNames, 'Patrick Tung Gaines'), true);
  });

  it('does not merge unrelated payroll names', async () => {
    const { payrollNamesLikelySame } = await import('../utils/payrollDedupe.js');

    assert.equal(payrollNamesLikelySame('Patrick Gaines', 'Patricia Gardner'), false);
  });
});
