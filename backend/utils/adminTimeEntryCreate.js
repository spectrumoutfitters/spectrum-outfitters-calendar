import { formatDateInHouston, getTodayInHouston, getWeekEndingSundayHouston } from './appTimezone.js';

/**
 * Validate + resolve fields for admin-created time entries (POST /api/time/entries).
 * Historical open entries (clock_out null on a non-today Houston date) become phantom
 * active sessions that block clock-in and can later close into huge paid hours.
 */
export function resolveAdminCreatedTimeEntry({ clock_in, clock_out, todayHouston = getTodayInHouston() }) {
  if (!clock_in) {
    return { ok: false, status: 400, error: 'user_id and clock_in are required' };
  }

  const clockInHoustonDate = formatDateInHouston(clock_in);
  if (!clockInHoustonDate || !/^\d{4}-\d{2}-\d{2}$/.test(clockInHoustonDate)) {
    return { ok: false, status: 400, error: 'Invalid clock_in' };
  }

  const resolvedClockOut = clock_out || null;
  if (!resolvedClockOut && clockInHoustonDate !== todayHouston) {
    return {
      ok: false,
      status: 400,
      error: 'Cannot create an open time entry for a past or future date; clock_out is required'
    };
  }

  if (resolvedClockOut) {
    const inMs = new Date(clock_in).getTime();
    const outMs = new Date(resolvedClockOut).getTime();
    if (!Number.isFinite(inMs) || !Number.isFinite(outMs) || outMs <= inMs) {
      return { ok: false, status: 400, error: 'clock_out must be after clock_in' };
    }
  }

  return {
    ok: true,
    clockInHoustonDate,
    weekEnding: getWeekEndingSundayHouston(clockInHoustonDate),
    resolvedClockOut
  };
}
