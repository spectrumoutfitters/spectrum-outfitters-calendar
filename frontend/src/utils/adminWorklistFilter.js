/**
 * Admin worklist list filters and due-time buckets.
 * Completed is exact is_completed === 1 (true / '1' stay pending).
 */

export function filterWorklistItems(items, filters = {}) {
  const list = Array.isArray(items) ? items : [];
  return list.filter((item) => {
    if (filters.priority !== 'all' && item.priority !== filters.priority) return false;
    if (filters.category !== 'all' && item.category !== filters.category) return false;
    if (filters.status === 'pending' && item.is_completed === 1) return false;
    if (filters.status === 'completed' && item.is_completed !== 1) return false;
    return true;
  });
}

export function getDueTimeStatus(dueTime, now = new Date()) {
  if (!dueTime) return null;
  const [hours, minutes] = dueTime.split(':').map(Number);
  const due = new Date(now);
  due.setHours(hours, minutes, 0, 0);
  const diffMinutes = (due - now) / (1000 * 60);
  if (diffMinutes < 0) return 'overdue';
  if (diffMinutes < 60) return 'due-soon';
  return 'upcoming';
}
