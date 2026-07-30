/**
 * Pure helpers for weekly split pay-run recording (week-ending Friday + amount pick).
 * Kept free of DB so unit tests do not need sqlite3.
 */

import { addDaysInHouston, getHoustonDayOfWeek } from './appTimezone.js';

export function toNumber(v) {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Most recent Friday on or before dateStr (Houston calendar).
 * Unlike getWeekEndingFridayHouston, never advances forward to a future Friday.
 */
export function previousFridayFrom(dateStr) {
  const d = getHoustonDayOfWeek(dateStr);
  const daysBack = d >= 5 ? (d - 5) : (d + 2);
  return addDaysInHouston(dateStr, -daysBack);
}

/**
 * Amount stored on a split pay-run row: prefer weekly_salary when > 0,
 * otherwise fall back to split_reimbursable_amount (contractor / reimbursable-only).
 */
export function resolveSplitPayRunAmount(row = {}) {
  const salary = toNumber(row.weekly_salary);
  if (salary > 0) return salary;
  return toNumber(row.split_reimbursable_amount);
}
