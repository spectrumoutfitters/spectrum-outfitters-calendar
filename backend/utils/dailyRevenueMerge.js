/**
 * Weekly P&L revenue merge: one source per calendar day.
 * Precedence: ShopMonkey > payment processor > manual. Never sum two sources for the same day.
 */

/**
 * @param {Record<string, number>} [smByDate]
 * @param {Record<string, number>} [procByDate]
 * @param {Record<string, number | { revenue?: number }>} [manualByDate]
 * @returns {{ daily: Array<{ date: string, revenue: number, source: 'shopmonkey' | 'processor' | 'manual' }>, total: number }}
 */
export function mergeDailyRevenueByPrecedence(smByDate = {}, procByDate = {}, manualByDate = {}) {
  const sm = smByDate || {};
  const proc = procByDate || {};
  const manual = manualByDate || {};
  const allDates = [...new Set([...Object.keys(sm), ...Object.keys(proc), ...Object.keys(manual)])].sort();
  let total = 0;
  const daily = allDates.map((date) => {
    let revenue;
    /** @type {'shopmonkey' | 'processor' | 'manual'} */
    let source;
    if (sm[date] !== undefined) {
      revenue = Number(sm[date]) || 0;
      source = 'shopmonkey';
    } else if (proc[date] !== undefined) {
      revenue = Number(proc[date]) || 0;
      source = 'processor';
    } else {
      const m = manual[date];
      revenue =
        typeof m === 'object' && m !== null ? Number(m.revenue) || 0 : Number(m) || 0;
      source = 'manual';
    }
    total += revenue;
    return { date, revenue, source };
  });
  return { daily, total };
}

/**
 * @param {string} date
 * @param {Record<string, unknown>} [smByDate]
 * @param {Record<string, unknown>} [procByDate]
 * @param {Record<string, unknown>} [manualByDate]
 * @returns {'shopmonkey' | 'processor' | 'manual' | null}
 */
export function resolveDailyRevenueSource(date, smByDate = {}, procByDate = {}, manualByDate = {}) {
  if (smByDate?.[date] !== undefined) return 'shopmonkey';
  if (procByDate?.[date] !== undefined) return 'processor';
  if (manualByDate?.[date] !== undefined) return 'manual';
  return null;
}

/**
 * Split-reimbursable amounts attributed to the current business week.
 * Monthly expected amounts are prorated by 4.33 weeks/month.
 * @param {Array<{ split_reimbursable_amount?: number|string, split_reimbursable_period?: string }>} payrollEntries
 */
export function expectedSplitReimbursementThisWeek(payrollEntries) {
  let expectedReimbursementThisWeek = 0;
  for (const entry of payrollEntries || []) {
    const amt = parseFloat(entry.split_reimbursable_amount) || 0;
    if (amt <= 0) continue;
    const period = entry.split_reimbursable_period || 'weekly';
    expectedReimbursementThisWeek += period === 'monthly' ? amt / 4.33 : amt;
  }
  return expectedReimbursementThisWeek;
}

/**
 * Operating net used by weekly P&L WoW comparison (excludes bank expenses; matches existing route math).
 */
export function pnlOperatingNet(totalRevenue, totalPayroll, totalExpenses) {
  return (Number(totalRevenue) || 0) - (Number(totalPayroll) || 0) - (Number(totalExpenses) || 0);
}

/**
 * Full weekly net including bank-sourced business expenses (matches summary.net_profit_loss).
 */
export function pnlNetIncludingBank(totalRevenue, totalPayroll, totalExpenses, bankExpenseTotal) {
  return (
    (Number(totalRevenue) || 0) -
    (Number(totalPayroll) || 0) -
    (Number(totalExpenses) || 0) -
    (Number(bankExpenseTotal) || 0)
  );
}

/**
 * Week-over-week change percent. Returns 0 when previous net is 0 (matches existing route math).
 */
export function pnlWeekOverWeekChangePercent(currentNet, previousNet) {
  const prev = Number(previousNet) || 0;
  if (prev === 0) return 0;
  return (((Number(currentNet) || 0) - prev) / Math.abs(prev)) * 100;
}
