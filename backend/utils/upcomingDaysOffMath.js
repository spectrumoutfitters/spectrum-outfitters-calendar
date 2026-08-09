/**
 * Pure date-window + day-delta helpers for GET /api/employee/upcoming-days-off.
 *
 * Preserves historical behavior:
 * - Local midnight via setHours(0,0,0,0), then YYYY-MM-DD via toISOString().split('T')[0]
 *   (UTC calendar date — can differ from local date near timezone day boundaries).
 * - Day deltas use Math.round(ms / 86400000) after zeroing local hours on both ends.
 */

const MS_PER_DAY = 86400000;

/**
 * @param {Date|string|number} [now]
 * @returns {{ today: Date, todayStr: string, in14Str: string, threeDaysAgoStr: string }}
 */
export function daysOffWindowBounds(now = new Date()) {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().split('T')[0];

  const in14 = new Date(today);
  in14.setDate(today.getDate() + 14);
  const in14Str = in14.toISOString().split('T')[0];

  const threeDaysAgo = new Date(today);
  threeDaysAgo.setDate(today.getDate() - 3);
  const threeDaysAgoStr = threeDaysAgo.toISOString().split('T')[0];

  return { today, todayStr, in14Str, threeDaysAgoStr };
}

/**
 * Calendar-day delta after zeroing local hours on both dates.
 * @param {Date|string} from
 * @param {Date|string} to
 * @returns {number}
 */
export function calendarDaysBetween(from, to) {
  const a = new Date(from);
  a.setHours(0, 0, 0, 0);
  const b = new Date(to);
  b.setHours(0, 0, 0, 0);
  return Math.round((b - a) / MS_PER_DAY);
}

/**
 * @param {{ start_date: string, end_date: string }|null|undefined} upcoming
 * @param {Date} today local-midnight today from daysOffWindowBounds
 * @returns {{ start_date: string, end_date: string, days_remaining: number }|null}
 */
export function buildUpcomingDaysOffResult(upcoming, today) {
  if (!upcoming) return null;
  return {
    start_date: upcoming.start_date,
    end_date: upcoming.end_date,
    days_remaining: calendarDaysBetween(today, upcoming.start_date),
  };
}

/**
 * @param {{ start_date: string, end_date: string }|null|undefined} returned
 * @param {Date} today local-midnight today from daysOffWindowBounds
 * @returns {{ start_date: string, end_date: string, days_since: number }|null}
 */
export function buildRecentlyReturnedResult(returned, today) {
  if (!returned) return null;
  return {
    start_date: returned.start_date,
    end_date: returned.end_date,
    days_since: calendarDaysBetween(returned.end_date, today),
  };
}
