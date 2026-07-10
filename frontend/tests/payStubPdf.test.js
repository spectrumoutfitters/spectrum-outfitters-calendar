import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  buildPreparedPaystubPages,
  countWeeklyPayChecksThroughInclusive,
  paycheckGrossFromEntry,
  weeklyChecksSharePayWeekDay,
} from '../src/utils/payStubPdf.js';

describe('pay stub PDF calculations', () => {
  it('spreads monthly installment gross exactly once for non-monthly paychecks', () => {
    assert.equal(paycheckGrossFromEntry(10000, 'Monthly', true), 10000);
    assert.equal(paycheckGrossFromEntry(10000, 'Weekly', false), 10000);
    assert.equal(paycheckGrossFromEntry(10000, 'Weekly', true), (10000 * 12) / 52);

    const [weeklyStub] = buildPreparedPaystubPages(
      [{ periodEnd: '2026-03-06', gross: 10000 }],
      true,
      {},
      {
        payFrequency: 'Weekly',
        spreadMonthlyAcrossPaychecks: true,
        calendarYtdBackfill: false,
      },
    );

    assert.equal(weeklyStub.gross, (10000 * 12) / 52);
    assert.equal(weeklyStub.ytdGross, weeklyStub.gross);
  });

  it('uses discrete same-weekday weekly check dates for 1099 calendar YTD backfill', () => {
    const checkDates = ['2026-03-06', '2026-03-13', '2026-03-20'];
    const alignment = weeklyChecksSharePayWeekDay(checkDates);

    assert.deepEqual(alignment, { ok: true, payWeekDay: 5 });
    assert.equal(countWeeklyPayChecksThroughInclusive('2026-03-06', alignment.payWeekDay), 10);
    assert.equal(countWeeklyPayChecksThroughInclusive('2026-03-20', alignment.payWeekDay), 12);

    const pages = buildPreparedPaystubPages(
      checkDates.map((periodEnd) => ({ periodEnd, gross: 1000 })),
      true,
      {},
      {
        payFrequency: 'Weekly',
        calendarYtdBackfill: true,
      },
    );

    assert.equal(pages[0].gross, 1000);
    assert.equal(pages[0].ytdGross, 10000);
    assert.equal(pages[1].ytdGross, 11000);
    assert.equal(pages[2].ytdGross, 12000);
  });

  it('suppresses automatic calendar YTD backfill across multiple tax years', () => {
    const pages = buildPreparedPaystubPages(
      [
        { periodEnd: '2025-12-26', gross: 1000 },
        { periodEnd: '2026-01-02', gross: 1000 },
      ],
      true,
      {},
      {
        payFrequency: 'Weekly',
        calendarYtdBackfill: true,
      },
    );

    assert.equal(pages[0].ytdGross, 1000);
    assert.equal(pages[1].ytdGross, 1000);
  });
});
