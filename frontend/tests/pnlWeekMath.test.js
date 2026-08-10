process.env.TZ = 'UTC';

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  snapToWeekEndingFriday,
  pnlNetOfReimbursementDisplay,
} from '../src/utils/pnlWeekMath.js';

describe('snapToWeekEndingFriday', () => {
  it('keeps Fridays unchanged', () => {
    // 2026-08-07 is Friday
    assert.equal(snapToWeekEndingFriday(new Date(Date.UTC(2026, 7, 7, 12))), '2026-08-07');
  });

  it('snaps Mon–Thu forward to that week’s Friday', () => {
    assert.equal(snapToWeekEndingFriday(new Date(Date.UTC(2026, 7, 3, 12))), '2026-08-07'); // Mon
    assert.equal(snapToWeekEndingFriday(new Date(Date.UTC(2026, 7, 6, 12))), '2026-08-07'); // Thu
  });

  it('snaps Saturday back to the prior Friday', () => {
    assert.equal(snapToWeekEndingFriday(new Date(Date.UTC(2026, 7, 8, 12))), '2026-08-07');
  });

  it('snaps Sunday forward to the coming Friday (day===0 hits day<5 branch)', () => {
    // Preserves historical ProfitAndLoss behavior: only Saturday uses the "last Friday" else-branch.
    assert.equal(snapToWeekEndingFriday(new Date(Date.UTC(2026, 7, 9, 12))), '2026-08-14');
  });

  it('returns empty string for invalid input', () => {
    assert.equal(snapToWeekEndingFriday('not-a-date'), '');
  });
});

describe('pnlNetOfReimbursementDisplay', () => {
  const base = {
    payrollTotal: 1000,
    expectedReimb: 200,
    summaryTotalExpenses: 1500,
    summaryNetProfitLoss: 400,
    totalRevenue: 2000,
  };

  it('passes through totals when toggle is off', () => {
    const d = pnlNetOfReimbursementDisplay({ showNetOfReimbursement: false, ...base });
    assert.equal(d.displayPayrollTotal, 1000);
    assert.equal(d.displayTotalExpenses, 1500);
    assert.equal(d.displayNetProfitLoss, 400);
    assert.equal(d.displayProfitMargin, 20);
    assert.equal(d.displayIsProfitable, true);
  });

  it('subtracts expected reimbursement from payroll/expenses and adds it to net when toggle is on', () => {
    const d = pnlNetOfReimbursementDisplay({ showNetOfReimbursement: true, ...base });
    assert.equal(d.displayPayrollTotal, 800);
    assert.equal(d.displayTotalExpenses, 1300);
    assert.equal(d.displayNetProfitLoss, 600);
    assert.equal(d.displayProfitMargin, 30);
    assert.equal(d.displayIsProfitable, true);
  });

  it('uses 0 margin when revenue is 0', () => {
    const d = pnlNetOfReimbursementDisplay({
      showNetOfReimbursement: false,
      payrollTotal: 10,
      expectedReimb: 0,
      summaryTotalExpenses: 10,
      summaryNetProfitLoss: -10,
      totalRevenue: 0,
    });
    assert.equal(d.displayProfitMargin, 0);
    assert.equal(d.displayIsProfitable, false);
  });
});
