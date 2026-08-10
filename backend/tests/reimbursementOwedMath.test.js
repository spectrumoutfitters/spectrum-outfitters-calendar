import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  recomputeReimbursementOwed,
  cumulativeExpectedFromOther,
} from '../utils/reimbursementOwedMath.js';

describe('recomputeReimbursementOwed', () => {
  it('returns 0 when expected amount is missing or there are no pay records', () => {
    assert.equal(recomputeReimbursementOwed({ expected_amount: 0, expected_period: 'weekly' }, [{ pay_date: '2026-01-01' }], 0), 0);
    assert.equal(recomputeReimbursementOwed({ expected_amount: 100, expected_period: 'weekly' }, [], 0), 0);
  });

  it('weekly: pay-run count × expected − received, floored at 0', () => {
    const src = { expected_amount: 200, expected_period: 'weekly' };
    const records = [
      { pay_date: '2026-01-02' },
      { pay_date: '2026-01-09' },
      { pay_date: '2026-01-16' },
    ];
    assert.equal(recomputeReimbursementOwed(src, records, 100), 500);
    assert.equal(recomputeReimbursementOwed(src, records, 1000), 0);
  });

  it('monthly: unique YYYY-MM count × expected − received (ISO timestamps normalize)', () => {
    const src = { expected_amount: 300, expected_period: 'monthly' };
    const records = [
      { pay_date: '2026-01-02' },
      { pay_date: '2026-01-16T16:28:00.000Z' }, // same month
      { pay_date: '2026-02-06' },
    ];
    assert.equal(recomputeReimbursementOwed(src, records, 100), 500); // 2 months * 300 - 100
  });
});

describe('cumulativeExpectedFromOther', () => {
  it('returns null when expected is non-positive or history is empty', () => {
    assert.equal(cumulativeExpectedFromOther({ expected_amount: 0 }, [{ pay_date: '2026-01-01' }]), null);
    assert.equal(cumulativeExpectedFromOther({ expected_amount: 50, expected_period: 'weekly' }, []), null);
    assert.equal(cumulativeExpectedFromOther({ expected_amount: 50, expected_period: 'weekly' }, null), null);
  });

  it('weekly multiplies by pay-record count; monthly by unique months', () => {
    assert.equal(
      cumulativeExpectedFromOther(
        { expected_amount: '25', expected_period: 'weekly' },
        [{ pay_date: '2026-03-01' }, { pay_date: '2026-03-08' }]
      ),
      50
    );
    assert.equal(
      cumulativeExpectedFromOther(
        { expected_amount: 100, expected_period: 'monthly' },
        [{ pay_date: '2026-03-01' }, { pay_date: '2026-03-15' }, { pay_date: '2026-04-01' }]
      ),
      200
    );
  });
});
