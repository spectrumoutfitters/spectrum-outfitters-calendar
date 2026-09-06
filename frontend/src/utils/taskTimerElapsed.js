/**
 * Client-side TaskTimer working-time math.
 *
 * Distinct from #109 `calculateTaskWorkingTime`:
 * - Open `break_end` uses `now` only when `task.active_break` is truthy; otherwise clamps to endTime.
 * - `active_break` is added again even when that interval is already in `breaks`
 *   (can double-count). Do not "fix" — this locks the live-display behavior.
 * Breaks that start before `started_at` or after `endTime` are skipped (not clipped).
 */

export function isTaskTimerLive(task) {
  return !task.completed_at && task.status !== 'completed' && task.status !== 'review';
}

export function calculateTaskTimerElapsedMs(task, now = new Date()) {
  if (!task || !task.started_at) return null;

  const startTime = new Date(task.started_at);
  const endTime = task.completed_at ? new Date(task.completed_at) : now;

  let totalMs = endTime - startTime;

  const breaks = task.breaks || [];
  let breakMs = 0;

  breaks.forEach((breakItem) => {
    if (!breakItem.break_start) return;

    const breakStart = new Date(breakItem.break_start);
    const breakEnd = breakItem.break_end
      ? new Date(breakItem.break_end)
      : (task.active_break ? now : null);

    if (breakStart >= startTime && breakStart <= endTime) {
      const breakEndTime = breakEnd || endTime;
      const clampedBreakEnd = breakEndTime > endTime ? endTime : breakEndTime;
      const breakDuration = clampedBreakEnd - breakStart;
      if (breakDuration > 0) {
        breakMs += breakDuration;
      }
    }
  });

  if (task.active_break && task.active_break.break_start) {
    const activeBreakStart = new Date(task.active_break.break_start);
    if (activeBreakStart >= startTime && activeBreakStart <= endTime) {
      const activeBreakDuration = endTime - activeBreakStart;
      if (activeBreakDuration > 0) {
        breakMs += activeBreakDuration;
      }
    }
  }

  return Math.max(0, totalMs - breakMs);
}

export function formatTaskTimerElapsed(workingMs) {
  if (workingMs === null) return null;
  const totalMinutes = Math.floor(workingMs / (1000 * 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return {
    totalMinutes,
    totalHours: parseFloat((totalMinutes / 60).toFixed(2)),
    formatted: `${hours}:${minutes.toString().padStart(2, '0')}`,
    totalMs: workingMs,
  };
}
