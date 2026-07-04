import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  buildPreparedPaystubPages,
  countWeeklyPayChecksThroughInclusive,
  paycheckGrossFromEntry,
  weeklyChecksSharePayWeekDay,
} from '../src/utils/payStubPdf.js';

describe('pay-stub weekly 1099 calendar YTD', () => {
  it('counts real weekly pay dates from Jan 1 through the check date', () => {
    assert.equal(countWeeklyPayChecksThroughInclusive('2025-01-31', 5), 5);
    assert.equal(countWeeklyPayChecksThroughInclusive('2025-02-07', 5), 6);
    assert.equal(countWeeklyPayChecksThroughInclusive('2025-01-06', 2), 0);
    assert.equal(countWeeklyPayChecksThroughInclusive('2025-01-31', 7), 0);
  });

  it('accepts unordered same-weekday checks and rejects mixed weekdays', () => {
    assert.deepEqual(weeklyChecksSharePayWeekDay(['2025-02-21', '2025-02-07']), {
      ok: true,
      payWeekDay: 5,
    });

    assert.deepEqual(weeklyChecksSharePayWeekDay(['2025-02-21', '2025-02-10']), {
      ok: false,
      payWeekDay: undefined,
    });
  });

  it('uses discrete weekly check counts for 1099 gross YTD even when input rows are unsorted', () => {
    const pages = buildPreparedPaystubPages(
      [
        { periodEnd: '2025-02-21', gross: 1000 },
        { periodEnd: '2025-02-07', gross: 1000 },
      ],
      true,
      {},
      {
        calendarYtdBackfill: true,
        payFrequency: 'Weekly',
      },
    );

    assert.equal(pages[0].ytdGross, 8000);
    assert.equal(pages[0].netYtd, 8000);
    assert.equal(pages[1].ytdGross, 6000);
    assert.equal(pages[1].netYtd, 6000);
  });

  it('spreads a monthly contractor amount to one weekly paycheck before YTD counting', () => {
    const weeklyGross = paycheckGrossFromEntry(5200, 'Weekly', true);
    assert.equal(weeklyGross, 1200);

    const [page] = buildPreparedPaystubPages(
      [{ periodEnd: '2025-02-07', gross: 5200 }],
      true,
      {},
      {
        calendarYtdBackfill: true,
        payFrequency: 'Weekly',
        spreadMonthlyAcrossPaychecks: true,
      },
    );

    assert.equal(page.gross, 1200);
    assert.equal(page.ytdGross, 7200);
  });
});
