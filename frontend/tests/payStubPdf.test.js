import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('pay stub PDF preparation helpers', () => {
  it('converts a monthly gross entry into one weekly paycheck only when requested', async () => {
    const { paycheckGrossFromEntry } = await import('../src/utils/payStubPdf.js');

    assert.equal(paycheckGrossFromEntry(10000, 'Monthly', true), 10000);
    assert.equal(paycheckGrossFromEntry(10000, 'Weekly', false), 10000);
    assert.equal(paycheckGrossFromEntry(10000, 'Weekly', true), (10000 * 12) / 52);
    assert.equal(paycheckGrossFromEntry(10000, 'Bi-weekly', true), (10000 * 12) / 26);
  });

  it('counts actual weekly check dates through the inclusive period end date', async () => {
    const { countWeeklyPayChecksThroughInclusive } = await import('../src/utils/payStubPdf.js');

    // 2026 starts on Thursday; Fridays through Feb 6 are Jan 2, 9, 16, 23, 30, and Feb 6.
    assert.equal(countWeeklyPayChecksThroughInclusive('2026-02-06', 5), 6);
    assert.equal(countWeeklyPayChecksThroughInclusive('2026-01-01', 5), 0);
    assert.equal(countWeeklyPayChecksThroughInclusive('2026-01-02', 5), 1);
  });

  it('detects whether exported weekly paychecks share a weekday', async () => {
    const { weeklyChecksSharePayWeekDay } = await import('../src/utils/payStubPdf.js');

    assert.deepEqual(weeklyChecksSharePayWeekDay(['2026-02-06', '2026-01-23']), {
      ok: true,
      payWeekDay: 5,
    });
    assert.deepEqual(weeklyChecksSharePayWeekDay(['2026-02-06', '2026-02-12']), {
      ok: false,
      payWeekDay: undefined,
    });
  });

  it('uses discrete weekly check counts for 1099 calendar YTD backfill', async () => {
    const { buildPreparedPaystubPages } = await import('../src/utils/payStubPdf.js');

    const prepared = buildPreparedPaystubPages(
      [
        { periodEnd: '2026-02-06', gross: 1000 },
        { periodEnd: '2026-02-13', gross: 1000 },
      ],
      true,
      {},
      {
        calendarYtdBackfill: true,
        payFrequency: 'Weekly',
      },
    );

    assert.deepEqual(
      prepared.map((stub) => stub.ytdGross),
      [6000, 7000],
    );
    assert.deepEqual(
      prepared.map((stub) => stub.netYtd),
      [6000, 7000],
    );
  });

  it('sorts cumulative YTD calculations by pay date while returning the input order', async () => {
    const { buildPreparedPaystubPages } = await import('../src/utils/payStubPdf.js');

    const prepared = buildPreparedPaystubPages(
      [
        { periodEnd: '2026-03-31', gross: 3000, federal: 300 },
        { periodEnd: '2026-01-31', gross: 1000, federal: 100 },
        { periodEnd: '2026-02-28', gross: 2000, federal: 200 },
      ],
      false,
      {},
      {
        calendarYtdBackfill: false,
        payFrequency: 'Monthly',
      },
    );

    assert.deepEqual(
      prepared.map((stub) => stub.m.periodEnd),
      ['2026-03-31', '2026-01-31', '2026-02-28'],
    );
    assert.deepEqual(
      prepared.map((stub) => stub.ytdGross),
      [6000, 1000, 3000],
    );
    assert.deepEqual(
      prepared.map((stub) => stub.ytdFed),
      [600, 100, 300],
    );
  });
});
