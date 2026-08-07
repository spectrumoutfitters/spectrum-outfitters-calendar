/**
 * America/Chicago calendar parts used by admin worklist recurrence
 * (weekly day_of_week / monthly day_of_month template matching).
 */

const HOUSTON_TZ = 'America/Chicago';
const WEEKDAY_TO_NUM = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

/** @param {Date} [date] */
export function getHoustonDayOfWeek(date = new Date()) {
  const dayStr = new Intl.DateTimeFormat('en-US', {
    timeZone: HOUSTON_TZ,
    weekday: 'short',
  }).format(date);
  return WEEKDAY_TO_NUM[dayStr];
}

/** @param {Date} [date] */
export function getHoustonDayOfMonth(date = new Date()) {
  const dayStr = new Intl.DateTimeFormat('en-US', {
    timeZone: HOUSTON_TZ,
    day: 'numeric',
  }).format(date);
  return parseInt(dayStr, 10);
}
