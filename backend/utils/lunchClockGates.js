/**
 * Pure helpers for lunch overtime alerts and end-of-day cleanup-reminder gating.
 * Current behavior: alert only after 70 minutes and before 24 hours; reminder hour is America/Chicago.
 */

export const LUNCH_OVERTIME_BUFFER_MINUTES = 70;
export const LUNCH_OVERTIME_MAX_MINUTES = 24 * 60;

export function lunchDurationMinutes(lunchOutTime, lunchInTime) {
  const lunchDurationMs = new Date(lunchInTime) - new Date(lunchOutTime);
  return Math.floor(lunchDurationMs / (1000 * 60));
}

/** Returns overtime minutes past the 70-minute buffer, or null when out of the alert window. */
export function computeLunchOvertimeMinutes(durationMinutes) {
  if (durationMinutes > LUNCH_OVERTIME_BUFFER_MINUTES && durationMinutes < LUNCH_OVERTIME_MAX_MINUTES) {
    return durationMinutes - LUNCH_OVERTIME_BUFFER_MINUTES;
  }
  return null;
}

export function formatLunchOvertimeDuration(lunchOvertimeMinutes) {
  const hours = Math.floor(lunchOvertimeMinutes / 60);
  const minutes = lunchOvertimeMinutes % 60;
  return hours > 0
    ? `${hours} hour${hours > 1 ? 's' : ''} and ${minutes} minute${minutes !== 1 ? 's' : ''}`
    : `${minutes} minute${minutes !== 1 ? 's' : ''}`;
}

/** Truthy notes whose lowercased text contains `'lunch break'`. */
export function isLunchBreakNotes(notes) {
  return !!(notes && notes.toLowerCase().includes('lunch break'));
}

/** Only exact numeric `1` enables the reminder (not `'1'` / `true`). */
export function isCleanupReminderEnabled(reminderSettings) {
  return !!(reminderSettings && reminderSettings.enabled === 1);
}

export function parseClockOutCentralHour(clockOutTime) {
  const clockOutDate = new Date(clockOutTime);
  const clockOutCentral = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Chicago',
    hour: '2-digit',
    hour12: false,
  }).formatToParts(clockOutDate);
  return parseInt(clockOutCentral.find((p) => p.type === 'hour').value, 10);
}

export function shouldShowCleanupReminder(hourCentral, activeEntryCount) {
  return hourCentral >= 12 && activeEntryCount === 0;
}
