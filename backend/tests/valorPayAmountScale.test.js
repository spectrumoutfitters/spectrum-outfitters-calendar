import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { aggregateValorPayByDay } from '../utils/valorPayRevenue.js';

function approvedSale(extra) {
  return {
    date: '2026-04-02',
    status: 'approved',
    type: 'sale',
    ...extra,
  };
}

describe('Valor Pay amount scale', () => {
  it('uses amountCents / 100 when a positive amount is under 100', () => {
    const rows = aggregateValorPayByDay([
      approvedSale({ amount: 1, amountCents: 2599 }),
    ]);

    assert.equal(rows.length, 1);
    assert.equal(rows[0].revenue, '25.99');
    assert.equal(rows[0].charge_count, 1);
    assert.equal(rows[0].refund_total, '0.00');
  });

  it('keeps major units once amount is 100 or more, even if amountCents is present', () => {
    const rows = aggregateValorPayByDay([
      approvedSale({ amount: 150, amountCents: 9999 }),
      approvedSale({ date: '2026-04-03', amount: 100, amountCents: 100 }),
    ]);
    const byDate = Object.fromEntries(rows.map((row) => [row.date, row]));

    assert.equal(byDate['2026-04-02'].revenue, '150.00');
    assert.equal(byDate['2026-04-03'].revenue, '100.00');
  });

  it('reads amount_cents when amountCents is absent', () => {
    const rows = aggregateValorPayByDay([
      approvedSale({ amount: 10, amountCents: null, amount_cents: 4321 }),
    ]);

    assert.equal(rows[0].revenue, '43.21');
  });

  it('scales refund rows with the same cents rule before subtracting', () => {
    const rows = aggregateValorPayByDay([
      approvedSale({ amount: 80, amountCents: 8000 }),
      {
        date: '2026-04-02',
        status: 'approved',
        type: 'refund',
        amount: 1,
        amountCents: 250,
      },
    ]);

    assert.equal(rows[0].revenue, '77.50');
    assert.equal(rows[0].charge_count, 1);
    assert.equal(rows[0].refund_total, '2.50');
  });
});
