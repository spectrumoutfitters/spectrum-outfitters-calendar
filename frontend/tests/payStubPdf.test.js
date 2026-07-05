import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  buildPreparedPaystubPages,
  computePayPeriodBounds,
  countWeeklyPayChecksThroughInclusive,
  paycheckGrossFromEntry,
  weeklyChecksSharePayWeekDay,
} from '../src/utils/payStubPdf.js';

function localDateIso(d) {
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-');
}

describe('pay stub PDF calculations', () => {
  it('counts discrete weekly paycheck dates through the period end', () => {
    assert.equal(countWeeklyPayChecksThroughInclusive('2025-01-01', 5), 0);
    assert.equal(countWeeklyPayChecksThroughInclusive('2025-01-03', 5), 1);
    assert.equal(countWeeklyPayChecksThroughInclusive('2025-02-07', 5), 6);
  });

  it('uses actual weekly 1099 paycheck count for calendar YTD gross', () => {
    const pages = buildPreparedPaystubPages(
      [
        { periodEnd: '2025-01-17', gross: 1000 },
        { periodEnd: '2025-02-07', gross: 1000 },
      ],
      true,
      {},
      {
        calendarYtdBackfill: true,
        payFrequency: 'Weekly',
      },
    );

    assert.deepEqual(
      pages.map((p) => p.ytdGross),
      [3000, 6000],
    );
    assert.deepEqual(
      pages.map((p) => p.netYtd),
      [3000, 6000],
    );
  });

  it('falls back to exported 1099 rows when weekly dates are not aligned', () => {
    const pages = buildPreparedPaystubPages(
      [
        { periodEnd: '2025-01-17', gross: 1000 },
        { periodEnd: '2025-02-08', gross: 1000 },
      ],
      true,
      {},
      {
        calendarYtdBackfill: true,
        payFrequency: 'Weekly',
      },
    );

    assert.deepEqual(weeklyChecksSharePayWeekDay(['2025-01-17', '2025-02-08']), {
      ok: false,
      payWeekDay: undefined,
    });
    assert.deepEqual(
      pages.map((p) => p.ytdGross),
      [1000, 2000],
    );
  });

  it('splits an entered monthly amount across non-monthly paychecks only when requested', () => {
    assert.equal(paycheckGrossFromEntry(10000, 'Weekly', true), 10000 * 12 / 52);
    assert.equal(paycheckGrossFromEntry(10000, 'Bi-weekly', true), 10000 * 12 / 26);
    assert.equal(paycheckGrossFromEntry(10000, 'Monthly', true), 10000);
    assert.equal(paycheckGrossFromEntry(10000, 'Weekly', false), 10000);
  });

  it('computes inclusive pay period bounds for each supported frequency', () => {
    assert.deepEqual(
      Object.fromEntries(
        Object.entries({
          Weekly: computePayPeriodBounds(new Date(2025, 1, 28), 'Weekly'),
          'Bi-weekly': computePayPeriodBounds(new Date(2025, 1, 28), 'Bi-weekly'),
          'Semi-monthly-first': computePayPeriodBounds(new Date(2025, 1, 15), 'Semi-monthly'),
          'Semi-monthly-second': computePayPeriodBounds(new Date(2025, 1, 28), 'Semi-monthly'),
          Monthly: computePayPeriodBounds(new Date(2025, 1, 28), 'Monthly'),
        }).map(([key, { start, end }]) => [key, [localDateIso(start), localDateIso(end)]]),
      ),
      {
        Weekly: ['2025-02-22', '2025-02-28'],
        'Bi-weekly': ['2025-02-15', '2025-02-28'],
        'Semi-monthly-first': ['2025-02-01', '2025-02-15'],
        'Semi-monthly-second': ['2025-02-16', '2025-02-28'],
        Monthly: ['2025-02-01', '2025-02-28'],
      },
    );
  });
});
