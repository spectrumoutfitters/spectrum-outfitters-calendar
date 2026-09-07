/**
 * Admin Time Approval list filters.
 *
 * Visibility is `type === 'time_off_request' OR status === 'pending'`:
 * pending day_off / vacation rows still appear; approved time_off_request
 * rows stay visible. Approved admin-created day_off rows are hidden.
 *
 * Status chip then uses exact `status === filter` (`'all'` skips).
 * Inclusive day count is abs + ceil(ms/day) + 1 (same-day → 1).
 */

export function isTimeApprovalRow(entry) {
  return entry?.type === 'time_off_request' || entry?.status === 'pending';
}

export function filterTimeApprovalRows(entries, statusFilter = 'pending') {
  let rows = (entries || []).filter(isTimeApprovalRow);
  if (statusFilter !== 'all') {
    rows = rows.filter((req) => req.status === statusFilter);
  }
  return rows.sort((a, b) => new Date(b.start_date) - new Date(a.start_date));
}

export function inclusiveCalendarDays(startDate, endDate) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffTime = Math.abs(end - start);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  return diffDays;
}
