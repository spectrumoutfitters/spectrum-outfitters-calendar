/**
 * Dashboard task progress percent (0–100).
 * @param {object} task
 * @param {Date} [now] injectable clock for elapsed-estimate branch
 */
export function calculateTaskProgress(task, now = new Date()) {
  if (task.status === 'completed') return 100;
  if (task.subtasks && task.subtasks.length > 0) {
    const done = task.subtasks.filter((st) => st.is_completed === 1).length;
    const pct = (done / task.subtasks.length) * 100;
    let bonus = 0;
    if (task.status === 'review') bonus = 20;
    else if (task.status === 'in_progress' && task.started_at) bonus = 10;
    else if (task.status === 'in_progress') bonus = 5;
    return Math.min(100, Math.round(pct + bonus));
  }
  if (task.status === 'review') return 90;
  if (task.started_at && task.status === 'in_progress') {
    if (task.estimated_time_minutes) {
      const elapsed = (now - new Date(task.started_at)) / (1000 * 60);
      return Math.round(Math.min(85, Math.max(50, (elapsed / task.estimated_time_minutes) * 100)));
    }
    return 50;
  }
  if (task.status === 'in_progress') return 25;
  return 0;
}
