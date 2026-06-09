import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  buildPreparedPaystubPages,
  countWeeklyPayChecksThroughInclusive,
  paycheckGrossFromEntry,
  weeklyChecksSharePayWeekDay,
} from '../src/utils/payStubPdf.js';

function assertClose(actual, expected, message) {
  assert.ok(
    Math.abs(actual - expected) < 0.01,
    `${message}: expected ${expected}, got ${actual}`,
  );
}

describe('pay stub weekly YTD helpers', () => {
  it('counts actual weekly check dates from the first matching weekday in the tax year', () => {
    assert.equal(countWeeklyPayChecksThroughInclusive('2025-02-07', 5), 6);
    assert.equal(countWeeklyPayChecksThroughInclusive('2025-01-01', 3), 1);
    assert.equal(countWeeklyPayChecksThroughInclusive('2025-02-07', 9), 0);
  });

  it('requires weekly exported checks to share one paycheck weekday', () => {
    assert.deepEqual(weeklyChecksSharePayWeekDay(['2025-02-07', '2025-02-14']), {
      ok: true,
      payWeekDay: 5,
    });
    assert.deepEqual(weeklyChecksSharePayWeekDay(['2025-02-07', '2025-02-13']), {
      ok: false,
      payWeekDay: undefined,
    });
  });
});

describe('buildPreparedPaystubPages', () => {
  it('uses discrete weekly paycheck counts for 1099 calendar YTD instead of monthly phantom gross', () => {
    const pages = buildPreparedPaystubPages(
      [
        { periodEnd: '2025-02-07', gross: 1000 },
        { periodEnd: '2025-02-21', gross: 1000 },
      ],
      true,
      {},
      { calendarYtdBackfill: true, payFrequency: 'Weekly' },
    );

    assert.equal(pages.length, 2);
    assert.equal(pages[0].gross, 1000);
    assert.equal(pages[0].ytdGross, 6000);
    assert.equal(pages[0].netYtd, 6000);
    assert.equal(pages[1].ytdGross, 8000);
    assert.equal(pages[1].netYtd, 8000);
  });

  it('spreads a monthly gross entry once across weekly checks', () => {
    const weeklyGross = paycheckGrossFromEntry(12000, 'Weekly', true);
    assertClose(weeklyGross, 2769.23, 'weekly gross converted from monthly entry');
    assert.equal(paycheckGrossFromEntry(12000, 'Monthly', true), 12000);
    assert.equal(paycheckGrossFromEntry(12000, 'Weekly', false), 12000);

    const pages = buildPreparedPaystubPages(
      [
        { periodEnd: '2025-01-03', gross: 12000 },
        { periodEnd: '2025-01-10', gross: 12000 },
      ],
      true,
      {},
      { payFrequency: 'Weekly', spreadMonthlyAcrossPaychecks: true },
    );

    assertClose(pages[0].gross, weeklyGross, 'first prepared weekly gross');
    assertClose(pages[0].ytdGross, weeklyGross, 'first prepared weekly YTD gross');
    assertClose(pages[1].gross, weeklyGross, 'second prepared weekly gross');
    assertClose(pages[1].ytdGross, weeklyGross * 2, 'second prepared weekly YTD gross');
  });
});
