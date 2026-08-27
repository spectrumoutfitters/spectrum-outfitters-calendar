/**
 * Admin ScheduleCalendar kanban drag-reschedule date math.
 * Distinct from backend schedule overlap/permissions (#91) and Google
 * Calendar UTC addDaysDateOnly (googleCalendarService uses T00:00Z).
 *
 * Local noon + toISOString keeps the calendar day in typical US/UTC
 * offsets; spanDays parses date-only strings as UTC midnight.
 */

export function addDaysDateOnly(dateStr, days) {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

export function scheduleSpanDays(startDate, endDate) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  return Math.max(1, Math.round((end - start) / 86400000) + 1);
}

export function rescheduleSpan(startDate, endDate, newStart) {
  const spanDays = scheduleSpanDays(startDate, endDate);
  return {
    start_date: newStart,
    end_date: addDaysDateOnly(newStart, spanDays - 1),
    spanDays,
  };
}
