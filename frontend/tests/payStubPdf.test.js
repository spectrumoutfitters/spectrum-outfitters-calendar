import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  buildPreparedPaystubPages,
  computePeriodLabel,
  countWeeklyPayChecksThroughInclusive,
  paycheckGrossFromEntry,
  weeklyChecksSharePayWeekDay,
} from '../src/utils/payStubPdf.js';

const closeToCents = (actual, expected) => {
  assert.ok(
    Math.abs(actual - expected) < 0.005,
    `expected ${actual} to be within a cent of ${expected}`,
  );
};

describe('pay-stub PDF preparation', () => {
  it('counts weekly 1099 calendar YTD by actual pay dates instead of month interpolation', () => {
    assert.equal(countWeeklyPayChecksThroughInclusive('2025-01-03', 5), 1);
    assert.equal(countWeeklyPayChecksThroughInclusive('2025-01-31', 5), 5);
    assert.equal(countWeeklyPayChecksThroughInclusive('2025-03-07', 5), 10);

    const pages = buildPreparedPaystubPages(
      [
        { periodEnd: '2025-03-07', gross: 1000 },
        { periodEnd: '2025-01-31', gross: 1000 },
      ],
      true,
      {},
      {
        calendarYtdBackfill: true,
        payFrequency: 'Weekly',
      },
    );

    const march = pages.find((p) => p.m.periodEnd === '2025-03-07');
    const january = pages.find((p) => p.m.periodEnd === '2025-01-31');

    assert.equal(january.ytdGross, 5000);
    assert.equal(january.netYtd, 5000);
    assert.equal(march.ytdGross, 10000);
    assert.equal(march.netYtd, 10000);
    assert.equal(march.totalDedYtd, 0);
  });

  it('falls back to entered check totals when weekly 1099 dates are not aligned', () => {
    const pages = buildPreparedPaystubPages(
      [
        { periodEnd: '2025-01-31', gross: 1000 },
        { periodEnd: '2025-02-05', gross: 1000 },
      ],
      true,
      {},
      {
        calendarYtdBackfill: true,
        payFrequency: 'Weekly',
      },
    );

    assert.deepEqual(weeklyChecksSharePayWeekDay(['2025-01-31', '2025-02-05']), {
      ok: false,
      payWeekDay: undefined,
    });
    assert.equal(pages[0].ytdGross, 1000);
    assert.equal(pages[1].ytdGross, 2000);
  });

  it('splits monthly gross across weekly checks exactly once', () => {
    const weeklyGross = paycheckGrossFromEntry(10000, 'Weekly', true);
    closeToCents(weeklyGross, 2307.6923076923076);

    const pages = buildPreparedPaystubPages(
      [
        { periodEnd: '2025-01-03', gross: 10000 },
        { periodEnd: '2025-01-10', gross: 10000 },
      ],
      false,
      {},
      {
        payFrequency: 'Weekly',
        spreadMonthlyAcrossPaychecks: true,
      },
    );

    closeToCents(pages[0].gross, weeklyGross);
    closeToCents(pages[0].ytdGross, weeklyGross);
    closeToCents(pages[1].gross, weeklyGross);
    closeToCents(pages[1].ytdGross, weeklyGross * 2);
  });

  it('labels inclusive period bounds for common pay frequencies', () => {
    const end = new Date(2025, 2, 7);

    assert.equal(computePeriodLabel(end, 'Weekly'), 'Mar 1, 2025 – Mar 7, 2025');
    assert.equal(computePeriodLabel(end, 'Bi-weekly'), 'Feb 22, 2025 – Mar 7, 2025');
    assert.equal(computePeriodLabel(new Date(2025, 2, 20), 'Semi-monthly'), 'Mar 16, 2025 – Mar 20, 2025');
    assert.equal(computePeriodLabel(end, 'Monthly'), 'Mar 1, 2025 – Mar 7, 2025');
  });
});
