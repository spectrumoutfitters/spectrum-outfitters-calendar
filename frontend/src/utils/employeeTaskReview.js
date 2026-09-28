/**
 * Employee task review and pause rules used by EmployeeTaskModal.
 * Checklist completion is strict (`is_completed === 1`); torque confirm is separate.
 */

/** Non-empty checklist where every item is the numeric flag 1. */
export function checklistReadyForReview(subtasks) {
  return (
    Array.isArray(subtasks) &&
    subtasks.length > 0 &&
    subtasks.every((st) => st?.is_completed === 1)
  );
}

/** Submit-for-review prompt. Hidden once the task is already in review or completed. */
export function showSubmitForReviewPrompt(subtasks, status) {
  if (status === 'review' || status === 'completed') return false;
  return checklistReadyForReview(subtasks);
}

/** Confirm step: the torque checkbox must be checked (truthy). */
export function torqueConfirmationAccepted(torquedToSpec) {
  return Boolean(torquedToSpec);
}

/**
 * Pause start body. Blank / whitespace reasons are rejected.
 * Notes are trimmed; an empty note is sent as null.
 * @returns {{ reason: string, notes: string | null } | null}
 */
export function taskPausePayload(reason, notes) {
  const trimmedReason = String(reason ?? '').trim();
  if (!trimmedReason) return null;
  const trimmedNotes = String(notes ?? '').trim();
  return { reason: trimmedReason, notes: trimmedNotes ? trimmedNotes : null };
}

/** Completed pause length in minutes, matching the history row (Math.round of ms). */
export function completedPauseDurationMinutes(breakStart, breakEnd) {
  const startTime = new Date(breakStart);
  const endTime = new Date(breakEnd);
  return Math.round((endTime - startTime) / (1000 * 60));
}
