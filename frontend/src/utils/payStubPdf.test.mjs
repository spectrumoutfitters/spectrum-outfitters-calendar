import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildPreparedPaystubPages,
  computeCalendarBackfillPriorSsTaxableWages,
} from './payStubPdf.js';
import { computeW2Deductions } from './payrollTaxUS.js';

test('1099 weekly calendar YTD preserves variable listed check gross amounts', () => {
  const pages = buildPreparedPaystubPages(
    [
      { periodEnd: '2026-01-09', gross: 1000 },
      { periodEnd: '2026-01-16', gross: 2000 },
      { periodEnd: '2026-01-23', gross: 3000 },
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
    pages.map((page) => page.ytdGross),
    [
      2000, // Jan 2 inferred from earliest listed gross + Jan 9 actual gross.
      4000, // Prior total + Jan 16 actual gross.
      7000, // Prior total + Jan 23 actual gross.
    ],
  );
});

test('1099 weekly calendar YTD with only a tax year does not add phantom month gross', () => {
  const pages = buildPreparedPaystubPages(
    [
      { periodEnd: '2026-03-31', gross: 1000 },
      { periodEnd: '2026-04-30', gross: 1000 },
    ],
    true,
    { taxYear: 2026 },
    {
      calendarYtdBackfill: true,
      payFrequency: 'Weekly',
      spreadMonthlyAcrossPaychecks: false,
    },
  );

  assert.deepEqual(
    pages.map((page) => page.ytdGross),
    [1000, 2000],
  );
});

test('W-2 calendar backfill seeds current Social Security wage-base consumption', () => {
  const priorSsSeed = computeCalendarBackfillPriorSsTaxableWages(
    [{ periodEnd: '2026-04-30', gross: 100000 }],
    {
      calendarYtdBackfill: true,
      payFrequency: 'Monthly',
      filingStatus: 'single',
      workerState: 'TX',
      priorSsTaxableWages: 0,
      spreadMonthlyAcrossPaychecks: false,
    },
  );

  assert.equal(priorSsSeed, 176100);

  const april = computeW2Deductions({
    gross: 100000,
    payFrequency: 'Monthly',
    filingStatus: 'single',
    workStateCode: 'TX',
    priorYtdSocSecWages: priorSsSeed,
  });

  assert.equal(april.socialSecurity, 0);
  assert.equal(april.oasdiWagesNow, 0);
});
