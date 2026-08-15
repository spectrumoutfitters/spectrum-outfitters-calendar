/**
 * Pure helpers for user create/update coercion and self-deactivation.
 * Extracted from routes/users.js — keep behavior identical.
 */

/** Only the exact string `'admin'` is admin; everything else (including `'Admin'`) is employee. */
export function coerceUserRole(role) {
  return role === 'admin' ? 'admin' : 'employee';
}

/**
 * Hourly rate / weekly salary stored on create and update.
 * Uses `value || 0`, so 0 / null / '' / NaN become 0; negatives stay negative.
 */
export function coercePayRate(value) {
  return value || 0;
}

/** Split reimbursable amount: `parseFloat(value) || 0`. */
export function coerceSplitAmount(value) {
  return parseFloat(value) || 0;
}

/** Split notes: trimmed string, or null when empty/whitespace. */
export function coerceSplitNotes(value) {
  return (value || '').trim() || null;
}

/** Only the exact string `'monthly'` is monthly; everything else is weekly. */
export function coerceSplitPeriod(value) {
  return value === 'monthly' ? 'monthly' : 'weekly';
}

/**
 * Soft-delete guard: `parseInt(targetId) === actorId` (strict).
 * A string actor id vs numeric parseInt result does not match.
 */
export function isSelfDeactivation(actorId, targetId) {
  return parseInt(targetId) === actorId;
}
