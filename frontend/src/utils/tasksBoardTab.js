/** Admins land on the full board. Employees land on their own list. */
export function initialTasksTab(isAdmin) {
  return isAdmin ? 'all' : 'mine';
}

/**
 * A status deep link (for example ?status=review) only exists on the full board.
 * Returns 'all' when the filter should take over, otherwise null so the current tab stays.
 */
export function tasksTabForStatusFilter(statusFilter) {
  return statusFilter ? 'all' : null;
}
