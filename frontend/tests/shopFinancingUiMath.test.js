import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  isActiveAssignableUser,
  isEmployeePayee,
  suggestedDeductionAmountInput,
  suggestedPayrollDeduction,
  upcomingFridayLocal,
} from '../src/utils/shopFinancingUiMath.js';

describe('upcomingFridayLocal', () => {
  it('returns today on Friday and the coming Friday otherwise (local TZ)', () => {
    assert.equal(upcomingFridayLocal(new Date('2026-08-21T15:00:00')), '2026-08-21');
    assert.equal(upcomingFridayLocal(new Date('2026-08-16T12:00:00')), '2026-08-21');
    assert.equal(upcomingFridayLocal(new Date('2026-08-22T08:00:00')), '2026-08-28');
    assert.equal(upcomingFridayLocal(new Date('2026-08-19T00:00:00')), '2026-08-21');
  });
});

describe('suggestedPayrollDeduction', () => {
  it('caps weekly payment at remaining balance; || 0 drops only 0/NaN', () => {
    assert.equal(suggestedPayrollDeduction({ weekly_payment: 100, balance_due: 40 }), 40);
    assert.equal(suggestedPayrollDeduction({ weekly_payment: 100, balance_due: 200 }), 100);
    assert.equal(suggestedPayrollDeduction({ weekly_payment: '25.5', balance_due: '10' }), 10);
    assert.equal(suggestedPayrollDeduction({ weekly_payment: 0, balance_due: 50 }), 0);
    // nonzero negatives are truthy, so || 0 keeps them and Math.min can go negative
    assert.equal(suggestedPayrollDeduction({ weekly_payment: -10, balance_due: 50 }), -10);
    assert.equal(suggestedPayrollDeduction({ weekly_payment: 50, balance_due: -10 }), -10);
    assert.equal(suggestedPayrollDeduction({ weekly_payment: 'x', balance_due: 50 }), 0);
    assert.equal(suggestedPayrollDeduction({}), 0);
    assert.equal(suggestedPayrollDeduction(null), 0);
  });

  it('uses empty string when suggestion is not positive', () => {
    assert.equal(suggestedDeductionAmountInput({ weekly_payment: 80, balance_due: 25 }), '25');
    assert.equal(suggestedDeductionAmountInput({ weekly_payment: 0, balance_due: 25 }), '');
    assert.equal(suggestedDeductionAmountInput({ weekly_payment: 10, balance_due: 0 }), '');
  });
});

describe('isActiveAssignableUser', () => {
  it('keeps only exact 1 or boolean true', () => {
    assert.equal(isActiveAssignableUser({ is_active: 1 }), true);
    assert.equal(isActiveAssignableUser({ is_active: true }), true);
    assert.equal(isActiveAssignableUser({ is_active: 0 }), false);
    assert.equal(isActiveAssignableUser({ is_active: false }), false);
    assert.equal(isActiveAssignableUser({ is_active: '1' }), false);
    assert.equal(isActiveAssignableUser({ is_active: 2 }), false);
    assert.equal(isActiveAssignableUser({}), false);
  });
});

describe('isEmployeePayee', () => {
  it('treats any non-null non-empty user_id as employee (0 counts)', () => {
    assert.equal(isEmployeePayee({ user_id: 7 }), true);
    assert.equal(isEmployeePayee({ user_id: '7' }), true);
    assert.equal(isEmployeePayee({ user_id: 0 }), true);
    assert.equal(isEmployeePayee({ user_id: '' }), false);
    assert.equal(isEmployeePayee({ user_id: null }), false);
    assert.equal(isEmployeePayee({ user_id: undefined }), false);
    assert.equal(isEmployeePayee({}), false);
  });
});
