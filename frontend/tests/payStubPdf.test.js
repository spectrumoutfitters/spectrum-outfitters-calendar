import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

const modulePath = '../src/utils/payStubPdf.js';

describe('pay stub PDF calculation utilities', () => {
  it('counts weekly checks through the inclusive period end date', async () => {
    const { countWeeklyPayChecksThroughInclusive } = await import(modulePath);

    assert.equal(countWeeklyPayChecksThroughInclusive('2026-03-06', 5), 10);
    assert.equal(countWeeklyPayChecksThroughInclusive('2026-03-05', 5), 9);
    assert.equal(countWeeklyPayChecksThroughInclusive('2026-03-06', 7), 0);
  });

  it('requires weekly contractor checks to share one weekday before calendar YTD backfill', async () => {
    const { weeklyChecksSharePayWeekDay } = await import(modulePath);

    assert.deepEqual(weeklyChecksSharePayWeekDay(['2026-02-06', '2026-02-13']), {
      ok: true,
      payWeekDay: 5,
    });
    assert.deepEqual(weeklyChecksSharePayWeekDay(['2026-02-06', '2026-02-12']), {
      ok: false,
      payWeekDay: undefined,
    });
  });

  it('spreads monthly gross across weekly paychecks exactly once', async () => {
    const { buildPreparedPaystubPages, paycheckGrossFromEntry } = await import(modulePath);

    const enteredMonthlyGross = 120_000;
    const weeklyGross = paycheckGrossFromEntry(enteredMonthlyGross, 'Weekly', true);
    assert.equal(weeklyGross, (enteredMonthlyGross * 12) / 52);

    const pages = buildPreparedPaystubPages(
      [{ periodEnd: '2026-03-06', gross: enteredMonthlyGross }],
      true,
      {},
      {
        calendarYtdBackfill: true,
        payFrequency: 'Weekly',
        spreadMonthlyAcrossPaychecks: true,
      },
    );

    assert.equal(pages.length, 1);
    assert.equal(pages[0].gross, weeklyGross);
    assert.equal(pages[0].ytdGross, 276923.08);
  });

  it('falls back to listed contractor stubs when weekly dates are misaligned', async () => {
    const { buildPreparedPaystubPages } = await import(modulePath);

    const pages = buildPreparedPaystubPages(
      [
        { periodEnd: '2026-03-06', gross: 1000 },
        { periodEnd: '2026-03-12', gross: 1000 },
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
