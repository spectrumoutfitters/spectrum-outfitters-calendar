import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('aggregatePaymentsByDay', () => {
  it('groups successful charges by day and converts cents to dollars', async () => {
    const { aggregatePaymentsByDay } = await import('../utils/shopmonkey.js');

    const payments = [
      { recordedDate: '2026-02-10T10:00:00Z', amountCents: 50000, status: 'Succeeded', transactionType: 'Charge' },
      { recordedDate: '2026-02-10T14:00:00Z', amountCents: 30000, status: 'Succeeded', transactionType: 'Charge' },
      { recordedDate: '2026-02-11T09:00:00Z', amountCents: 20000, status: 'Succeeded', transactionType: 'Charge' },
      { recordedDate: '2026-02-11T11:00:00Z', amountCents: 5000, status: 'Succeeded', transactionType: 'Refund' },
    ];

    const result = aggregatePaymentsByDay(payments);
    assert.equal(result.length, 2);

    const day10 = result.find(d => d.date === '2026-02-10');
    assert.equal(day10.revenue, 800); // (50000 + 30000) / 100
    assert.equal(day10.charge_count, 2);

    const day11 = result.find(d => d.date === '2026-02-11');
    assert.equal(day11.revenue, 150); // (20000 - 5000) / 100
    assert.equal(day11.charge_count, 1);
    assert.equal(day11.refund_total, 50); // 5000 / 100
  });

  it('ignores non-succeeded payments', async () => {
    const { aggregatePaymentsByDay } = await import('../utils/shopmonkey.js');

    const payments = [
      { recordedDate: '2026-02-10T10:00:00Z', amountCents: 50000, status: 'Failed', transactionType: 'Charge' },
      { recordedDate: '2026-02-10T14:00:00Z', amountCents: 30000, status: 'Canceled', transactionType: 'Charge' },
    ];

    const result = aggregatePaymentsByDay(payments);
    assert.equal(result.length, 0);
  });

  it('returns empty array for empty input', async () => {
    const { aggregatePaymentsByDay } = await import('../utils/shopmonkey.js');
    const result = aggregatePaymentsByDay([]);
    assert.equal(result.length, 0);
  });
});
