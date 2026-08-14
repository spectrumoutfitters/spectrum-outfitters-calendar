/**
 * Pure helpers for schedule visibility, date-range validation, overlap,
 * create-target permissions, and employee event vs time-off status.
 * Extracted from routes/schedule.js — keep behavior identical.
 */

const EVENT_TYPES = ['meeting', 'training', 'other', 'appointment', 'workshop', 'conference'];

/**
 * Stored app_settings value → whether employees see the full schedule.
 * Only the strings `'1'` and `'true'` count (boolean true / number 1 do not).
 */
export function parseEmployeesSeeAllSetting(value) {
  return value === '1' || value === 'true';
}

/**
 * PUT /api/schedule/visibility body → stored `'1'` / `'0'`.
 * Only boolean `true` or string `'true'` persist as enabled (`'1'` / `'true'` / `1` do not).
 */
export function employeesSeeAllToStoredValue(employeesSeeAll) {
  return employeesSeeAll === true || employeesSeeAll === 'true' ? '1' : '0';
}

/**
 * Validate start/end for create (required) or update (skip if either missing).
 * Equal dates are allowed (`end < start` is the only order rejection).
 */
export function parseScheduleDateRange(start_date, end_date, { required = true } = {}) {
  if (!start_date || !end_date) {
    if (required) return { error: 'start_date and end_date are required' };
    return { skip: true };
  }
  const start = new Date(start_date);
  const end = new Date(end_date);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return { error: 'Invalid date format' };
  }
  if (end < start) {
    return { error: 'end_date must be after start_date' };
  }
  return { start, end };
}

/**
 * Same three-clause overlap used in schedule SQL:
 * existing contains newStart, existing contains newEnd, or existing is fully inside new.
 * Touching endpoints count as overlap (`end >= otherStart`).
 */
export function dateRangesOverlap(existingStart, existingEnd, newStart, newEnd) {
  return (
    (existingStart <= newStart && existingEnd >= newStart) ||
    (existingStart <= newEnd && existingEnd >= newEnd) ||
    (existingStart >= newStart && existingEnd <= newEnd)
  );
}

/**
 * Shop-wide closed days: `is_shop_wide === true` or `=== 1` only (`'1'` / `'true'` do not).
 */
export function isShopWideFlag(is_shop_wide) {
  return is_shop_wide === true || is_shop_wide === 1;
}

/**
 * Employee calendar events: `true`, `'true'`, or `1` (`'1'` does not).
 */
export function isEventFlag(is_event) {
  return is_event === true || is_event === 'true' || is_event === 1;
}

/**
 * Who the created row is for. Non-admins cannot create shop-wide days or entries for others.
 */
export function resolveScheduleCreateTarget({ isAdmin, actorUserId, user_id, is_shop_wide }) {
  const shopWide = isShopWideFlag(is_shop_wide);
  if (shopWide) {
    if (!isAdmin) {
      return { error: 'Only admins can create shop-wide closed days', status: 403 };
    }
    return { shopWide: true, targetUserId: null };
  }
  if (isAdmin) {
    return { shopWide: false, targetUserId: user_id || actorUserId };
  }
  return { shopWide: false, targetUserId: actorUserId };
}

/**
 * Type/status for POST /api/schedule.
 * Employees' `is_event` entries skip pending approval; unknown event types become `meeting`.
 */
export function resolveScheduleCreateTypeStatus({ isAdmin, type, is_event }) {
  const isEvent = isEventFlag(is_event);
  let entryType = type || (isAdmin ? 'day_off' : 'time_off_request');
  let entryStatus = isAdmin ? 'scheduled' : 'pending';
  if (!isAdmin && isEvent) {
    entryType = EVENT_TYPES.includes(entryType) ? entryType : 'meeting';
    entryStatus = 'scheduled';
  }
  return { isEvent, entryType, entryStatus };
}

export { EVENT_TYPES };
