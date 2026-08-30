import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  roundMoney,
  parseDeductionWeek,
  financingDeductionPlanGate,
  computeFinancingDeduction,
} from '../utils/employeeFinancingDeductionMath.js';

describe('parseDeductionWeek', () => {
  it('requires a trimmed week_ending_date (whitespace is missing)', () => {
    assert.deepEqual(parseDeductionWeek(undefined), {
      ok: false,
      error: 'week_ending_date is required (e.g. pay week ending Friday)',
    });
    assert.equal(parseDeductionWeek('   ').ok, false);
    assert.deepEqual(parseDeductionWeek('  2026-08-28  '), { ok: true, week: '2026-08-28' });
  });

  it('treats numeric 0 as missing because (week || "") is falsy', () => {
    assert.equal(parseDeductionWeek(0).ok, false);
    assert.deepEqual(parseDeductionWeek('0'), { ok: true, week: '0' });
  });
});

describe('financingDeductionPlanGate', () => {
  it('404s a missing plan and 400s non-active or zero/negative balance', () => {
    assert.deepEqual(financingDeductionPlanGate(null), {
      ok: false,
      status: 404,
      error: 'Plan not found',
    });
    assert.equal(financingDeductionPlanGate({ status: 'paused', balance_due: 40 }).ok, false);
    assert.equal(financingDeductionPlanGate({ status: 'paid_off', balance_due: 10 }).ok, false);
    assert.deepEqual(financingDeductionPlanGate({ status: 'active', balance_due: 0 }), {
      ok: false,
      status: 400,
      error: 'Balance is already zero',
    });
    assert.equal(financingDeductionPlanGate({ status: 'active', balance_due: -0.004 }).ok, false);
  });

  it('rounds balance the same way as payroll money and allows a penny', () => {
    const r = financingDeductionPlanGate({ status: 'active', balance_due: 10.004 });
    assert.equal(r.ok, true);
    assert.equal(r.bal, 10);
    assert.equal(financingDeductionPlanGate({ status: 'active', balance_due: 0.004 }).ok, false);
    assert.equal(financingDeductionPlanGate({ status: 'active', balance_due: 0.006 }).bal, 0.01);
  });
});

describe('computeFinancingDeduction', () => {
  const base = { weeklyPayment: 25, balance: 80, deductionReason: 'Shop parts', extraNote: '' };

  it('uses weekly payment when amount is nullish and stays active above zero', () => {
    const r = computeFinancingDeduction({ ...base, amount: undefined });
    assert.deepEqual(r, {
      ok: true,
      payAmount: 25,
      reasonNote: 'Shop parts',
      newBal: 55,
      newStatus: 'active',
    });
    assert.equal(computeFinancingDeduction({ ...base, amount: null }).payAmount, 25);
  });

  it('rejects posted 0 / empty-string amount instead of falling back to weekly', () => {
    for (const amount of [0, '', '0']) {
      const r = computeFinancingDeduction({ ...base, amount });
      assert.equal(r.ok, false, `amount ${JSON.stringify(amount)} should fail`);
      assert.equal(r.error, 'Amount must be greater than 0');
    }
  });

  it('clamps an overpayment to remaining balance and marks paid_off', () => {
    const r = computeFinancingDeduction({ ...base, amount: 999, balance: 12.5 });
    assert.equal(r.ok, true);
    assert.equal(r.payAmount, 12.5);
    assert.equal(r.newBal, 0);
    assert.equal(r.newStatus, 'paid_off');
  });

  it('defaults a blank deduction reason and appends a trimmed extra note', () => {
    const r = computeFinancingDeduction({
      ...base,
      deductionReason: '   ',
      extraNote: '  week 3  ',
    });
    assert.equal(r.reasonNote, 'Shop financing repayment — week 3');
  });

  it('does not append a whitespace-only extra note', () => {
    const r = computeFinancingDeduction({ ...base, extraNote: '   ' });
    assert.equal(r.reasonNote, 'Shop parts');
  });

  it('roundMoney matches IEEE cents (1.005 → 1)', () => {
    assert.equal(roundMoney(1.005), 1);
    assert.equal(roundMoney('10.006'), 10.01);
    assert.equal(roundMoney(null), 0);
  });
});
