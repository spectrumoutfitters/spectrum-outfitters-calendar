/**
 * Calendar-safe compliance due-date calculation.
 * Avoids JS Date month overflow (e.g. Jan 31 + 1 month → Mar 3 before setDate).
 */

function parseYmd(ymd) {
  const [y, m, d] = String(ymd).slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) {
    throw new Error(`Invalid date string: ${ymd}`);
  }
  return { y, m, d };
}

function daysInMonth(year, month1Based) {
  return new Date(Date.UTC(year, month1Based, 0)).getUTCDate();
}

function formatYmd(year, month1Based, day) {
  return `${year}-${String(month1Based).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * Advance a YYYY-MM-DD period end by offsetMonths, then apply dayOfMonth
 * clamped to the target month's length.
 */
export function addMonthsWithDay(periodEndYmd, offsetMonths, dayOfMonth) {
  const { y, m } = parseYmd(periodEndYmd);
  const totalMonths = y * 12 + (m - 1) + Number(offsetMonths || 0);
  const targetYear = Math.floor(totalMonths / 12);
  const targetMonth = (totalMonths % 12) + 1; // 1-based
  const dim = daysInMonth(targetYear, targetMonth);
  const day = Math.min(Math.max(1, Number(dayOfMonth) || 1), dim);
  return formatYmd(targetYear, targetMonth, day);
}

/**
 * @param {object} obligation - row with frequency, due_day, due_rule_json
 * @param {string} periodStart - YYYY-MM-DD (unused for monthly; kept for API parity)
 * @param {string} periodEnd - YYYY-MM-DD
 * @returns {string} due date YYYY-MM-DD
 */
export function calculateComplianceDueDate(obligation, periodStart, periodEnd) {
  const rules = JSON.parse(obligation.due_rule_json || '{}');
  const endDate = new Date(periodEnd);

  if (obligation.frequency === 'monthly') {
    const offsetMonths = rules.offset_months != null ? rules.offset_months : 1;
    const dayOfMonth = rules.day_of_month || obligation.due_day || 15;
    return addMonthsWithDay(periodEnd, offsetMonths, dayOfMonth);
  }

  if (obligation.frequency === 'quarterly') {
    const month = endDate.getUTCMonth() + 1;
    let quarter;
    if (month <= 3) quarter = 'Q1';
    else if (month <= 6) quarter = 'Q2';
    else if (month <= 9) quarter = 'Q3';
    else quarter = 'Q4';

    if (rules.quarters && rules.quarters[quarter]) {
      const dueStr = rules.quarters[quarter].due;
      const year = quarter === 'Q4' ? endDate.getUTCFullYear() + 1 : endDate.getUTCFullYear();
      return `${year}-${dueStr}`;
    }
    // Fallback: last day of the month after quarter end (calendar-safe)
    return addMonthsWithDay(periodEnd, 1, 31);
  }

  if (obligation.frequency === 'annual') {
    const dueYear = endDate.getUTCFullYear() + 1;
    const dueMonth = rules.due_month || 1;
    const dueDay = rules.due_day || obligation.due_day || 31;
    const dim = daysInMonth(dueYear, dueMonth);
    return formatYmd(dueYear, dueMonth, Math.min(dueDay, dim));
  }

  // Default: 30 days after period end (UTC calendar)
  const { y, m, d } = parseYmd(periodEnd);
  const utc = new Date(Date.UTC(y, m - 1, d + 30));
  return formatYmd(utc.getUTCFullYear(), utc.getUTCMonth() + 1, utc.getUTCDate());
}
