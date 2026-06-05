import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

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

describe('payStubPdf pay frequency calculations', () => {
  it('splits a monthly gross entry across non-monthly paychecks exactly once', () => {
    assert.equal(paycheckGrossFromEntry(10000, 'Monthly', true), 10000);
    assert.equal(paycheckGrossFromEntry(10000, 'Weekly', false), 10000);
    assertClose(paycheckGrossFromEntry(10000, 'Weekly', true), 2307.69, 'weekly split');
    assertClose(paycheckGrossFromEntry(10000, 'Bi-weekly', true), 4615.38, 'bi-weekly split');
  });

  it('prepares weekly rows from the raw monthly gross without double-scaling', () => {
    const [page] = buildPreparedPaystubPages(
      [{ periodEnd: '2026-03-06', gross: 10000 }],
      true,
      {},
      {
        calendarYtdBackfill: false,
        payFrequency: 'Weekly',
        spreadMonthlyAcrossPaychecks: true,
      },
    );

    assertClose(page.gross, 2307.69, 'current gross');
    assertClose(page.ytdGross, 2307.69, 'YTD gross');
  });
});

describe('payStubPdf weekly paycheck-date YTD', () => {
  it('counts only actual weekly paycheck dates through the inclusive period end', () => {
    assert.equal(countWeeklyPayChecksThroughInclusive('2026-01-01', 5), 0);
    assert.equal(countWeeklyPayChecksThroughInclusive('2026-01-02', 5), 1);
    assert.equal(countWeeklyPayChecksThroughInclusive('2026-03-20', 5), 12);
    assert.equal(countWeeklyPayChecksThroughInclusive('2026-03-20', 7), 0);
  });

  it('detects whether exported weekly checks all share one payday', () => {
    assert.deepEqual(
      weeklyChecksSharePayWeekDay(['2026-03-20', '2026-03-06', '2026-03-13']),
      { ok: true, payWeekDay: 5 },
    );

    assert.deepEqual(
      weeklyChecksSharePayWeekDay(['2026-03-20', '2026-03-12']),
      { ok: false, payWeekDay: undefined },
    );
  });

  it('uses discrete weekly paycheck counts for 1099 calendar YTD when weeks are skipped', () => {
    const pages = buildPreparedPaystubPages(
      [
        { periodEnd: '2026-03-06', gross: 1000 },
        { periodEnd: '2026-03-20', gross: 1000 },
      ],
      true,
      {},
      {
        calendarYtdBackfill: true,
        payFrequency: 'Weekly',
        spreadMonthlyAcrossPaychecks: false,
      },
    );

    assert.equal(pages.length, 2);
    assert.equal(pages[0].gross, 1000);
    assert.equal(pages[1].gross, 1000);
    assert.equal(pages[0].ytdGross, 10000);
    assert.equal(pages[1].ytdGross, 12000);
    assert.equal(pages[1].totalDedYtd, 0);
    assert.equal(pages[1].netYtd, 12000);
  });
});
