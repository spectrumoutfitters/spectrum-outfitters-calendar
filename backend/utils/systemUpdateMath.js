/**
 * System-update create/edit coercion and login-unread counting.
 * Wired into routes/updates.js — keep behavior identical.
 */

/** Login-banner unread uses strict `show_on_login === 1` (not `'1'` / true). */
export function isLoginUnread(update) {
  return !update?.is_read && update?.show_on_login === 1;
}

export function countLoginUnread(updates) {
  return (updates || []).filter(isLoginUnread).length;
}

/**
 * New updates start pending unless `auto_approve` is truthy.
 * Note: the string `'false'` is truthy and therefore auto-approves.
 */
export function resolveCreatePending(autoApprove) {
  return autoApprove ? 0 : 1;
}

/** Undefined defaults to 1 (show). Any other value uses JS truthiness → 1/0. */
export function coerceShowOnLogin(showOnLogin) {
  return showOnLogin !== undefined ? (showOnLogin ? 1 : 0) : 1;
}

/**
 * PUT `/admin/:id` uses this for `is_active`.
 * Omitting the field resets the row to active (1) — current route behavior.
 */
export function coerceIsActive(isActive) {
  return isActive !== undefined ? (isActive ? 1 : 0) : 1;
}

export function coerceUpdateType(updateType) {
  return updateType || 'feature';
}

export function coerceUpdatePriority(priority) {
  return priority || 'medium';
}

export function coerceUpdateVersion(version) {
  return version || null;
}
