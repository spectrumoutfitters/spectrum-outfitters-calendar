import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  buildPreparedPaystubPages,
  countWeeklyPayChecksThroughInclusive,
  paycheckGrossFromEntry,
  weeklyChecksSharePayWeekDay,
} from './payStubPdf.js';

function assertClose(actual, expected, epsilon = 0.005) {
  assert.ok(
    Math.abs(actual - expected) <= epsilon,
    `expected ${actual} to be within ${epsilon} of ${expected}`,
  );
}

describe('pay stub preparation', () => {
  it('counts actual weekly 1099 check dates for calendar YTD backfill', () => {
    const [page] = buildPreparedPaystubPages(
      [{ periodEnd: '2025-03-14', gross: 1000 }],
      true,
      {},
      { calendarYtdBackfill: true, payFrequency: 'Weekly' },
    );

    assert.equal(countWeeklyPayChecksThroughInclusive('2025-03-14', 5), 11);
    assert.equal(page.gross, 1000);
    assert.equal(page.ytdGross, 11000);
    assert.equal(page.netCurr, 1000);
    assert.equal(page.netYtd, 11000);
  });

  it('requires weekly contractor exports to share one pay weekday before discrete YTD is used', () => {
    assert.deepEqual(weeklyChecksSharePayWeekDay(['2025-02-07', '2025-02-14']), {
      ok: true,
      payWeekDay: 5,
    });

    assert.deepEqual(weeklyChecksSharePayWeekDay(['2025-02-07', '2025-02-13']), {
      ok: false,
      payWeekDay: undefined,
    });
  });

  it('applies monthly gross spreading exactly once while preparing weekly stubs', () => {
    const weeklyGross = paycheckGrossFromEntry(12000, 'Weekly', true);
    assertClose(weeklyGross, 2769.230769);

    const [page] = buildPreparedPaystubPages(
      [{ periodEnd: '2025-01-03', gross: 12000 }],
      true,
      {},
      {
        calendarYtdBackfill: false,
        payFrequency: 'Weekly',
        spreadMonthlyAcrossPaychecks: true,
      },
    );

    assertClose(page.gross, weeklyGross);
    assertClose(page.ytdGross, weeklyGross);
    assertClose(page.netYtd, weeklyGross);
  });
});
