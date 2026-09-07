import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { normalizePayrollDisplayName } from '../utils/payrollDedupe.js';
import {
  MONTHLY_WEEKS,
  addPayrollPeopleWeeklyCosts,
  bankExpenseTotal,
  combineWeeklyExpenseTotals,
  hourlyPayrollCost,
  shiftHoursFromEntry,
  sumExpenseAmounts,
  usesHourlyRate,
  usesWeeklySalary,
  weeklySalaryCost,
} from '../utils/financeWeeklyExpenseMath.js';

describe('usesWeeklySalary / usesHourlyRate', () => {
  it('requires truthy AND > 0; string "0" / "abc" miss salary and may fall through to hourly', () => {
    assert.equal(usesWeeklySalary({ weekly_salary: 500 }), true);
    assert.equal(usesWeeklySalary({ weekly_salary: '500' }), true);
    assert.equal(usesWeeklySalary({ weekly_salary: 0 }), false);
    assert.equal(usesWeeklySalary({ weekly_salary: '0' }), false);
    assert.equal(usesWeeklySalary({ weekly_salary: '' }), false);
    assert.equal(usesWeeklySalary({ weekly_salary: null }), false);
    assert.equal(usesWeeklySalary({ weekly_salary: 'abc' }), false);
    assert.equal(usesWeeklySalary({}), false);

    assert.equal(usesHourlyRate({ hourly_rate: 18 }), true);
    assert.equal(usesHourlyRate({ hourly_rate: '18.5' }), true);
    assert.equal(usesHourlyRate({ hourly_rate: 0 }), false);
    assert.equal(usesHourlyRate({ hourly_rate: '0' }), false);
    assert.equal(usesHourlyRate({ hourly_rate: 'abc' }), false);
  });
});

describe('weeklySalaryCost / hourlyPayrollCost', () => {
  it('uses raw parseFloat with no || 0 (NaN can poison the payroll sum)', () => {
    assert.equal(weeklySalaryCost(500), 500);
    assert.equal(weeklySalaryCost('500'), 500);
    assert.ok(Number.isNaN(weeklySalaryCost(undefined)));
    assert.ok(Number.isNaN(weeklySalaryCost('abc')));

    assert.equal(hourlyPayrollCost(10, 18), 180);
    assert.equal(hourlyPayrollCost(10, '18.5'), 185);
    assert.ok(Number.isNaN(hourlyPayrollCost(10, undefined)));
  });
});

describe('shiftHoursFromEntry', () => {
  it('subtracts break hours and floors at 0; empty break uses || 0', () => {
    const entry = {
      clock_in: '2026-09-01T13:00:00.000Z',
      clock_out: '2026-09-01T21:00:00.000Z',
      break_minutes: 30,
    };
    assert.equal(shiftHoursFromEntry(entry), 7.5);
    assert.equal(shiftHoursFromEntry({ ...entry, break_minutes: 0 }), 8);
    assert.equal(shiftHoursFromEntry({ ...entry, break_minutes: '' }), 8);
    assert.equal(shiftHoursFromEntry({ ...entry, break_minutes: null }), 8);
    assert.equal(
      shiftHoursFromEntry({
        clock_in: '2026-09-01T13:00:00.000Z',
        clock_out: '2026-09-01T12:00:00.000Z',
        break_minutes: 0,
      }),
      0,
    );
  });

  it('treats NaN break_minutes as 0 via || (NaN is falsy)', () => {
    const hours = shiftHoursFromEntry({
      clock_in: '2026-09-01T13:00:00.000Z',
      clock_out: '2026-09-01T21:00:00.000Z',
      break_minutes: NaN,
    });
    assert.equal(hours, 8);
  });
});

describe('sumExpenseAmounts', () => {
  it('parseFloat || 0; monthly divides by 4.33 (distinct from #84 reimbursement owed)', () => {
    assert.equal(MONTHLY_WEEKS, 4.33);
    assert.equal(
      sumExpenseAmounts([{ amount: 100 }, { amount: '50' }, { amount: 'abc' }, { amount: null }]),
      150,
    );
    assert.equal(sumExpenseAmounts([{ amount: 433 }], MONTHLY_WEEKS), 433 / 4.33);
    assert.equal(sumExpenseAmounts([]), 0);
    assert.equal(sumExpenseAmounts(undefined), 0);
  });
});

describe('addPayrollPeopleWeeklyCosts', () => {
  it('skips non-positive parseFloat||0, calendar-user names, and name|cost dupes; different cost still adds', () => {
    const userNames = new Set([normalizePayrollDisplayName('Jane Doe')]);
    const total = addPayrollPeopleWeeklyCosts(
      100,
      [
        { full_name: 'Jane Doe', weekly_salary: 500 },
        { full_name: 'Sam Lee', weekly_salary: 400 },
        { full_name: 'Sam Lee', weekly_salary: 400 },
        { full_name: 'Sam Lee', weekly_salary: 600 },
        { full_name: 'Zero', weekly_salary: 0 },
        { full_name: 'Neg', weekly_salary: -10 },
        { full_name: 'Bad', weekly_salary: 'abc' },
        { full_name: 'Prefix', weekly_salary: '100abc' },
      ],
      userNames,
    );
    // 100 + Sam 400 + Sam 600 + Prefix parseFloat('100abc')=100
    assert.equal(total, 100 + 400 + 600 + 100);
  });
});

describe('bankExpenseTotal / combineWeeklyExpenseTotals', () => {
  it('coerces bank total and sums buckets (NaN payroll poisons total)', () => {
    assert.equal(bankExpenseTotal({ total: 12.5 }), 12.5);
    assert.equal(bankExpenseTotal({ total: '12.5' }), 12.5);
    assert.equal(bankExpenseTotal({ total: null }), 0);
    assert.equal(bankExpenseTotal(undefined), 0);

    assert.deepEqual(
      combineWeeklyExpenseTotals({ payroll: 10, manual: 4, bank: 1 }),
      { payroll: 10, manual: 4, bank: 1, total: 15 },
    );
    assert.ok(Number.isNaN(combineWeeklyExpenseTotals({ payroll: NaN, manual: 1, bank: 1 }).total));
  });
});
