import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

const modulePath = '../src/utils/payStubPdf.js';

function assertAlmostEqual(actual, expected) {
  assert.ok(
    Math.abs(actual - expected) < 1e-9,
    `expected ${actual} to be within rounding tolerance of ${expected}`,
  );
}

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

  it('does not use discrete weekly YTD counting when weekly dates are misaligned', async () => {
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

    const phantomPriorMonths = 2 * (1000 * (52 / 12));
    assertAlmostEqual(pages[0].ytdGross, phantomPriorMonths + 1000);
    assertAlmostEqual(pages[1].ytdGross, phantomPriorMonths + 2000);
    assert.notEqual(pages[0].ytdGross, 10_000);
  });
});
