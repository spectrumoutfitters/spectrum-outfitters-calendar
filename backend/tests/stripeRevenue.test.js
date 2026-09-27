import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { aggregateStripeChargesByDay, stripeSecretKeyAccepted } from '../utils/stripeRevenue.js';

function charge(overrides) {
  return {
    status: 'succeeded',
    paid: true,
    created: Date.parse('2026-03-10T15:00:00.000Z') / 1000,
    amount: 10000,
    amount_refunded: 0,
    ...overrides,
  };
}

describe('stripeSecretKeyAccepted', () => {
  it('accepts only secret keys', () => {
    assert.equal(stripeSecretKeyAccepted('sk_test_abc'), true);
    assert.equal(stripeSecretKeyAccepted('sk_live_abc'), true);
  });

  it('rejects missing, publishable, restricted, and non-prefix values', () => {
    assert.equal(stripeSecretKeyAccepted(undefined), false);
    assert.equal(stripeSecretKeyAccepted(null), false);
    assert.equal(stripeSecretKeyAccepted(''), false);
    assert.equal(stripeSecretKeyAccepted('pk_live_abc'), false);
    assert.equal(stripeSecretKeyAccepted('rk_live_abc'), false);
    assert.equal(stripeSecretKeyAccepted('SK_live_abc'), false);
    assert.equal(stripeSecretKeyAccepted(' sk_live_abc'), false);
  });
});

describe('aggregateStripeChargesByDay', () => {
  it('nets partial refunds into dollar strings and counts the charge', () => {
    const [day] = aggregateStripeChargesByDay([
      charge({ amount: 10000, amount_refunded: 2500 }),
    ]);

    assert.equal(day.date, '2026-03-10');
    assert.equal(day.revenue, '75.00');
    assert.equal(typeof day.revenue, 'string');
    assert.equal(day.refund_total, '25.00');
    assert.equal(typeof day.refund_total, 'string');
    assert.equal(day.charge_count, 1);
  });

  it('sums same-day charges and keeps a full refund as a zero-net day', () => {
    const result = aggregateStripeChargesByDay([
      charge({ amount: 10000, amount_refunded: 1000 }),
      charge({ amount: 2000, amount_refunded: 0, created: Date.parse('2026-03-10T18:00:00.000Z') / 1000 }),
      charge({ amount: 5000, amount_refunded: 5000, created: Date.parse('2026-03-11T12:00:00.000Z') / 1000 }),
    ]);

    const march10 = result.find((d) => d.date === '2026-03-10');
    const march11 = result.find((d) => d.date === '2026-03-11');
    assert.equal(march10.revenue, '110.00');
    assert.equal(march10.refund_total, '10.00');
    assert.equal(march10.charge_count, 2);
    assert.equal(march11.revenue, '0.00');
    assert.equal(march11.refund_total, '50.00');
    assert.equal(march11.charge_count, 1);
  });

  it('requires succeeded status and paid === true', () => {
    const result = aggregateStripeChargesByDay([
      charge({ status: 'failed', paid: true, amount: 9000 }),
      charge({ status: 'pending', paid: true, amount: 8000 }),
      charge({ status: 'SUCCEEDED', paid: false, amount: 7000 }),
      charge({ status: 'succeeded', paid: 1, amount: 6000 }),
      charge({ status: '', paid: true, amount: 5000 }),
      charge({ amount: 4000 }),
    ]);

    assert.equal(result.length, 1);
    assert.equal(result[0].revenue, '40.00');
    assert.equal(result[0].charge_count, 1);
  });

  it('buckets by the UTC calendar date of created', () => {
    const [day] = aggregateStripeChargesByDay([
      charge({
        created: Date.parse('2026-07-15T04:30:00.000Z') / 1000,
        amount: 1500,
      }),
    ]);

    assert.equal(day.date, '2026-07-15');
    assert.equal(day.revenue, '15.00');
  });

  it('treats a missing amount as zero and still counts the charge', () => {
    const [day] = aggregateStripeChargesByDay([
      charge({ amount: undefined, amount_refunded: undefined }),
    ]);

    assert.equal(day.revenue, '0.00');
    assert.equal(day.refund_total, '0.00');
    assert.equal(day.charge_count, 1);
  });

  it('returns no days when nothing qualifies', () => {
    assert.deepEqual(aggregateStripeChargesByDay([]), []);
    assert.deepEqual(
      aggregateStripeChargesByDay([charge({ status: 'failed', paid: false })]),
      [],
    );
  });
});
