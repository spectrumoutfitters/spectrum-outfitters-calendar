/**
 * Employee task mutation gates.
 * PUT /tasks/:id only consults task_assignments; start/status/checklist/submit/pause
 * also treat legacy assigned_to and created_by as associated.
 * Only exact role 'admin' bypasses.
 */

export function isAdminRole(role) {
  return role === 'admin';
}

export function isLegacyTaskAssociate(userId, task) {
  return task?.assigned_to === userId || task?.created_by === userId;
}

export function isAssignmentTableAssociate(userId, assignmentUserIds) {
  return (assignmentUserIds || []).some((id) => id === userId);
}

/** Full-edit PUT: assignment-table ids only (legacy assigned_to / created_by do not count). */
export function canPutUpdateTask(role, userId, assignmentUserIds) {
  if (isAdminRole(role)) return true;
  return (assignmentUserIds || []).includes(userId);
}

export function canAssociateWithTask(role, userId, task, assignmentUserIds) {
  if (isAdminRole(role)) return true;
  if (isLegacyTaskAssociate(userId, task)) return true;
  return isAssignmentTableAssociate(userId, assignmentUserIds);
}
