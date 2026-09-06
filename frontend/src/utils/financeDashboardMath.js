/**
 * Finance dashboard display coercions.
 * Distinct from #88 invoicePaymentMath `formatCents` (em-dash on non-finite)
 * and #84 pnlWeekMath / dailyRevenueMerge.
 */

/** Number(v) || 0 then en-US currency. null / '' / 'abc' → $0.00 (not an em-dash). */
export function formatFinanceDollars(v) {
  const n = Number(v) || 0;
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

/** Unique YYYY prefixes from `date.slice(0, 4)`, newest first. */
export function revenueYearKeys(daily) {
  return [...new Set(daily.map((d) => d.date.slice(0, 4)))].sort().reverse();
}

/** Truthy year → startsWith filter; falsy year ('' / null) returns all rows. */
export function filterDailyRevenueByYear(daily, filterYear) {
  return filterYear ? daily.filter((d) => d.date.startsWith(filterYear)) : daily;
}

/** parseFloat(revenue) || 0 — 'abc' / '' / null → 0; does not skip NaN via isFinite. */
export function sumDailyRevenue(daily) {
  return daily.reduce((s, d) => s + (parseFloat(d.revenue) || 0), 0);
}

/**
 * Truthy `is_business_expense` (1 / true / '1' / '0') plus Math.abs(amount).
 * Exact 0 / false / '' / null are excluded.
 */
export function sumBusinessExpenseAbs(transactions) {
  return transactions
    .filter((t) => t.is_business_expense)
    .reduce((s, t) => s + Math.abs(t.amount), 0);
}

/** Sum of field / length. Empty weeks → NaN (UI guards length > 0). No || 0 on fields. */
export function averageProjectedField(weeks, field) {
  return weeks.reduce((s, w) => s + w[field], 0) / weeks.length;
}
