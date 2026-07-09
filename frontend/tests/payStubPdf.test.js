import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  buildPreparedPaystubPages,
  countWeeklyPayChecksThroughInclusive,
  paycheckGrossFromEntry,
  weeklyChecksSharePayWeekDay,
} from '../src/utils/payStubPdf.js';

function contractorWeek(periodEnd, gross = 1000) {
  return {
    periodEnd,
    gross,
    federal: 0,
    socialSecurity: 0,
    medicare: 0,
    state: 0,
    otherAmount: 0,
  };
}

describe('pay-stub PDF calculations', () => {
  it('splits monthly gross entries across weekly paychecks when requested', () => {
    assert.equal(paycheckGrossFromEntry(10000, 'Weekly', true), 2307.6923076923076);
    assert.equal(paycheckGrossFromEntry(10000, 'Bi-weekly', true), 4615.384615384615);
    assert.equal(paycheckGrossFromEntry(10000, 'Semi-monthly', true), 5000);
    assert.equal(paycheckGrossFromEntry(10000, 'Monthly', true), 10000);
    assert.equal(paycheckGrossFromEntry(10000, 'Weekly', false), 10000);
  });

  it('counts same-weekday weekly check dates from the first in-year payday through the stub date', () => {
    assert.equal(countWeeklyPayChecksThroughInclusive('2026-01-01', 5), 0);
    assert.equal(countWeeklyPayChecksThroughInclusive('2026-01-02', 5), 1);
    assert.equal(countWeeklyPayChecksThroughInclusive('2026-02-13', 5), 7);
    assert.equal(countWeeklyPayChecksThroughInclusive('2026-02-14', 5), 7);
    assert.equal(countWeeklyPayChecksThroughInclusive('2026-02-13', 8), 0);
  });

  it('uses discrete weekly paycheck counts for 1099 calendar YTD backfill', () => {
    const prepared = buildPreparedPaystubPages(
      [contractorWeek('2026-02-06'), contractorWeek('2026-02-13')],
      true,
      {},
      {
        calendarYtdBackfill: true,
        payFrequency: 'Weekly',
      },
    );

    assert.deepEqual(
      prepared.map((page) => ({
        periodEnd: page.m.periodEnd,
        gross: page.gross,
        ytdGross: page.ytdGross,
        netYtd: page.netYtd,
      })),
      [
        { periodEnd: '2026-02-06', gross: 1000, ytdGross: 6000, netYtd: 6000 },
        { periodEnd: '2026-02-13', gross: 1000, ytdGross: 7000, netYtd: 7000 },
      ],
    );
  });

  it('does not apply discrete weekly 1099 backfill when entered check dates are not aligned', () => {
    assert.deepEqual(
      weeklyChecksSharePayWeekDay(['2026-02-06', '2026-02-13']).ok,
      true,
    );
    assert.deepEqual(
      weeklyChecksSharePayWeekDay(['2026-02-06', '2026-02-12']).ok,
      false,
    );

    const prepared = buildPreparedPaystubPages(
      [contractorWeek('2026-02-06'), contractorWeek('2026-02-12')],
      true,
      {},
      {
        calendarYtdBackfill: true,
        payFrequency: 'Weekly',
      },
    );

    assert.equal(prepared[0].ytdGross, 5333.333333333333);
    assert.equal(prepared[1].ytdGross, 6333.333333333333);
  });

  it('lets explicit prior YTD override automatic weekly 1099 backfill', () => {
    const prepared = buildPreparedPaystubPages(
      [contractorWeek('2026-02-06'), contractorWeek('2026-02-13')],
      true,
      { gross: 2500, taxYear: 2026 },
      {
        calendarYtdBackfill: true,
        payFrequency: 'Weekly',
      },
    );

    assert.deepEqual(
      prepared.map((page) => page.ytdGross),
      [3500, 4500],
    );
  });
});
