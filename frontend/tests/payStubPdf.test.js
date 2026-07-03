import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  buildPreparedPaystubPages,
  countWeeklyPayChecksThroughInclusive,
  paycheckGrossFromEntry,
  weeklyChecksSharePayWeekDay,
} from '../src/utils/payStubPdf.js';

function contractorStub(periodEnd, gross = 1000) {
  return {
    periodEnd,
    gross,
  };
}

describe('pay stub weekly 1099 calendar YTD', () => {
  it('counts actual weekly check dates through the period end', () => {
    assert.equal(countWeeklyPayChecksThroughInclusive('2026-01-01', 5), 0);
    assert.equal(countWeeklyPayChecksThroughInclusive('2026-01-02', 5), 1);
    assert.equal(countWeeklyPayChecksThroughInclusive('2026-02-06', 5), 6);
  });

  it('detects whether exported weekly checks share the same weekday regardless of input order', () => {
    assert.deepEqual(weeklyChecksSharePayWeekDay(['2026-01-23', '2026-01-02']), {
      ok: true,
      payWeekDay: 5,
    });

    assert.deepEqual(weeklyChecksSharePayWeekDay(['2026-01-02', '2026-01-08']), {
      ok: false,
      payWeekDay: undefined,
    });
  });

  it('fills skipped 1099 weekly checks with discrete calendar YTD instead of monthly phantom gross', () => {
    const pages = buildPreparedPaystubPages(
      [
        contractorStub('2026-02-06'),
        contractorStub('2026-01-02'),
        contractorStub('2026-01-23'),
      ],
      true,
      {},
      {
        calendarYtdBackfill: true,
        payFrequency: 'Weekly',
      },
    );

    const byDate = new Map(pages.map((page) => [page.m.periodEnd, page]));

    assert.equal(byDate.get('2026-01-02').ytdGross, 1000);
    assert.equal(byDate.get('2026-01-23').ytdGross, 4000);
    assert.equal(byDate.get('2026-02-06').ytdGross, 6000);
  });

  it('falls back to exported rows when weekly 1099 check dates are not aligned', () => {
    const pages = buildPreparedPaystubPages(
      [contractorStub('2026-01-02'), contractorStub('2026-01-08')],
      true,
      {},
      {
        calendarYtdBackfill: true,
        payFrequency: 'Weekly',
      },
    );

    assert.equal(pages[1].ytdGross, 2000);
  });
});

describe('paycheckGrossFromEntry', () => {
  it('spreads a monthly gross entry across weekly paychecks only when requested', () => {
    assert.equal(paycheckGrossFromEntry(12000, 'Weekly', false), 12000);
    assert.equal(paycheckGrossFromEntry(12000, 'Monthly', true), 12000);
    assert.equal(paycheckGrossFromEntry(12000, 'Weekly', true), 2769.230769230769);
  });
});
