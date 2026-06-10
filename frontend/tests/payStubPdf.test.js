import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  buildPreparedPaystubPages,
  countWeeklyPayChecksThroughInclusive,
  paycheckGrossFromEntry,
  weeklyChecksSharePayWeekDay,
} from '../src/utils/payStubPdf.js';

const closeToCents = (actual, expected) => {
  assert.ok(
    Math.abs(actual - expected) < 0.005,
    `expected ${actual} to be within one cent of ${expected}`,
  );
};

describe('weekly pay date helpers', () => {
  it('recognizes same-weekday checks regardless of input order', () => {
    assert.deepEqual(
      weeklyChecksSharePayWeekDay(['2026-02-06', '2026-01-23', '2026-01-30']),
      { ok: true, payWeekDay: 5 },
    );
  });

  it('rejects mixed weekdays for discrete weekly YTD counting', () => {
    assert.deepEqual(
      weeklyChecksSharePayWeekDay(['2026-01-30', '2026-02-05']),
      { ok: false, payWeekDay: undefined },
    );
  });

  it('treats an empty batch as aligned with no resolved weekday', () => {
    assert.deepEqual(weeklyChecksSharePayWeekDay([]), { ok: true, payWeekDay: undefined });
  });

  it('counts weekly paycheck dates from the first in-year weekday through period end', () => {
    assert.equal(countWeeklyPayChecksThroughInclusive('2026-01-30', 5), 5);
  });

  it('returns zero for invalid weekday anchors', () => {
    assert.equal(countWeeklyPayChecksThroughInclusive('2026-01-30', -1), 0);
    assert.equal(countWeeklyPayChecksThroughInclusive('2026-01-30', 7), 0);
    assert.equal(countWeeklyPayChecksThroughInclusive('2026-01-30', 2.5), 0);
  });
});

describe('paycheck gross conversion', () => {
  it('splits a monthly gross entry across weekly paychecks when requested', () => {
    closeToCents(paycheckGrossFromEntry(10000, 'Weekly', true), (10000 * 12) / 52);
  });

  it('keeps literal non-monthly entries when monthly spreading is disabled', () => {
    assert.equal(paycheckGrossFromEntry(10000, 'Weekly', false), 10000);
  });

  it('keeps monthly entries literal even when spreading is enabled', () => {
    assert.equal(paycheckGrossFromEntry(10000, 'Monthly', true), 10000);
  });
});

describe('buildPreparedPaystubPages YTD calculations', () => {
  it('uses discrete weekly paycheck counts for 1099 calendar YTD backfill', () => {
    const pages = buildPreparedPaystubPages(
      [
        { periodEnd: '2026-01-30', gross: 1000 },
        { periodEnd: '2026-02-06', gross: 1000 },
      ],
      true,
      {},
      {
        calendarYtdBackfill: true,
        payFrequency: 'Weekly',
      },
    );

    assert.equal(pages[0].ytdGross, 5000);
    assert.equal(pages[0].netYtd, 5000);
    assert.equal(pages[1].ytdGross, 6000);
    assert.equal(pages[1].netYtd, 6000);
  });

  it('splits W-2 monthly gross entries once for current and YTD weekly paychecks', () => {
    const weeklyGross = (10000 * 12) / 52;
    const pages = buildPreparedPaystubPages(
      [
        { periodEnd: '2026-01-02', gross: 10000 },
        { periodEnd: '2026-01-09', gross: 10000 },
      ],
      false,
      {},
      {
        spreadMonthlyAcrossPaychecks: true,
        payFrequency: 'Weekly',
      },
    );

    closeToCents(pages[0].gross, weeklyGross);
    closeToCents(pages[0].ytdGross, weeklyGross);
    closeToCents(pages[1].gross, weeklyGross);
    closeToCents(pages[1].ytdGross, weeklyGross * 2);
  });

  it('backfills W-2 prior months from the split paycheck without double-scaling', () => {
    const weeklyGross = (10000 * 12) / 52;
    const pages = buildPreparedPaystubPages(
      [{ periodEnd: '2026-03-06', gross: 10000 }],
      false,
      {},
      {
        calendarYtdBackfill: true,
        spreadMonthlyAcrossPaychecks: true,
        payFrequency: 'Weekly',
        workerState: 'TX',
      },
    );

    closeToCents(pages[0].gross, weeklyGross);
    closeToCents(pages[0].ytdGross, 20000 + weeklyGross);
  });
});
