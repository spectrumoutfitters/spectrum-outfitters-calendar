/**
 * Days until a compliance due date (negative = overdue).
 * Preserves ComplianceCenter's `new Date(dateStr)` parse (UTC midnight for YYYY-MM-DD).
 * @param {string} dateStr
 * @param {Date} [now]
 * @returns {number}
 */
export function getDaysUntil(dateStr, now = new Date()) {
  const due = new Date(dateStr);
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const diff = Math.ceil((due - today) / (1000 * 60 * 60 * 24));
  return diff;
}
