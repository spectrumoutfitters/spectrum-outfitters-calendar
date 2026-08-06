/**
 * Pure compliance period label / generation / P&L missing-day helpers.
 */

import { addDaysInHouston, getTodayInHouston } from './appTimezone.js';

/**
 * Human-readable label for a compliance period.
 * @param {{ frequency?: string }} obligation
 * @param {string} periodStart YYYY-MM-DD
 * @param {string} periodEnd YYYY-MM-DD
 */
export function getPeriodLabel(obligation, periodStart, periodEnd) {
  const start = new Date(periodStart);
  const end = new Date(periodEnd);

  if (obligation.frequency === 'monthly') {
    return start.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }
  if (obligation.frequency === 'quarterly') {
    const month = end.getMonth() + 1;
    let quarter;
    if (month <= 3) quarter = 'Q1';
    else if (month <= 6) quarter = 'Q2';
    else if (month <= 9) quarter = 'Q3';
    else quarter = 'Q4';
    return `${quarter} ${end.getFullYear()}`;
  }
  if (obligation.frequency === 'annual') {
    return `${end.getFullYear()}`;
  }
  return `${periodStart} - ${periodEnd}`;
}

/**
 * Current / previous (/ next for monthly) periods to materialize as instances.
 * @param {{ frequency?: string }} obligation
 * @param {string} [todayYmd] YYYY-MM-DD (defaults to Houston today)
 */
export function getPeriodsToGenerate(obligation, todayYmd = getTodayInHouston()) {
  const today = new Date(todayYmd);
  const periods = [];

  if (obligation.frequency === 'monthly') {
    const currentStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const currentEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    periods.push({
      start: currentStart.toISOString().split('T')[0],
      end: currentEnd.toISOString().split('T')[0]
    });

    const prevStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const prevEnd = new Date(today.getFullYear(), today.getMonth(), 0);
    periods.push({
      start: prevStart.toISOString().split('T')[0],
      end: prevEnd.toISOString().split('T')[0]
    });

    const nextStart = new Date(today.getFullYear(), today.getMonth() + 1, 1);
    const nextEnd = new Date(today.getFullYear(), today.getMonth() + 2, 0);
    periods.push({
      start: nextStart.toISOString().split('T')[0],
      end: nextEnd.toISOString().split('T')[0]
    });
  } else if (obligation.frequency === 'quarterly') {
    const currentQuarter = Math.floor(today.getMonth() / 3);

    const currentStart = new Date(today.getFullYear(), currentQuarter * 3, 1);
    const currentEnd = new Date(today.getFullYear(), (currentQuarter + 1) * 3, 0);
    periods.push({
      start: currentStart.toISOString().split('T')[0],
      end: currentEnd.toISOString().split('T')[0]
    });

    const prevQuarter = currentQuarter === 0 ? 3 : currentQuarter - 1;
    const prevYear = currentQuarter === 0 ? today.getFullYear() - 1 : today.getFullYear();
    const prevStart = new Date(prevYear, prevQuarter * 3, 1);
    const prevEnd = new Date(prevYear, (prevQuarter + 1) * 3, 0);
    periods.push({
      start: prevStart.toISOString().split('T')[0],
      end: prevEnd.toISOString().split('T')[0]
    });
  } else if (obligation.frequency === 'annual') {
    const currentStart = new Date(today.getFullYear(), 0, 1);
    const currentEnd = new Date(today.getFullYear(), 11, 31);
    periods.push({
      start: currentStart.toISOString().split('T')[0],
      end: currentEnd.toISOString().split('T')[0]
    });

    const prevStart = new Date(today.getFullYear() - 1, 0, 1);
    const prevEnd = new Date(today.getFullYear() - 1, 11, 31);
    periods.push({
      start: prevStart.toISOString().split('T')[0],
      end: prevEnd.toISOString().split('T')[0]
    });
  }

  return periods;
}

/**
 * Find YYYY-MM-DD dates in [weekStart, weekEnd] missing from existingDates.
 */
export function getMissingDays(weekStart, weekEnd, existingDates) {
  const missing = [];
  const set = new Set(existingDates || []);
  let current = weekStart;
  while (current <= weekEnd) {
    if (!set.has(current)) missing.push(current);
    current = addDaysInHouston(current, 1);
  }
  return missing;
}
