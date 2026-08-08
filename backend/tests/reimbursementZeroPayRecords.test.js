/**
 * Regression: void/$0 payroll-history rows must not inflate reimbursement owed
 * via payRecords.length * expected_amount.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  dedupePayRecordsList,
  filterPositivePayRecords,
  estimateReimbursementOwed,
  cumulativeExpectedFromPayRecords,
} from '../utils/payrollDedupe.js';

describe('filterPositivePayRecords / reimbursement owed', () => {
  it('drops $0 and negative rows so weekly owed matches real pays only', () => {
    const history = [
      { pay_date: '2026-01-02', amount: 1850 },
      { pay_date: '2026-01-09', amount: 1850 },
      { pay_date: '2026-01-16', amount: 0 }, // void
      { pay_date: '2026-01-23', amount: 1850 },
      { pay_date: '2026-01-30', amount: 0 }, // zero adjustment
      { pay_date: '2026-02-06', amount: 1850 },
    ];
    const expected = 450;
    const positive = filterPositivePayRecords(dedupePayRecordsList(history));
    assert.equal(positive.length, 4);

    // Old bug: length included zeros → 6 × 450 = 2700
    assert.equal(history.length * expected, 2700);

    const owed = estimateReimbursementOwed(expected, 'weekly', history, 0);
    assert.equal(owed, 1800);
    assert.equal(cumulativeExpectedFromPayRecords(expected, 'weekly', history), 1800);
  });

  it('monthly owed ignores $0 rows when deriving distinct months', () => {
    const history = [
      { pay_date: '2026-01-02', amount: 1850 },
      { pay_date: '2026-01-16', amount: 0 }, // same month, must not add a period alone
      { pay_date: '2026-02-06', amount: 1850 },
      { pay_date: '2026-03-01', amount: 0 }, // month with only $0 → must not count
    ];
    const owed = estimateReimbursementOwed(400, 'monthly', history, 0);
    assert.equal(owed, 800); // Jan + Feb only
    assert.equal(cumulativeExpectedFromPayRecords(400, 'monthly', history), 800);
  });

  it('subtracts received after counting only positive pays', () => {
    const history = [
      { pay_date: '2026-01-02', amount: 1850 },
      { pay_date: '2026-01-09', amount: 0 },
      { pay_date: '2026-01-16', amount: 1850 },
    ];
    assert.equal(estimateReimbursementOwed(450, 'weekly', history, 450), 450);
  });
});
