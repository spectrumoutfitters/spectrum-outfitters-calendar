import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  averageProjectedField,
  filterDailyRevenueByYear,
  formatFinanceDollars,
  revenueYearKeys,
  sumBusinessExpenseAbs,
  sumDailyRevenue,
} from '../src/utils/financeDashboardMath.js';

describe('formatFinanceDollars', () => {
  it('Number(v) || 0 then en-US currency — missing / non-numeric → $0.00, not em-dash', () => {
    assert.equal(formatFinanceDollars(1234.5), '$1,234.50');
    assert.equal(formatFinanceDollars('99.1'), '$99.10');
    assert.equal(formatFinanceDollars(0), '$0.00');
    assert.equal(formatFinanceDollars('0'), '$0.00');
    assert.equal(formatFinanceDollars(null), '$0.00');
    assert.equal(formatFinanceDollars(undefined), '$0.00');
    assert.equal(formatFinanceDollars(''), '$0.00');
    assert.equal(formatFinanceDollars('abc'), '$0.00');
    assert.equal(formatFinanceDollars(false), '$0.00');
  });

  it('keeps negatives and treats truthy true as $1.00', () => {
    assert.equal(formatFinanceDollars(-5), '-$5.00');
    assert.equal(formatFinanceDollars(true), '$1.00');
  });
});

describe('revenueYearKeys / filterDailyRevenueByYear / sumDailyRevenue', () => {
  const daily = [
    { date: '2024-01-02', revenue: '10' },
    { date: '2026-06-01', revenue: '20.5' },
    { date: '2026-07-01', revenue: 0 },
    { date: '2025-12-31', revenue: 'abc' },
  ];

  it('unique YYYY prefixes, newest first', () => {
    assert.deepEqual(revenueYearKeys(daily), ['2026', '2025', '2024']);
  });

  it('falsy year returns all rows; truthy year uses startsWith', () => {
    assert.equal(filterDailyRevenueByYear(daily, '').length, 4);
    assert.equal(filterDailyRevenueByYear(daily, null).length, 4);
    assert.deepEqual(
      filterDailyRevenueByYear(daily, '2026').map((d) => d.date),
      ['2026-06-01', '2026-07-01'],
    );
  });

  it('parseFloat(revenue) || 0 — 0 kept as 0, non-numeric → 0', () => {
    assert.equal(sumDailyRevenue(daily), 30.5);
    assert.equal(sumDailyRevenue([{ revenue: '' }, { revenue: null }]), 0);
  });
});

describe('sumBusinessExpenseAbs', () => {
  it('truthy is_business_expense including string "0"; exact 0 / false excluded', () => {
    const txns = [
      { is_business_expense: 1, amount: -40 },
      { is_business_expense: true, amount: 10 },
      { is_business_expense: '1', amount: 5 },
      { is_business_expense: '0', amount: 7 },
      { is_business_expense: 0, amount: 100 },
      { is_business_expense: false, amount: 50 },
      { is_business_expense: '', amount: 3 },
      { is_business_expense: null, amount: 9 },
    ];
    // 40 + 10 + 5 + 7 (string '0' is truthy)
    assert.equal(sumBusinessExpenseAbs(txns), 62);
  });
});

describe('averageProjectedField', () => {
  it('sum / length with no || 0 on fields; empty → NaN', () => {
    const weeks = [
      { projected_revenue: 10, projected_net: -2 },
      { projected_revenue: 20, projected_net: 4 },
    ];
    assert.equal(averageProjectedField(weeks, 'projected_revenue'), 15);
    assert.equal(averageProjectedField(weeks, 'projected_net'), 1);
    assert.ok(Number.isNaN(averageProjectedField([], 'projected_revenue')));
  });
});
