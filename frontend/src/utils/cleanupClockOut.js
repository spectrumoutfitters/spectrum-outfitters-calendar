/**
 * Confirming the end-of-day checklist always records cleanup as done.
 * The boxes are a reminder, not a gate. Blank notes are stored as null.
 */
export function buildCleanupConfirmPayload(notes) {
  const trimmed = String(notes ?? '').trim();
  return {
    cleanup_completed: true,
    notes: trimmed || null,
  };
}

/**
 * Quick clock-out must not invent a lunch deduction. Lunch is its own punch.
 * A non-zero break_minutes here would undercount payroll hours.
 */
export function buildQuickClockOutBody({ cleanup_completed, notes } = {}) {
  return {
    break_minutes: 0,
    notes: notes || null,
    cleanup_completed,
  };
}
