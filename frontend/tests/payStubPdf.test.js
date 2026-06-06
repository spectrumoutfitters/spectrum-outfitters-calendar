import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  buildPreparedPaystubPages,
  countWeeklyPayChecksThroughInclusive,
  paycheckGrossFromEntry,
} from '../src/utils/payStubPdf.js';

describe('pay stub weekly contractor YTD calculations', () => {
  it('counts actual weekly paycheck dates through the period end date', () => {
    assert.equal(countWeeklyPayChecksThroughInclusive('2026-02-06', 5), 6);
    assert.equal(countWeeklyPayChecksThroughInclusive('2026-02-20', 5), 8);
    assert.equal(countWeeklyPayChecksThroughInclusive('2026-02-20', 8), 0);
  });

  it('uses discrete weekly 1099 paycheck counts instead of monthly phantom gross', () => {
    const pages = buildPreparedPaystubPages(
      [
        { periodEnd: '2026-02-20', gross: 1000 },
        { periodEnd: '2026-02-06', gross: 1000 },
        { periodEnd: '2026-02-13', gross: 1000 },
      ],
      true,
      {},
      { calendarYtdBackfill: true, payFrequency: 'Weekly' },
    );

    assert.deepEqual(
      pages.map((page) => ({ periodEnd: page.m.periodEnd, ytdGross: page.ytdGross, netYtd: page.netYtd })),
      [
        { periodEnd: '2026-02-20', ytdGross: 8000, netYtd: 8000 },
        { periodEnd: '2026-02-06', ytdGross: 6000, netYtd: 6000 },
        { periodEnd: '2026-02-13', ytdGross: 7000, netYtd: 7000 },
      ],
    );
  });

  it('honors explicit prior YTD instead of replacing it with calendar backfill', () => {
    const pages = buildPreparedPaystubPages(
      [
        { periodEnd: '2026-01-09', gross: 1000 },
        { periodEnd: '2026-01-16', gross: 1000 },
      ],
      true,
      { gross: 500 },
      { calendarYtdBackfill: true, payFrequency: 'Weekly' },
    );

    assert.deepEqual(
      pages.map((page) => page.ytdGross),
      [1500, 2500],
    );
  });
});

describe('paycheck gross entry conversion', () => {
  it('splits a monthly gross entry across weekly paychecks only when requested', () => {
    assert.equal(paycheckGrossFromEntry(5200, 'Weekly', true), 1200);
    assert.equal(paycheckGrossFromEntry(5200, 'Weekly', false), 5200);
    assert.equal(paycheckGrossFromEntry(5200, 'Monthly', true), 5200);
  });
});
