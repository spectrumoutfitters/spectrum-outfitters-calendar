/**
 * Magic-link manage-entry API gates (GET/PATCH /api/entry/my).
 * Distinct from public POST /api/entry (12/hour + terms) and from
 * sheet-side split/newsletter totals.
 */

export const MANAGE_ENTRY_RATE_WINDOW_MS = 60 * 60 * 1000;
export const MANAGE_ENTRY_RATE_MAX = 24;

/** Query/body identity: empty, whitespace, and other falsy values are missing. */
export function normalizeIdentityField(value) {
  return String(value || '').trim();
}

export function isMissingIdentity(slug, token) {
  return !slug || !token;
}

/** Hidden `company` field on PATCH: any truthy value is treated as a bot (fake 200). */
export function isHoneypotManagePatch(body) {
  return Boolean(body?.company);
}

export function filterHitsInWindow(prev, now, windowMs = MANAGE_ENTRY_RATE_WINDOW_MS) {
  const windowStart = now - windowMs;
  return (prev || []).filter((t) => t > windowStart);
}

export function recordRateHit(prev, now, windowMs = MANAGE_ENTRY_RATE_WINDOW_MS, max = MANAGE_ENTRY_RATE_MAX) {
  const kept = filterHitsInWindow(prev, now, windowMs);
  if (kept.length >= max) {
    return { limited: true, hits: kept };
  }
  return { limited: false, hits: [...kept, now] };
}
