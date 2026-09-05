/**
 * Employee home-board task visibility + status sort.
 * Hides exact status `completed` and any truthy `is_archived` (`1` / true / `'1'`
 * / `'0'`). Distinct from Kanban archive which keeps string `'1'` on the live board.
 */

const STATUS_ORDER = { in_progress: 0, review: 1, todo: 2 };

export function isOpenEmployeeTask(task) {
  return task?.status !== 'completed' && !task?.is_archived;
}

export function compareEmployeeTaskStatus(a, b) {
  return (STATUS_ORDER[a?.status] ?? 3) - (STATUS_ORDER[b?.status] ?? 3);
}

export function selectEmployeeDashboardTasks(tasks) {
  return (tasks || [])
    .filter(isOpenEmployeeTask)
    .sort(compareEmployeeTaskStatus);
}
