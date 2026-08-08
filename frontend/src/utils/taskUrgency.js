/**
 * Dashboard task urgency bucket for visual prioritization.
 * @param {{ status?: string, due_date?: string|null, priority?: string }} task
 * @param {Date} [now]
 * @returns {'none'|'critical'|'high'|'medium'|'low'}
 */
export function getTaskUrgency(task, now = new Date()) {
  if (task.status === 'completed') return 'none';
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const due = task.due_date ? new Date(task.due_date) : null;
  due?.setHours(0, 0, 0, 0);
  const priority = (task.priority || '').toLowerCase();
  if (due && due < today) return 'critical';
  if (priority === 'critical') return 'critical';
  if (due && due.getTime() === today.getTime()) return 'high';
  if (priority === 'high') return 'high';
  const daysUntilDue = due ? Math.ceil((due - today) / (1000 * 60 * 60 * 24)) : 999;
  if (daysUntilDue <= 2) return 'high';
  if (daysUntilDue <= 7 || priority === 'medium') return 'medium';
  return 'low';
}
