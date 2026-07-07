import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  buildPreparedPaystubPages,
  countWeeklyPayChecksThroughInclusive,
  paycheckGrossFromEntry,
  weeklyChecksSharePayWeekDay,
} from '../src/utils/payStubPdf.js';

describe('pay-stub pay frequency calculations', () => {
  it('converts a monthly gross entry to exactly one weekly paycheck amount', () => {
    const weeklyGross = paycheckGrossFromEntry(10000, 'Weekly', true);

    assert.equal(Math.round(weeklyGross * 100) / 100, 2307.69);
    assert.equal(paycheckGrossFromEntry(10000, 'Monthly', true), 10000);
    assert.equal(paycheckGrossFromEntry(10000, 'Weekly', false), 10000);
  });

  it('prepares weekly stubs from monthly entries without applying the split twice', () => {
    const [page] = buildPreparedPaystubPages(
      [
        {
          periodEnd: '2026-02-06',
          gross: 10000,
        },
      ],
      true,
      {},
      {
        payFrequency: 'Weekly',
        spreadMonthlyAcrossPaychecks: true,
        calendarYtdBackfill: false,
      },
    );

    assert.equal(Math.round(page.gross * 100) / 100, 2307.69);
    assert.equal(Math.round(page.ytdGross * 100) / 100, 2307.69);
  });
});

describe('weekly 1099 calendar YTD backfill', () => {
  it('counts actual same-weekday check dates through each contractor weekly stub', () => {
    const pages = buildPreparedPaystubPages(
      [
        { periodEnd: '2026-02-06', gross: 1000 },
        { periodEnd: '2026-02-27', gross: 1000 },
      ],
      true,
      {},
      {
        payFrequency: 'Weekly',
        calendarYtdBackfill: true,
        spreadMonthlyAcrossPaychecks: false,
      },
    );

    assert.equal(countWeeklyPayChecksThroughInclusive('2026-02-06', 5), 6);
    assert.equal(countWeeklyPayChecksThroughInclusive('2026-02-27', 5), 9);
    assert.equal(pages[0].ytdGross, 6000);
    assert.equal(pages[1].ytdGross, 9000);
    assert.equal(pages[0].netYtd, 6000);
    assert.equal(pages[1].netYtd, 9000);
  });

  it('only enables discrete weekly counting when all exported checks share a weekday', () => {
    assert.deepEqual(weeklyChecksSharePayWeekDay(['2026-02-06', '2026-02-27']), {
      ok: true,
      payWeekDay: 5,
    });

    assert.deepEqual(weeklyChecksSharePayWeekDay(['2026-02-06', '2026-02-28']), {
      ok: false,
      payWeekDay: undefined,
    });
  });
});
