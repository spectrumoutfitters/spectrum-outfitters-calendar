import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { toNumber, pickSplitPayRunAmount } from '../utils/payrollSplitAmount.js';

describe('toNumber', () => {
  it('parses finite numbers and otherwise returns 0', () => {
    assert.equal(toNumber('12.50'), 12.5);
    assert.equal(toNumber(8), 8);
    assert.equal(toNumber('0'), 0);
    assert.equal(toNumber(''), 0);
    assert.equal(toNumber(null), 0);
    assert.equal(toNumber('nope'), 0);
    assert.equal(toNumber(undefined), 0);
  });
});

describe('pickSplitPayRunAmount', () => {
  it('uses weekly_salary when it parses > 0, else split_reimbursable_amount', () => {
    assert.equal(pickSplitPayRunAmount({ weekly_salary: '400', split_reimbursable_amount: '100' }), 400);
    assert.equal(pickSplitPayRunAmount({ weekly_salary: 0, split_reimbursable_amount: '75.25' }), 75.25);
    assert.equal(pickSplitPayRunAmount({ weekly_salary: '0', split_reimbursable_amount: 50 }), 50);
    assert.equal(pickSplitPayRunAmount({ weekly_salary: '', split_reimbursable_amount: '10' }), 10);
    assert.equal(pickSplitPayRunAmount({ weekly_salary: 'n/a', split_reimbursable_amount: null }), 0);
    assert.equal(pickSplitPayRunAmount({}), 0);
  });
});
