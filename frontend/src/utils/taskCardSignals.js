/**
 * Kanban card checklist counts and activity badges (TaskCard).
 * Pause hides Working. Review can show beside pause. Subtask completion is strict === 1.
 */

export function countCompletedSubtasks(subtasks) {
  const list = Array.isArray(subtasks) ? subtasks : [];
  return {
    completed: list.filter((st) => st.is_completed === 1).length,
    total: list.length,
  };
}

/** Null when there are no comments. Pluralizes every count except exactly 1. */
export function commentCountLabel(comments) {
  const count = Array.isArray(comments) ? comments.length : 0;
  if (count <= 0) return null;
  return `${count} comment${count !== 1 ? 's' : ''}`;
}

export function taskCardActivity(task) {
  return {
    needsReview: task?.status === 'review',
    onPause: Boolean(task?.active_break),
    working: Boolean(
      !task?.active_break
      && task?.status === 'in_progress'
      && task?.started_at
      && !task?.completed_at
    ),
  };
}
