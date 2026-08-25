/**
 * Admin event-config gates (GET/PUT /api/admin/[slug]/config).
 * Non-array `raffles` is coerced to [] before Apps Script saveEventConfig —
 * a malformed body must not be forwarded as an object/string.
 */

export function isMissingAdminKey(raw) {
  const key = typeof raw === 'string' ? raw.trim() : '';
  return !key;
}

/**
 * Coerce the PUT body the same way the route forwards it:
 * - missing/falsy `event` → {}
 * - non-array `raffles` (including objects/strings/null) → []
 */
export function coerceEventConfigSave(payload) {
  return {
    event: payload?.event || {},
    raffles: Array.isArray(payload?.raffles) ? payload.raffles : [],
  };
}
