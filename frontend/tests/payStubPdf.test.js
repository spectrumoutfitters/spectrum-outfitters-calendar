import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  buildPreparedPaystubPages,
  countWeeklyPayChecksThroughInclusive,
  paycheckGrossFromEntry,
  weeklyChecksSharePayWeekDay,
} from '../src/utils/payStubPdf.js';

describe('pay stub calendar YTD helpers', () => {
  it('counts actual weekly check dates from the first matching weekday in the tax year', () => {
    assert.equal(countWeeklyPayChecksThroughInclusive('2025-03-31', 1), 13);
    assert.equal(countWeeklyPayChecksThroughInclusive('2025-01-05', 1), 0);
    assert.equal(countWeeklyPayChecksThroughInclusive('2025-01-06', 1), 1);
    assert.equal(countWeeklyPayChecksThroughInclusive('2025-03-31', 7), 0);
  });

  it('detects whether weekly check dates share one payday weekday regardless of input order', () => {
    assert.deepEqual(weeklyChecksSharePayWeekDay(['2025-01-20', '2025-01-06', '2025-01-13']), {
      ok: true,
      payWeekDay: 1,
    });

    assert.deepEqual(weeklyChecksSharePayWeekDay(['2025-01-06', '2025-01-14']), {
      ok: false,
      payWeekDay: undefined,
    });
  });
});

describe('buildPreparedPaystubPages', () => {
  it('uses discrete weekly paycheck counts for 1099 calendar YTD instead of monthly phantom gross', () => {
    const pages = buildPreparedPaystubPages(
      [
        {
          periodEnd: '2025-03-31',
          gross: 1000,
        },
      ],
      true,
      {},
      {
        calendarYtdBackfill: true,
        payFrequency: 'Weekly',
      },
    );

    assert.equal(pages.length, 1);
    assert.equal(pages[0].gross, 1000);
    assert.equal(pages[0].ytdGross, 13000);
    assert.equal(pages[0].netYtd, 13000);
  });

  it('falls back to exported check totals when weekly 1099 dates are not aligned', () => {
    const pages = buildPreparedPaystubPages(
      [
        { periodEnd: '2025-03-31', gross: 1000 },
        { periodEnd: '2025-04-01', gross: 1000 },
      ],
      true,
      {},
      {
        calendarYtdBackfill: true,
        payFrequency: 'Weekly',
      },
    );

    assert.equal(pages[0].ytdGross, 1000);
    assert.equal(pages[1].ytdGross, 2000);
  });
});

describe('paycheckGrossFromEntry', () => {
  it('converts a monthly entry to a weekly paycheck only when spreading is enabled', () => {
    assert.equal(paycheckGrossFromEntry(10000, 'Weekly', false), 10000);
    assert.equal(paycheckGrossFromEntry(10000, 'Monthly', true), 10000);
    assert.equal(paycheckGrossFromEntry(10000, 'Weekly', true), (10000 * 12) / 52);
  });
});
