import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { aggregateValorPayByDay } from '../utils/valorPayRevenue.js';

function byDate(rows) {
  return Object.fromEntries(rows.map((row) => [row.date, row]));
}

describe('aggregateValorPayByDay approval gate', () => {
  it('drops declined, failed, void, and non-approved response codes', () => {
    const rows = aggregateValorPayByDay([
      { date: '2026-04-02', status: 'declined', type: 'sale', amount: 80 },
      { date: '2026-04-02', status: 'FAILED', type: 'sale', amount: 40 },
      { date: '2026-04-02', status: 'void', type: 'sale', amount: 15 },
      { date: '2026-04-02', status: '05', type: 'sale', amount: 9 },
      { date: '2026-04-02', status: 'approved', type: 'sale', amount: 12.5 },
    ]);

    assert.equal(rows.length, 1);
    assert.equal(rows[0].revenue, '12.50');
    assert.equal(rows[0].charge_count, 1);
    assert.equal(rows[0].refund_total, '0.00');
  });

  it('counts processor approval aliases and empty-status sales', () => {
    const aliases = ['00', '0', 'succeeded', 'complete', 'captured', 'Y', 'yes', 'auth', 'closed', 'APPROVED'];
    const rows = aggregateValorPayByDay([
      ...aliases.map((status, i) => ({
        date: '2026-04-02',
        status,
        type: 'sale',
        amount: 10 + i,
      })),
      { date: '2026-04-02', status: '', type: 'sale', amount: 3 },
      { date: '2026-04-02', status: '', type: 'auth', amount: 99 },
    ]);

    const expected = aliases.reduce((sum, _, i) => sum + 10 + i, 0) + 3;
    assert.equal(rows.length, 1);
    assert.equal(rows[0].revenue, expected.toFixed(2));
    assert.equal(rows[0].charge_count, aliases.length + 1);
  });
});

describe('aggregateValorPayByDay refunds', () => {
  it('subtracts refund and refund_offset rows without counting them as charges', () => {
    const rows = aggregateValorPayByDay([
      { date: '2026-04-04', status: 'approved', type: 'sale', amount: 100 },
      { date: '2026-04-04', status: 'approved', type: 'refund', amount: 20 },
      { date: '2026-04-04', status: 'approved', type: 'refund_offset', amount: 5 },
      { date: '2026-04-04', status: 'approved', type: 'refundoffset', amount: 2.5 },
    ]);

    assert.equal(rows[0].revenue, '72.50');
    assert.equal(rows[0].charge_count, 1);
    assert.equal(rows[0].refund_total, '27.50');
  });

  it('reduces an approved sale by its partial refund and can go negative', () => {
    const rows = byDate(aggregateValorPayByDay([
      { date: '2026-04-05', status: 'captured', type: 'sale', amount: 40, refundAmount: 15 },
      { date: '2026-04-06', status: 'approved', type: 'sale', amount: 10 },
      { date: '2026-04-06', status: 'approved', type: 'refund', amount: 25 },
    ]));

    assert.equal(rows['2026-04-05'].revenue, '25.00');
    assert.equal(rows['2026-04-05'].charge_count, 1);
    assert.equal(rows['2026-04-05'].refund_total, '15.00');
    assert.equal(rows['2026-04-06'].revenue, '-15.00');
    assert.equal(rows['2026-04-06'].charge_count, 1);
    assert.equal(rows['2026-04-06'].refund_total, '25.00');
  });
});

describe('aggregateValorPayByDay dates and amount fields', () => {
  it('uses calendar prefixes, unix seconds, and alternate date and amount fields', () => {
    const seconds = Math.floor(Date.UTC(2026, 3, 2, 15, 0, 0) / 1000);
    const rows = byDate(aggregateValorPayByDay([
      { transactionDate: '2026-04-02T23:59:00-05:00', status: 'approved', type: 'sale', saleAmount: 18 },
      { date: seconds, status: '00', type: 'sale', sale_amount: 7 },
      { date: '', status: 'approved', type: 'sale', amount: 500 },
      { status: 'approved', type: 'sale', amount: 500 },
    ]));

    assert.deepEqual(Object.keys(rows).sort(), ['2026-04-02']);
    assert.equal(rows['2026-04-02'].revenue, '25.00');
    assert.equal(rows['2026-04-02'].charge_count, 2);
  });
});
