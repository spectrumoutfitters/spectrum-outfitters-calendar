import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  buildPreparedPaystubPages,
  estimatePriorSocSecWagesBeforeFirstStub,
} from './payStubPdf.js';
import {
  computeW2Deductions,
  SOC_SEC_RATE,
  SOC_SEC_WAGE_BASE_2025,
} from './payrollTaxUS.js';

describe('pay stub YTD calculations', () => {
  it('seeds W-2 Social Security with phantom calendar YTD wages before the first stub', () => {
    const rows = [{ periodEnd: '2026-06-30', gross: 40000 }];
    const ytdOpts = {
      calendarYtdBackfill: true,
      payFrequency: 'Monthly',
      filingStatus: 'single',
      workerState: 'TX',
      priorSsTaxableWages: 0,
    };

    const priorSocSecWages = estimatePriorSocSecWagesBeforeFirstStub(rows, false, ytdOpts);
    assert.equal(priorSocSecWages, SOC_SEC_WAGE_BASE_2025);

    const deductions = computeW2Deductions({
      gross: 40000,
      payFrequency: 'Monthly',
      filingStatus: 'single',
      workStateCode: 'TX',
      priorYtdSocSecWages: priorSocSecWages,
    });
    assert.equal(deductions.socialSecurity, 0);

    const pages = buildPreparedPaystubPages(
      [{ ...rows[0], socialSecurity: deductions.socialSecurity }],
      false,
      {},
      ytdOpts,
    );

    assert.equal(pages[0].ssAmt, 0);
    assert.ok(
      pages[0].ytdSs <= SOC_SEC_WAGE_BASE_2025 * SOC_SEC_RATE,
      `expected YTD SS to stay capped, got ${pages[0].ytdSs}`,
    );
  });

  it('uses actual listed gross values for variable weekly 1099 YTD totals', () => {
    const pages = buildPreparedPaystubPages(
      [
        { periodEnd: '2026-01-02', gross: 1000 },
        { periodEnd: '2026-01-09', gross: 2000 },
        { periodEnd: '2026-01-16', gross: 3000 },
      ],
      true,
      {},
      {
        calendarYtdBackfill: true,
        payFrequency: 'Weekly',
      },
    );

    assert.equal(pages[2].ytdGross, 6000);
    assert.equal(pages[2].netYtd, 6000);
  });
});
