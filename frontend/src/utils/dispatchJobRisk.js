/**
 * Dispatch board job risk from estimate vs elapsed time.
 * @param {{ estimated_hours?: number|null, elapsed_minutes?: number|null }} job
 * @returns {'ok'|'warning'|'overdue'}
 */
export function jobRisk(job) {
  if (!job.estimated_hours || job.elapsed_minutes == null) return 'ok';
  const elapsedH = job.elapsed_minutes / 60;
  const ratio = elapsedH / job.estimated_hours;
  if (ratio >= 1) return 'overdue';
  if (ratio >= 0.8) return 'warning';
  return 'ok';
}

/** Format elapsed minutes for dispatch cards (null → null). */
export function fmtElapsed(mins) {
  if (mins == null) return null;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}
