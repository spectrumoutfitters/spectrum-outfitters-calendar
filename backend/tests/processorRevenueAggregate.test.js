import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { aggregateStripeChargesByDay } from '../utils/stripeRevenue.js';
import { aggregateValorPayByDay } from '../utils/valorPayRevenue.js';

describe('aggregateStripeChargesByDay', () => {
  it('nets refunds and groups succeeded paid charges by UTC date', () => {
    const charges = [
      {
        status: 'succeeded',
        paid: true,
        amount: 10000,
        amount_refunded: 2500,
        created: Date.UTC(2026, 0, 15, 18, 0, 0) / 1000,
      },
      {
        status: 'succeeded',
        paid: true,
        amount: 5000,
        amount_refunded: 0,
        created: Date.UTC(2026, 0, 15, 20, 0, 0) / 1000,
      },
      {
        status: 'succeeded',
        paid: true,
        amount: 2000,
        amount_refunded: 0,
        created: Date.UTC(2026, 0, 16, 1, 0, 0) / 1000,
      },
    ];

    const rows = aggregateStripeChargesByDay(charges).sort((a, b) => a.date.localeCompare(b.date));
    assert.deepEqual(rows, [
      {
        date: '2026-01-15',
        revenue: '125.00',
        charge_count: 2,
        refund_total: '25.00',
      },
      {
        date: '2026-01-16',
        revenue: '20.00',
        charge_count: 1,
        refund_total: '0.00',
      },
    ]);
  });

  it('ignores unpaid, failed, and non-succeeded charges', () => {
    const charges = [
      { status: 'succeeded', paid: false, amount: 9999, amount_refunded: 0, created: 1_700_000_000 },
      { status: 'failed', paid: true, amount: 9999, amount_refunded: 0, created: 1_700_000_000 },
      { status: 'pending', paid: true, amount: 9999, amount_refunded: 0, created: 1_700_000_000 },
    ];
    assert.deepEqual(aggregateStripeChargesByDay(charges), []);
  });

  it('returns [] for empty input', () => {
    assert.deepEqual(aggregateStripeChargesByDay([]), []);
  });
});

describe('aggregateValorPayByDay', () => {
  it('counts approved sales and subtracts refund rows / partial refunds', () => {
    const txns = [
      { date: '2026-02-01', status: 'approved', type: 'sale', amount: 100 },
      { date: '2026-02-01', status: '00', type: 'sale', amount: 40, amount_refunded: 10 },
      { date: '2026-02-01', status: 'approved', type: 'refund', amount: 15 },
      { date: '2026-02-02', status: 'declined', type: 'sale', amount: 999 },
      { date: '2026-02-02', status: '', type: 'sale', amount: 25 },
    ];

    const rows = aggregateValorPayByDay(txns).sort((a, b) => a.date.localeCompare(b.date));
    assert.deepEqual(rows, [
      {
        date: '2026-02-01',
        // (100 + 40) sales - (10 partial + 15 refund row) = 115
        revenue: '115.00',
        charge_count: 2,
        refund_total: '25.00',
      },
      {
        date: '2026-02-02',
        // empty status + sale type still counts as approved
        revenue: '25.00',
        charge_count: 1,
        refund_total: '0.00',
      },
    ]);
  });

  it('accepts alternate date/status field names used by Valor payloads', () => {
    const rows = aggregateValorPayByDay([
      {
        transactionDate: '2026-03-10T14:22:00Z',
        responseCode: '0',
        txn_type: 'sale',
        saleAmount: 12.5,
      },
      {
        created: 1_741_622_400, // 2025-03-10T16:00:00.000Z
        result: 'captured',
        transactionType: 'SALE',
        total: 7.5,
      },
    ]);

    const byDate = Object.fromEntries(rows.map((r) => [r.date, r]));
    assert.equal(byDate['2026-03-10'].revenue, '12.50');
    assert.equal(byDate['2026-03-10'].charge_count, 1);
    assert.ok(byDate['2025-03-10']);
    assert.equal(byDate['2025-03-10'].revenue, '7.50');
  });

  it('skips rows without a usable date', () => {
    assert.deepEqual(
      aggregateValorPayByDay([{ status: 'approved', type: 'sale', amount: 10 }]),
      [],
    );
  });
});
