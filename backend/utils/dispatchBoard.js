/**
 * Pure dispatch board helpers (status map + progress heuristic).
 * Kept in sync with backend/routes/dispatch.js.
 */

/** Map DB task status → dispatch display status */
export function toDispatchStatus(dbStatus) {
  if (dbStatus === 'todo') return 'received';
  if (dbStatus === 'in_progress') return 'in_progress';
  if (dbStatus === 'review') return 'ready';
  return dbStatus;
}

/**
 * Compute 0–100 progress for a dispatch job row.
 *
 * @param {{
 *   status: string,
 *   subtask_count?: number,
 *   subtasks_done?: number,
 *   started_at?: string|null,
 *   estimated_time_minutes?: number|null,
 * }} row
 * @param {number} [nowMs=Date.now()]
 */
export function computeDispatchProgress(row, nowMs = Date.now()) {
  const subtaskCount = Number(row?.subtask_count) || 0;
  const subtasksDone = Number(row?.subtasks_done) || 0;

  if (subtaskCount > 0) {
    return Math.round((subtasksDone / subtaskCount) * 100);
  }

  if (row?.status === 'review') {
    return 90;
  }

  if (row?.status === 'in_progress') {
    if (row.started_at && row.estimated_time_minutes) {
      const elapsed = (nowMs - new Date(row.started_at).getTime()) / 60000;
      return Math.min(85, Math.max(25, Math.round((elapsed / row.estimated_time_minutes) * 100)));
    }
    return 25;
  }

  return 0;
}

/**
 * Elapsed minutes since started_at, or null when not started.
 */
export function computeElapsedMinutes(startedAt, nowMs = Date.now()) {
  if (!startedAt) return null;
  return Math.floor((nowMs - new Date(startedAt).getTime()) / 60000);
}
