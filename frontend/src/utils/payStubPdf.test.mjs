import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { buildPreparedPaystubPages } from './payStubPdf.js';

describe('buildPreparedPaystubPages YTD backfill', () => {
  it('uses manual prior YTD instead of also adding inferred calendar backfill', () => {
    const pages = buildPreparedPaystubPages(
      [
        {
          periodEnd: '2026-03-31',
          gross: 5000,
          federal: 100,
          socialSecurity: 0,
          medicare: 0,
          medicareBase: 0,
          medicareAdditional: 0,
          state: 0,
        },
      ],
      false,
      {
        taxYear: 2026,
        gross: 15000,
        federal: 1200,
      },
      {
        calendarYtdBackfill: true,
        payFrequency: 'Monthly',
        filingStatus: 'single',
        workerState: 'TX',
      },
    );

    assert.equal(pages[0].ytdGross, 20000);
    assert.equal(pages[0].ytdFed, 1300);
  });

  it('preserves variable listed 1099 weekly gross while inferring only missing checks', () => {
    const pages = buildPreparedPaystubPages(
      [
        { periodEnd: '2026-01-02', gross: 1000 },
        { periodEnd: '2026-01-09', gross: 5000 },
        { periodEnd: '2026-01-16', gross: 3000 },
      ],
      true,
      {},
      {
        calendarYtdBackfill: true,
        payFrequency: 'Weekly',
        spreadMonthlyAcrossPaychecks: false,
      },
    );

    assert.deepEqual(
      pages.map((p) => p.ytdGross),
      [1000, 6000, 9000],
    );
  });
});
