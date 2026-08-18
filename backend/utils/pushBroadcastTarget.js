/**
 * Pure helpers for push subscribe/unsubscribe validation and broadcast audience.
 * Extracted from routes/push.js — keep behavior identical.
 */

/**
 * Broadcast audience: only the exact strings `'admins'` and `'employees'`
 * are special-cased. Anything else (including `'all'`, `'Admins'`, omitted)
 * fans out via sendPushToAll.
 */
export function resolvePushBroadcastTarget(target) {
  if (target === 'admins') return 'admins';
  if (target === 'employees') return 'employees';
  return 'all';
}

/**
 * Broadcast payload gate is `!title || !body` (falsy, including `0` / `''`).
 */
export function isBroadcastPayloadMissing(title, body) {
  return !title || !body;
}

/**
 * Subscribe requires a truthy endpoint plus keys.p256dh and keys.auth
 * (optional chaining: missing `keys` fails). Empty strings are missing.
 */
export function hasPushSubscriptionFields(body) {
  const { endpoint, keys } = body || {};
  return Boolean(endpoint && keys?.p256dh && keys?.auth);
}

/** Unsubscribe requires a truthy endpoint (`''` / `0` / omitted fail). */
export function hasUnsubscribeEndpoint(endpoint) {
  return Boolean(endpoint);
}

/**
 * SQL used for the employees audience. Locks exact `'employee'` (not
 * `'Employee'` / `'admin'`) and `is_active = 1` (SQLite equality, not JS
 * truthiness).
 */
export const EMPLOYEE_BROADCAST_SQL =
  "SELECT id FROM users WHERE role = 'employee' AND is_active = 1";
