/**
 * App timezone: Houston, Texas (America/Chicago).
 * All "today", week boundaries, and date arithmetic use this timezone regardless of server location.
 */

import { DateTime } from 'luxon';

export const APP_TIMEZONE = 'America/Chicago';

/**
 * Today's date in Houston as YYYY-MM-DD.
 */
export function getTodayInHouston() {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: APP_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  const parts = formatter.formatToParts(new Date());
  const year = parts.find(p => p.type === 'year').value;
  const month = parts.find(p => p.type === 'month').value;
  const day = parts.find(p => p.type === 'day').value;
  return `${year}-${month}-${day}`;
}

/**
 * Format a Date as YYYY-MM-DD in Houston.
 */
export function formatDateInHouston(date) {
  const d = date instanceof Date ? date : new Date(date);
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: APP_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  const parts = formatter.formatToParts(d);
  const year = parts.find(p => p.type === 'year').value;
  const month = parts.find(p => p.type === 'month').value;
  const day = parts.find(p => p.type === 'day').value;
  return `${year}-${month}-${day}`;
}

/**
 * Parse a Houston calendar date string (YYYY-MM-DD) into a Date at noon Houston.
 * Use for week arithmetic so "Friday" is Friday in Houston.
 */
export function parseHoustonDate(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return new Date(dateStr);
  const trimmed = dateStr.trim().slice(0, 10);
  const [y, m, day] = trimmed.split('-').map(Number);
  if (!y || !m || !day) return new Date(trimmed);
  const provisional = new Date(Date.UTC(y, m - 1, day, 12, 0, 0));
  const houstonHour = parseInt(
    new Intl.DateTimeFormat('en-US', {
      timeZone: APP_TIMEZONE,
      hour: 'numeric',
      hour12: false
    }).format(provisional),
    10
  );
  const utcHourForNoonHouston = 24 - houstonHour;
  return new Date(Date.UTC(y, m - 1, day, utcHourForNoonHouston, 0, 0));
}

/**
 * Add or subtract days in Houston (returns YYYY-MM-DD in Houston).
 */
export function addDaysInHouston(dateStr, days) {
  const d = parseHoustonDate(dateStr);
  d.setUTCDate(d.getUTCDate() + days);
  return formatDateInHouston(d);
}

/**
 * Week ending Friday in Houston. Returns Monday (week start) for the week containing the given Friday date.
 * dateStr: YYYY-MM-DD (a Friday in Houston).
 */
export function getWeekStartHouston(weekEndingFridayStr) {
  return addDaysInHouston(weekEndingFridayStr, -4);
}

/** Get weekday in Houston (0=Sun, 5=Fri). */
export function getHoustonDayOfWeek(dateStr) {
  const d = parseHoustonDate(dateStr);
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: APP_TIMEZONE,
    weekday: 'short'
  });
  const short = formatter.format(d);
  const map = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return map[short] ?? 0;
}

/**
 * Week ending Sunday (for time entries): returns the Sunday of the week containing the given date in Houston.
 * If no dateStr, uses today in Houston.
 */
export function getWeekEndingSundayHouston(dateStr) {
  const ref = dateStr && typeof dateStr === 'string' ? dateStr.trim().slice(0, 10) : getTodayInHouston();
  const day = getHoustonDayOfWeek(ref);
  const daysToSunday = (7 - day) % 7;
  return addDaysInHouston(ref, daysToSunday);
}

/**
 * Get the Friday of the week containing this date (Houston). Returns YYYY-MM-DD.
 * Use when you have a date and need "week ending Friday" for that week.
 */
export function getWeekEndingFridayHouston(dateStr) {
  const dayOfWeek = getHoustonDayOfWeek(dateStr);
  const daysToFriday = dayOfWeek <= 5 ? (5 - dayOfWeek) : (5 - dayOfWeek + 7);
  return addDaysInHouston(dateStr, daysToFriday);
}

/**
 * Convert an inclusive Houston calendar-date range (YYYY-MM-DD) into UTC ISO bounds
 * suitable for comparing against stored UTC `clock_in` timestamps.
 *
 * Prefer `clock_in >= startIso AND clock_in < endExclusiveIso` over SQLite
 * `DATE(clock_in)`, which buckets by the UTC calendar day and drops evening
 * Houston punches into the next UTC date.
 */
export function houstonInclusiveDateRangeToUtc(startYmd, endYmdInclusive) {
  const start = String(startYmd || '').trim().slice(0, 10);
  const end = String(endYmdInclusive || '').trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) {
    throw new Error('houstonInclusiveDateRangeToUtc requires YYYY-MM-DD start and end');
  }
  const startIso = DateTime.fromISO(start, { zone: APP_TIMEZONE }).startOf('day').toUTC().toISO();
  const endExclusiveIso = DateTime.fromISO(end, { zone: APP_TIMEZONE })
    .plus({ days: 1 })
    .startOf('day')
    .toUTC()
    .toISO();
  return { startIso, endExclusiveIso };
}

/**
 * Monday–Sunday Houston week containing `weekEndingDate` (any day in the week, typically Sunday).
 * Returns Houston YYYY-MM-DD bounds plus UTC ISO range for time-entry queries.
 */
export function getHoustonWeekMondayToSundayUtcRange(weekEndingDate) {
  const weekEndSunday = getWeekEndingSundayHouston(weekEndingDate);
  const weekStartMonday = addDaysInHouston(weekEndSunday, -6);
  const { startIso, endExclusiveIso } = houstonInclusiveDateRangeToUtc(weekStartMonday, weekEndSunday);
  return {
    weekStartMonday,
    weekEndSunday,
    startIso,
    endExclusiveIso
  };
}
