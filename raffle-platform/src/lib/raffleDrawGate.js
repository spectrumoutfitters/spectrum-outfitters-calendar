/**
 * Admin drawWinner body coercion (POST /api/admin/[slug]/draw).
 * Distinct from live-board reveal (#86) and paid-pool draw locks (#85).
 */

/** Truthy raffleId is required; numeric 0 / empty string are missing. */
export function isMissingRaffleId(raffleId) {
  return !raffleId;
}

/**
 * Coerce draw payload fields the route forwards to Apps Script.
 * `excludePhones ?? []` only defaults null/undefined — arrays, strings, and
 * objects are forwarded as-is. `testModeOnly` uses Boolean() (`"false"` is true).
 */
export function parseDrawBody(body) {
  if (isMissingRaffleId(body?.raffleId)) {
    return { ok: false, error: 'missing_raffleId' };
  }
  return {
    ok: true,
    raffleId: body.raffleId,
    excludePhones: body.excludePhones ?? [],
    testModeOnly: Boolean(body.testModeOnly),
  };
}
