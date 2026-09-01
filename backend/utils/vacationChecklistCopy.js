/**
 * Push-notification copy for POST /api/employee/vacation-checklist.
 * days_remaining uses strict === 0 / === 1 (string "0"/"1" are not today/tomorrow).
 * Task note only when taskCount > 0 (0 / null / undefined omitted).
 */

export function formatVacationDaysLabel(daysRemaining) {
  return daysRemaining === 0
    ? 'today'
    : daysRemaining === 1
    ? 'tomorrow'
    : `in ${daysRemaining} day${daysRemaining !== 1 ? 's' : ''}`;
}

export function formatVacationTaskNote(taskCount) {
  return taskCount > 0
    ? ` — they have ${taskCount} open task${taskCount !== 1 ? 's' : ''} to hand off`
    : '';
}
