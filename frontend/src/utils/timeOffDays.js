/**
 * Inclusive calendar-day count for a time-off request span.
 * Preserves historical Math.abs behavior when end is before start.
 * @param {string|Date} startDate
 * @param {string|Date} endDate
 * @returns {number}
 */
export function calculateDays(startDate, endDate) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffTime = Math.abs(end - start);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // +1 to include both start and end days
  return diffDays;
}
