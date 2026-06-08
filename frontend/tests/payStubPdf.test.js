import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  buildPreparedPaystubPages,
  computePayPeriodBounds,
  countWeeklyPayChecksThroughInclusive,
  paycheckGrossFromEntry,
  weeklyChecksSharePayWeekDay,
} from '../src/utils/payStubPdf.js';

describe('pay-stub pay period helpers', () => {
  it('computes inclusive pay-period ranges from the selected frequency', () => {
    const weekly = computePayPeriodBounds(new Date(2025, 2, 7), 'Weekly');
    assert.equal(weekly.start.toISOString().slice(0, 10), '2025-03-01');
    assert.equal(weekly.end.toISOString().slice(0, 10), '2025-03-07');

    const semimonthlyFirstHalf = computePayPeriodBounds(new Date(2025, 2, 15), 'Semi-monthly');
    assert.equal(semimonthlyFirstHalf.start.toISOString().slice(0, 10), '2025-03-01');

    const semimonthlySecondHalf = computePayPeriodBounds(new Date(2025, 2, 31), 'Semi-monthly');
    assert.equal(semimonthlySecondHalf.start.toISOString().slice(0, 10), '2025-03-16');
  });

  it('scales a monthly gross entry once when spread across non-monthly checks', () => {
    assert.equal(paycheckGrossFromEntry(10000, 'Monthly', true), 10000);
    assert.equal(paycheckGrossFromEntry(10000, 'Weekly', false), 10000);
    assert.equal(paycheckGrossFromEntry(10000, 'Weekly', true), 120000 / 52);
    assert.equal(paycheckGrossFromEntry(10000, 'Bi-weekly', true), 120000 / 26);
  });
});

describe('weekly 1099 calendar YTD helpers', () => {
  it('counts actual weekly paycheck dates from the first matching weekday in the tax year', () => {
    assert.equal(countWeeklyPayChecksThroughInclusive('2025-01-01', 5), 0);
    assert.equal(countWeeklyPayChecksThroughInclusive('2025-01-03', 5), 1);
    assert.equal(countWeeklyPayChecksThroughInclusive('2025-02-07', 5), 6);
    assert.equal(countWeeklyPayChecksThroughInclusive('2025-12-26', 5), 52);
  });

  it('accepts unordered weekly checks only when every check shares the same weekday', () => {
    assert.deepEqual(weeklyChecksSharePayWeekDay(['2025-03-07', '2025-02-07']), {
      ok: true,
      payWeekDay: 5,
    });

    assert.deepEqual(weeklyChecksSharePayWeekDay(['2025-03-07', '2025-03-08']), {
      ok: false,
      payWeekDay: undefined,
    });
  });

  it('uses discrete weekly paycheck counts for 1099 calendar YTD instead of monthly interpolation', () => {
    const pages = buildPreparedPaystubPages(
      [
        { periodEnd: '2025-02-07', gross: 1000 },
        { periodEnd: '2025-03-07', gross: 1000 },
      ],
      true,
      {},
      {
        calendarYtdBackfill: true,
        payFrequency: 'Weekly',
      },
    );

    assert.equal(pages.length, 2);
    assert.equal(pages[0].gross, 1000);
    assert.equal(pages[0].ytdGross, 6000);
    assert.equal(pages[0].netYtd, 6000);
    assert.equal(pages[1].gross, 1000);
    assert.equal(pages[1].ytdGross, 10000);
    assert.equal(pages[1].netYtd, 10000);
  });
});
