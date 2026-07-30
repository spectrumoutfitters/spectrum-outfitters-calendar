import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  previousFridayFrom,
  resolveSplitPayRunAmount,
  toNumber,
} from '../utils/payrollSplitRunsMath.js';

describe('toNumber', () => {
  it('parses finite numbers and treats junk as 0', () => {
    assert.equal(toNumber('450.5'), 450.5);
    assert.equal(toNumber(0), 0);
    assert.equal(toNumber(''), 0);
    assert.equal(toNumber(null), 0);
    assert.equal(toNumber('abc'), 0);
  });
});

describe('previousFridayFrom', () => {
  it('returns the same day when already Friday', () => {
    // 2026-07-17 is a Friday
    assert.equal(previousFridayFrom('2026-07-17'), '2026-07-17');
  });

  it('steps back from Saturday/Sunday to that Friday', () => {
    assert.equal(previousFridayFrom('2026-07-18'), '2026-07-17');
    assert.equal(previousFridayFrom('2026-07-19'), '2026-07-17');
  });

  it('never advances forward — Monday uses the prior Friday', () => {
    // Contrast with getWeekEndingFridayHouston which would return 2026-07-24
    assert.equal(previousFridayFrom('2026-07-20'), '2026-07-17');
    assert.equal(previousFridayFrom('2026-07-23'), '2026-07-17');
  });
});

describe('resolveSplitPayRunAmount', () => {
  it('prefers weekly_salary when positive', () => {
    assert.equal(
      resolveSplitPayRunAmount({ weekly_salary: 1850, split_reimbursable_amount: 450 }),
      1850
    );
  });

  it('falls back to split_reimbursable_amount when salary is 0 / missing', () => {
    assert.equal(
      resolveSplitPayRunAmount({ weekly_salary: 0, split_reimbursable_amount: 450 }),
      450
    );
    assert.equal(
      resolveSplitPayRunAmount({ split_reimbursable_amount: '300.25' }),
      300.25
    );
  });

  it('returns 0 when both amounts are missing or non-numeric', () => {
    assert.equal(resolveSplitPayRunAmount({}), 0);
    assert.equal(resolveSplitPayRunAmount({ weekly_salary: 'x', split_reimbursable_amount: null }), 0);
  });
});
