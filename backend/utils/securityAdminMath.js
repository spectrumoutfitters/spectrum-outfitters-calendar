/**
 * Pure helpers for admin security routes: auth-history paging and on-prem config / purge coercion.
 * Assert current quirks: limit 0 becomes 100; negative offset is kept; geofence 0,0,0 is valid.
 */

export function clampAuthHistoryLimit(limit = 100) {
  return Math.min(parseInt(limit, 10) || 100, 500);
}

export function parseAuthHistoryOffset(offset = 0) {
  return parseInt(offset, 10) || 0;
}

/** Empty string / undefined skip the success filter; `'0'` is a real failed-login filter. */
export function parseAuthHistorySuccess(success) {
  if (success === undefined || success === '') return { apply: false, value: undefined };
  return { apply: true, value: parseInt(success, 10) };
}

export function parseAuthHistoryUserId(userId) {
  if (!userId) return { apply: false, value: undefined };
  return { apply: true, value: parseInt(userId, 10) };
}

export function combineAuthHistoryEvents(logins = [], logouts = []) {
  const loginRows = logins.map((r) => ({ ...r, event_type: 'login' }));
  const logoutRows = logouts.map((r) => ({ ...r, event_type: 'logout', success: 1 }));
  return [...loginRows, ...logoutRows].sort((a, b) => {
    const tA = new Date(a.occurred_at).getTime();
    const tB = new Date(b.occurred_at).getTime();
    return tB - tA;
  });
}

/** Only exact `'login'` / `'logout'` filter; other values keep both. */
export function filterAuthHistoryEventType(combined, eventType) {
  if (eventType === 'login') return combined.filter((e) => e.event_type === 'login');
  if (eventType === 'logout') return combined.filter((e) => e.event_type === 'logout');
  return combined;
}

export function pageAuthHistoryEvents(combined, offsetNum, limitNum) {
  const total = combined.length;
  return { total, events: combined.slice(offsetNum, offsetNum + limitNum) };
}

export function isAllowedIPsInvalid(allowedIPs) {
  return !Array.isArray(allowedIPs);
}

/**
 * `null` clears the geofence. Otherwise require an object with lat/lng/radiusMeters present
 * (`== null` so 0 is valid; strings pass).
 */
export function isGeofencePayloadInvalid(geofence) {
  if (geofence === null) return false;
  return (
    typeof geofence !== 'object' ||
    geofence.lat == null ||
    geofence.lng == null ||
    geofence.radiusMeters == null
  );
}

/** Matches `parseInt(olderThanDays, 10)` after the query default of 90. */
export function parsePurgeOlderThanDays(olderThanDays = 90) {
  return parseInt(olderThanDays, 10);
}
