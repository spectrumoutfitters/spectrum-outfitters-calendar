import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  dedupePayRecordsList,
  mergePayrollHistoryWithSplitRuns,
  mergePayRecordsPreferringHistory,
} from '../utils/payrollDedupe.js';

describe('dedupePayRecordsList', () => {
  it('still keeps same-day rows with different amounts (import vs distinct pays)', () => {
    const merged = dedupePayRecordsList([
      { pay_date: '2026-07-17', amount: 1850 },
      { pay_date: '2026-07-17', amount: 450 },
    ]);
    assert.equal(merged.length, 2);
  });

  it('collapses same-amount rows within 6 days', () => {
    const merged = dedupePayRecordsList([
      { pay_date: '2026-07-17', amount: 450 },
      { pay_date: '2026-07-14', amount: 450 },
    ]);
    assert.equal(merged.length, 1);
    assert.equal(merged[0].amount, 450);
  });
});

describe('mergePayrollHistoryWithSplitRuns', () => {
  it('drops split reimbursable marker when history has a different gross the same week', () => {
    const history = [{ pay_date: '2026-07-17', amount: 1850 }];
    const split = [{ pay_date: '2026-07-17', amount: 450 }];
    const merged = mergePayrollHistoryWithSplitRuns(history, split);

    assert.deepEqual(merged, [{ pay_date: '2026-07-17', amount: 1850 }]);

    const expectedAmount = 450;
    const amountOwedEstimate = merged.length * expectedAmount;
    assert.equal(amountOwedEstimate, 450);
  });

  it('keeps split run when no history falls in the 6-day window', () => {
    const history = [{ pay_date: '2026-06-05', amount: 1850 }];
    const split = [{ pay_date: '2026-07-17', amount: 450 }];
    const merged = mergePayrollHistoryWithSplitRuns(history, split);

    assert.equal(merged.length, 2);
    assert.ok(merged.some((r) => r.amount === 450 && r.pay_date === '2026-07-17'));
  });

  it('prefers history when split week-ending is a few days from the paycheck date', () => {
    const history = [{ pay_date: '2026-07-15', amount: 1850 }];
    const split = [{ pay_date: '2026-07-17', amount: 450 }];
    const merged = mergePayrollHistoryWithSplitRuns(history, split);

    assert.deepEqual(merged, [{ pay_date: '2026-07-15', amount: 1850 }]);
  });
});

describe('mergePayRecordsPreferringHistory', () => {
  it('drops tagged split markers when rolling up user + payroll_person rows', () => {
    const userRows = [{ pay_date: '2026-07-17', amount: 1850 }];
    const personRows = [{ pay_date: '2026-07-17', amount: 450, from_split_run: true }];
    const merged = mergePayRecordsPreferringHistory(userRows, personRows);

    assert.deepEqual(merged, [{ pay_date: '2026-07-17', amount: 1850 }]);
  });

  it('still prefers history after per-source merge left an uncovered split tagged', () => {
    const userHistory = mergePayrollHistoryWithSplitRuns(
      [{ pay_date: '2026-07-17', amount: 1850 }],
      []
    );
    const personSplitOnly = mergePayrollHistoryWithSplitRuns(
      [],
      [{ pay_date: '2026-07-17', amount: 450, from_split_run: true }]
    );
    assert.equal(personSplitOnly[0].from_split_run, true);

    const merged = mergePayRecordsPreferringHistory(userHistory, personSplitOnly);
    assert.deepEqual(merged.map(({ pay_date, amount }) => ({ pay_date, amount })), [
      { pay_date: '2026-07-17', amount: 1850 },
    ]);
  });
});


