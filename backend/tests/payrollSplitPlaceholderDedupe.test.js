import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  dedupePayRecordsList,
  mergePayRecordsPreferringReal,
} from '../utils/payrollDedupe.js';

describe('mergePayRecordsPreferringReal', () => {
  it('drops a split placeholder in the same week as a real stub when amounts differ', () => {
    const merged = mergePayRecordsPreferringReal([
      { pay_date: '2026-04-10', amount: 800 },
      { pay_date: '2026-04-10', amount: 200, splitPlaceholder: true },
    ]);
    assert.equal(merged.length, 1);
    assert.equal(merged[0].amount, 800);
    assert.equal(merged[0].splitPlaceholder, undefined);
  });

  it('does not double weekly reimbursement owed when overtime gross != weekly_salary placeholder', () => {
    const expectedWeekly = 200;
    const before = dedupePayRecordsList([
      { pay_date: '2026-04-10', amount: 1050 },
      { pay_date: '2026-04-10', amount: 1000, splitPlaceholder: true },
    ]);
    assert.equal(before.length, 2);
    assert.equal(before.length * expectedWeekly, 400);

    const after = mergePayRecordsPreferringReal([
      { pay_date: '2026-04-10', amount: 1050 },
      { pay_date: '2026-04-10', amount: 1000, splitPlaceholder: true },
    ]);
    assert.equal(after.length, 1);
    assert.equal(after[0].amount, 1050);
    assert.equal(after.length * expectedWeekly, 200);
  });

  it('keeps a split placeholder when payroll history has no nearby stub', () => {
    const merged = mergePayRecordsPreferringReal([
      { pay_date: '2026-03-06', amount: 800 },
      { pay_date: '2026-04-10', amount: 200, splitPlaceholder: true },
    ]);
    assert.equal(merged.length, 2);
  });

  it('collapses Calendar-user and payroll_people placeholders for the same week', () => {
    const merged = mergePayRecordsPreferringReal([
      { pay_date: '2026-04-10', amount: 1000, splitPlaceholder: true },
      { pay_date: '2026-04-10', amount: 400, splitPlaceholder: true },
    ]);
    assert.equal(merged.length, 1);
    assert.equal(merged[0].amount, 1000);
  });

  it('keeps two real history rows with different amounts in the same week (paycheck + bonus)', () => {
    const merged = mergePayRecordsPreferringReal([
      { pay_date: '2026-04-10', amount: 1000 },
      { pay_date: '2026-04-12', amount: 250 },
    ]);
    assert.equal(merged.length, 2);
  });

  it('still dedupes same-amount import vs placeholder within 6 days', () => {
    const merged = mergePayRecordsPreferringReal([
      { pay_date: '2026-04-10', amount: 1000 },
      { pay_date: '2026-04-11', amount: 1000, splitPlaceholder: true },
    ]);
    assert.equal(merged.length, 1);
    assert.equal(merged[0].amount, 1000);
  });
});
