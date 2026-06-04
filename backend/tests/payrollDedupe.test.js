import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('payroll dedupe helpers', () => {
  it('normalizes display names before comparing salaried payroll people', async () => {
    const { normalizedNamesWithWeeklySalary } = await import('../utils/payrollDedupe.js');

    const names = normalizedNamesWithWeeklySalary([
      { full_name: '  Jane   Driver ', weekly_salary: '1200' },
      { full_name: 'Hourly Only', weekly_salary: '0' },
      { full_name: 'No Salary', weekly_salary: '' },
    ]);

    assert.deepEqual([...names], ['jane driver']);
  });

  it('dedupes same-day records and same-amount records within the split-run window', async () => {
    const { dedupePayRecordsList } = await import('../utils/payrollDedupe.js');

    const records = [
      { id: 'weekly-source', pay_date: '2026-04-14T16:28:00.000Z', amount: '1200.004' },
      { id: 'same-day-import-duplicate', pay_date: '2026-04-14', amount: 1200 },
      { id: 'same-amount-six-days-later', pay_date: '2026-04-20', amount: '1200.00' },
      { id: 'next-week', pay_date: '2026-04-21', amount: '1200.00' },
      { id: 'same-day-different-amount', pay_date: '2026-04-14', amount: '1250.00' },
    ];

    const deduped = dedupePayRecordsList(records);

    assert.deepEqual(
      deduped.map((record) => record.id),
      ['weekly-source', 'same-day-different-amount', 'next-week'],
    );
  });

  it('keeps records with the same raw invalid date separate from valid calendar dates', async () => {
    const { dedupePayRecordsList } = await import('../utils/payrollDedupe.js');

    const deduped = dedupePayRecordsList([
      { id: 'valid', pay_date: '2026-04-14', amount: 900 },
      { id: 'invalid-one', pay_date: 'not-a-date', amount: 900 },
      { id: 'invalid-duplicate', pay_date: 'not-a-date', amount: 900 },
    ]);

    assert.deepEqual(
      deduped.map((record) => record.id),
      ['valid', 'invalid-one'],
    );
  });
});
