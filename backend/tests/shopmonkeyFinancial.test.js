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

  it('counts Processing charges and treats a missing amount as zero cents', async () => {
    const { aggregatePaymentsByDay } = await import('../utils/shopmonkey.js');

    const result = aggregatePaymentsByDay([
      { recordedDate: '2026-03-02', amountCents: 250, status: 'Processing', transactionType: 'Charge' },
      { recordedDate: '2026-03-02', status: 'succeeded', transactionType: 'Charge' },
    ]);

    assert.equal(result.length, 1);
    assert.equal(result[0].date, '2026-03-02');
    assert.equal(result[0].revenue, 2.5);
    assert.equal(result[0].charge_count, 2);
    assert.equal(Number.isNaN(result[0].revenue), false);
  });

  it('uses createdDate when recordedDate is missing and prefers recordedDate when both exist', async () => {
    const { aggregatePaymentsByDay } = await import('../utils/shopmonkey.js');

    const result = aggregatePaymentsByDay([
      { createdDate: '2026-03-03T15:00:00Z', amountCents: 1000, status: 'succeeded', transactionType: 'Charge' },
      {
        recordedDate: '2026-03-04T01:00:00Z',
        createdDate: '2026-01-01T00:00:00Z',
        amountCents: 100,
        status: 'succeeded',
        transactionType: 'Charge',
      },
    ]);

    const byDate = Object.fromEntries(result.map((d) => [d.date, d]));
    assert.equal(byDate['2026-03-03'].revenue, 10);
    assert.equal(byDate['2026-03-04'].revenue, 1);
    assert.equal(byDate['2026-01-01'], undefined);
  });

  it('skips rows with no date and nets a refund-only day without incrementing charges', async () => {
    const { aggregatePaymentsByDay } = await import('../utils/shopmonkey.js');

    const result = aggregatePaymentsByDay([
      { amountCents: 500, status: 'succeeded', transactionType: 'Charge' },
      { recordedDate: '', createdDate: '', amountCents: 500, status: 'succeeded', transactionType: 'Charge' },
      { recordedDate: '2026-03-05', amountCents: 400, status: 'succeeded', transactionType: 'Refund' },
    ]);

    assert.equal(result.length, 1);
    assert.equal(result[0].date, '2026-03-05');
    assert.equal(result[0].revenue, -4);
    assert.equal(result[0].charge_count, 0);
    assert.equal(result[0].refund_total, 4);
  });
});
