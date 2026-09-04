/**
 * Kanban column membership and drag-drop status resolution.
 * Archived column uses exact is_archived === 1; live columns also hide boolean true.
 * String '1' is not archived for the Archived column, and is not hidden from live columns.
 */

export const KANBAN_LIVE_COLUMN_IDS = ['todo', 'in_progress', 'review', 'completed'];

/** Drag-block flag: numeric 1 or boolean true (string '1' can still be dragged). */
export function isKanbanDragBlocked(task) {
  return task?.is_archived === 1 || task?.is_archived === true;
}

export function filterKanbanColumn(tasks, status, categoryFilter = 'all') {
  const list = Array.isArray(tasks) ? tasks : [];
  let filtered;
  if (status === 'archived') {
    filtered = list.filter((task) => task.is_archived === 1);
  } else {
    filtered = list.filter((task) => (
      task.status === status && (task.is_archived !== 1 && task.is_archived !== true)
    ));
  }
  if (categoryFilter !== 'all') {
    filtered = filtered.filter((task) => task.category === categoryFilter);
  }
  return filtered;
}

/**
 * Resolve a drop target to a new live status, or null when the drop is a no-op.
 * Dropping on the archived column (or a task whose status is 'archived') is rejected.
 */
export function resolveKanbanDropStatus(overId, tasks, { showArchived = false, columnIds = KANBAN_LIVE_COLUMN_IDS } = {}) {
  const isColumn = columnIds.includes(overId) || (showArchived && overId === 'archived');
  let newStatus = overId;
  if (!isColumn) {
    const targetTask = (Array.isArray(tasks) ? tasks : []).find((t) => t.id === overId);
    if (!targetTask) return null;
    newStatus = targetTask.status;
  }
  if (newStatus === 'archived') return null;
  return newStatus;
}
