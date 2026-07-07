import assert from 'node:assert/strict';
import test from 'node:test';

import {
  calendarBackfillPriorSsTaxableWages,
  shouldBlockWeeklyCalendarYtdExport,
} from './payStubPdf.js';
import { computeW2Deductions, SOC_SEC_WAGE_BASE_2025 } from './payrollTaxUS.js';

const emptyPriorYtdFields = {
  gross: '',
  federal: '',
  socialSecurity: '',
  medicareBase: '',
  medicareAdditional: '',
  state: '',
  other: '',
};

test('weekly calendar YTD blocks misaligned 1099 dates even when only baseline year is set', () => {
  assert.equal(
    shouldBlockWeeklyCalendarYtdExport({
      employmentType: '1099',
      payFrequency: 'Weekly',
      calendarYtdBackfill: true,
      priorYtdFields: emptyPriorYtdFields,
      periodEnds: ['2026-04-30', '2026-05-31', '2026-06-30'],
    }),
    true,
  );
});

test('weekly calendar YTD blocks misaligned W-2 dates without manual dollar prior YTD', () => {
  assert.equal(
    shouldBlockWeeklyCalendarYtdExport({
      employmentType: 'w2',
      payFrequency: 'Weekly',
      calendarYtdBackfill: true,
      priorYtdFields: emptyPriorYtdFields,
      periodEnds: ['2026-04-30', '2026-05-31', '2026-06-30'],
    }),
    true,
  );
});

test('weekly calendar YTD allows manual dollar prior YTD to replace automatic weekday counting', () => {
  assert.equal(
    shouldBlockWeeklyCalendarYtdExport({
      employmentType: '1099',
      payFrequency: 'Weekly',
      calendarYtdBackfill: true,
      priorYtdFields: { ...emptyPriorYtdFields, gross: '12000' },
      periodEnds: ['2026-04-30', '2026-05-31', '2026-06-30'],
    }),
    false,
  );
});

test('calendar backfill advances W-2 Social Security wage base before current checks', () => {
  const priorSsWages = calendarBackfillPriorSsTaxableWages(
    [{ periodEnd: '2026-04-03', gross: 50000 }],
    {
      calendarYtdBackfill: true,
      monthlyJanBackfill: true,
      payFrequency: 'Weekly',
      filingStatus: 'single',
      workerState: 'TX',
      priorSsTaxableWages: 0,
    },
  );

  assert.equal(priorSsWages, SOC_SEC_WAGE_BASE_2025);

  const current = computeW2Deductions({
    gross: 50000,
    payFrequency: 'Weekly',
    filingStatus: 'single',
    workStateCode: 'TX',
    priorYtdSocSecWages: priorSsWages,
  });

  assert.equal(current.socialSecurity, 0);
  assert.equal(current.oasdiWagesNow, 0);
});
