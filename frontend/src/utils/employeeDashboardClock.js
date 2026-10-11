/**
 * Employee home-board clock, break countdown, task estimate, and vacation handoff copy.
 * Display only — payroll hours are calculated on the server.
 */

export function formatElapsed(ms) {
  if (!ms || ms < 0) return '0m';
  const totalSec = Math.floor(ms / 1000);
  const hours = Math.floor(totalSec / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  if (hours === 0) return `${mins}m`;
  return `${hours}h ${mins}m`;
}

export function formatBreakRemaining(ms) {
  if (!ms || ms < 0) return '0:00';
  const totalSec = Math.floor(ms / 1000);
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

export function formatTaskDuration(minutes) {
  if (!minutes) return null;
  if (minutes < 60) return `${minutes}min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export function vacationCountdownHeadline(daysRemaining) {
  if (daysRemaining === 0) return 'Your time off starts today!';
  if (daysRemaining === 1) return '1 day until your time off';
  return `${daysRemaining} days until your time off`;
}

/** Handoff checklist appears on the day time off starts and the three days before. */
export function shouldShowVacationHandoffChecklist(daysRemaining) {
  return daysRemaining <= 3;
}
