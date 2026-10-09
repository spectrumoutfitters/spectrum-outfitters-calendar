import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { reimbursementTrackerFigures } from '../src/utils/reimbursementTrackerFigures.js';

const received = {
  'user:4': 50,
  'payroll_person:9': 10,
};

describe('reimbursementTrackerFigures', () => {
  it('accrues weekly expected amount times pay runs and subtracts received', () => {
    const figures = reimbursementTrackerFigures({
      source_type: 'user',
      source_id: 4,
      expected_period: 'weekly',
      expected_amount: '40',
      pay_records: [{ amount: 800 }, { amount: 800 }, { amount: 0 }],
    }, { totalReceivedBySource: received });

    assert.equal(figures.key, 'user:4');
    assert.equal(figures.isMonthly, false);
    assert.equal(figures.payRunCount, 3);
    assert.equal(figures.totalPaid, 1600);
    assert.equal(figures.accruedShare, 120);
    assert.equal(figures.totalReceived, 50);
    assert.equal(figures.balance, 70);
    assert.equal(figures.amountOwed, 0);
    assert.equal(figures.payrollPaidHint, 'Sum of pays in payroll history');
  });

  it('keeps monthly accrual at zero when the server did not send a cumulative total', () => {
    const figures = reimbursementTrackerFigures({
      source_type: 'payroll_person',
      source_id: 9,
      expected_period: 'monthly',
      expected_amount: 500,
      pay_records: [{ amount: 1000 }, { amount: 1000 }],
    }, { totalReceivedBySource: received, payrollHistoryRowCount: 2 });

    assert.equal(figures.accruedShare, 0);
    assert.equal(figures.balance, -10);
    assert.equal(figures.totalReceived, 10);
    assert.match(figures.payrollPaidHint, /Sum of pays in payroll history/);
  });

  it('uses server cumulative, paid, and owed figures including explicit zeros', () => {
    const figures = reimbursementTrackerFigures({
      source_type: 'user',
      source_id: '4',
      expected_period: 'weekly',
      expected_amount: 40,
      pay_records: [{ amount: 900 }],
      total_paid_from_payroll: 0,
      amount_owed_estimate: 0,
      cumulative_expected_from_other: 0,
    }, {
      totalReceivedBySource: { 'user:4': 25 },
      payrollHistoryRowCount: 4,
      payrollHistoryDbCount: 4,
    });

    assert.equal(figures.totalPaid, 0);
    assert.equal(figures.amountOwed, 0);
    assert.equal(figures.accruedShare, 0);
    assert.equal(figures.balance, -25);
    assert.equal(
      figures.payrollPaidHint,
      'No pays matched this person — align Calendar user ID or full name with the Payroll System export.'
    );
  });

  it('points at the database when stored history has a positive paid total', () => {
    const figures = reimbursementTrackerFigures({
      source_type: 'user',
      source_id: 1,
      total_paid_from_payroll: 1200,
      cumulative_expected_from_other: 300,
      amount_owed_estimate: 80,
    }, {
      totalReceivedBySource: {},
      payrollHistoryDbCount: 1,
    });

    assert.equal(figures.totalPaid, 1200);
    assert.equal(figures.accruedShare, 300);
    assert.equal(figures.amountOwed, 80);
    assert.equal(figures.balance, 300);
    assert.equal(
      figures.payrollPaidHint,
      'Sum of pays from stored payroll history (Calendar database; file on disk is optional).'
    );
  });

  it('asks for a payroll import when nothing has been paid and no history rows exist', () => {
    const figures = reimbursementTrackerFigures({
      source_type: 'user',
      source_id: 2,
      expected_amount: 'not-a-number',
    }, { totalReceivedBySource: {} });

    assert.equal(figures.totalPaid, 0);
    assert.equal(figures.accruedShare, 0);
    assert.equal(figures.balance, 0);
    assert.match(figures.payrollPaidHint, /Import pay history/);
  });

  it('treats a missing received map entry as zero', () => {
    const figures = reimbursementTrackerFigures({
      source_type: 'user',
      source_id: 99,
      expected_period: 'weekly',
      expected_amount: 15,
      pay_records: [{}, { amount: 10 }],
    }, { totalReceivedBySource: received });

    assert.equal(figures.totalPaid, 10);
    assert.equal(figures.totalReceived, 0);
    assert.equal(figures.accruedShare, 30);
    assert.equal(figures.balance, 30);
  });
});
