/**
 * Pure helpers for payroll history auto-sync gating / status parsing.
 * Kept separate from DB I/O so unit tests stay dependency-light.
 */

/** Parse stored sync-status JSON; corrupt/empty values become null. */
export function parsePayrollHistorySyncStatus(raw) {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Pure Saturday / once-per-day gate for payroll history auto-sync.
 * @param {{ force?: boolean, today: string, dayOfWeek: number, lastSyncDate?: string|null }}
 * @returns {{ ran: false, reason: string, today: string } | { shouldRun: true, today: string }}
 */
export function evaluatePayrollHistoryAutoSyncGate({
  force = false,
  today,
  dayOfWeek,
  lastSyncDate = null,
} = {}) {
  if (!force && dayOfWeek !== 6) {
    return { ran: false, reason: 'not_saturday', today };
  }
  if (!force && lastSyncDate === today) {
    return { ran: false, reason: 'already_ran_today', today };
  }
  return { shouldRun: true, today };
}
