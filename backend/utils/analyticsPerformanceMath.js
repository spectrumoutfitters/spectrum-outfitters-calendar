/**
 * Pure helpers for analytics week windows and efficiency rates.
 * Extracted from routes/analytics.js — keep behavior identical.
 */

/**
 * Default employee-performance / employee-detail window: Monday 00:00 through Sunday 23:59:59.999
 * of the *current* local week. Sunday (`getDay()===0`) uses `getDate()-6`.
 * Date strings come from `toISOString()`, so callers should run under a known TZ (tests use UTC).
 */
export function getDefaultAnalyticsWeekRange(now = new Date()) {
  const today = new Date(now.getTime());
  const dayOfWeek = today.getDay();
  const diff = today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
  const monday = new Date(today.setDate(diff));
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  return {
    startDate: monday.toISOString().split('T')[0],
    endDate: sunday.toISOString().split('T')[0],
  };
}

/**
 * Weekly-comparison window for offset `weekIndex` (0 = most recent).
 * Uses `getDate() - (getDay() + 6 + weekIndex*7)`, which lands on the *previous*
 * week's Monday rather than the current week's Monday.
 */
export function getWeeklyComparisonWeekRange(now, weekIndex) {
  const today = new Date(now.getTime());
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - (today.getDay() + 6 + weekIndex * 7));
  weekStart.setHours(0, 0, 0, 0);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);
  return {
    startDate: weekStart.toISOString().split('T')[0],
    endDate: weekEnd.toISOString().split('T')[0],
  };
}

/** `parseInt(weeks) || 4` — 0 / NaN / '' become 4; negatives are kept. */
export function coerceAnalyticsWeekCount(weeks) {
  return parseInt(weeks) || 4;
}

export function formatTasksPerHour(tasksCompleted, hoursWorked) {
  return hoursWorked > 0 ? (tasksCompleted / hoursWorked).toFixed(2) : '0.00';
}

export function formatCompletionRate(completed, assigned) {
  return assigned > 0 ? ((completed / assigned) * 100).toFixed(1) : '0.0';
}

export function formatTaskHoursRatio(taskHours, hoursWorked) {
  return hoursWorked > 0 ? ((taskHours / hoursWorked) * 100).toFixed(1) : '0.0';
}

/** Empty subtask lists report 100% (same as the in-route ternary). */
export function formatSubtaskCompletionRate(completed, total) {
  return total > 0 ? ((completed / total) * 100).toFixed(1) : '100.0';
}

export function weekComparisonLabel(numWeeks, weekIndex, startDate, endDate) {
  return `Week ${numWeeks - weekIndex} (${startDate} to ${endDate})`;
}
