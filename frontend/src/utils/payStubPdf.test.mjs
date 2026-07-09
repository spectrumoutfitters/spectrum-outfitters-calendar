import assert from 'node:assert/strict';
import test from 'node:test';

import { buildPreparedPaystubPages } from './payStubPdf.js';

test('weekly 1099 calendar YTD preserves varying exported check gross amounts', () => {
  const pages = buildPreparedPaystubPages(
    [
      { periodEnd: '2026-01-09', gross: 1000 },
      { periodEnd: '2026-01-16', gross: 1200 },
      { periodEnd: '2026-01-23', gross: 1400 },
    ],
    true,
    {},
    {
      calendarYtdBackfill: true,
      monthlyJanBackfill: true,
      payFrequency: 'Weekly',
      spreadMonthlyAcrossPaychecks: false,
    },
  );

  assert.deepEqual(
    pages.map((page) => page.ytdGross),
    [
      2000,
      3200,
      4600,
    ],
  );
});
