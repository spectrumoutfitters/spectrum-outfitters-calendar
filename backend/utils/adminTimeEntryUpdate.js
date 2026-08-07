import { formatDateInHouston, getTodayInHouston, getWeekEndingSundayHouston } from './appTimezone.js';

/**
 * Validate admin PUT /api/time/entries/:id fields.
 *
 * Critical: clearing clock_out on a historical entry creates a phantom open session
 * that blocks clock-in and can later close into days of inflated paid hours.
 * Distinct from POST create of historical open returns (see adminTimeEntryCreate).
 */
export function resolveAdminTimeEntryUpdate({
  currentEntry,
  clock_in,
  clock_out,
  break_minutes,
  notes,
  todayHouston = getTodayInHouston(),
}) {
  if (!currentEntry) {
    return { ok: false, status: 404, error: 'Time entry not found' };
  }

  const nextClockIn = clock_in || currentEntry.clock_in;
  // Explicit null/'' clears clock_out; undefined keeps existing.
  const nextClockOut =
    clock_out !== undefined ? clock_out || null : currentEntry.clock_out;
  const nextBreak =
    break_minutes !== undefined
      ? Math.max(0, Math.floor(Number(break_minutes) || 0))
      : currentEntry.break_minutes;
  const nextNotes = notes !== undefined ? notes : currentEntry.notes;

  const clockInHoustonDate = formatDateInHouston(nextClockIn);
  if (!clockInHoustonDate || !/^\d{4}-\d{2}-\d{2}$/.test(clockInHoustonDate)) {
    return { ok: false, status: 400, error: 'Invalid clock_in' };
  }

  if (!nextClockOut && clockInHoustonDate !== todayHouston) {
    return {
      ok: false,
      status: 400,
      error:
        'Cannot reopen a time entry as open for a past or future date; clock_out is required',
    };
  }

  if (nextClockOut) {
    const inMs = new Date(nextClockIn).getTime();
    const outMs = new Date(nextClockOut).getTime();
    if (!Number.isFinite(inMs) || !Number.isFinite(outMs) || outMs <= inMs) {
      return { ok: false, status: 400, error: 'clock_out must be after clock_in' };
    }
  }

  return {
    ok: true,
    clockInHoustonDate,
    weekEnding: getWeekEndingSundayHouston(clockInHoustonDate),
    nextClockIn,
    nextClockOut,
    nextBreak,
    nextNotes,
    becomesOpen: !nextClockOut,
  };
}
