/**
 * Public raffle entry submit gates (honeypot, terms, per-IP rate window).
 * Mirrors raffle-platform/src/app/api/entry/route.ts before Apps Script.
 */

export const ENTRY_RATE_WINDOW_MS = 60 * 60 * 1000;
export const ENTRY_RATE_MAX = 12;

/** Hidden `company` field: any truthy value is treated as a bot (fake 200). */
export function isHoneypotEntry(body) {
  return Boolean(body?.company);
}

/** Terms must be truthy (`1` / `'true'` pass; `0` / `false` / missing fail). */
export function isTermsRejected(body) {
  return !body?.termsAccepted;
}

export function filterHitsInWindow(prev, now, windowMs = ENTRY_RATE_WINDOW_MS) {
  const windowStart = now - windowMs;
  return (prev || []).filter((t) => t > windowStart);
}

export function recordRateHit(prev, now, windowMs = ENTRY_RATE_WINDOW_MS, max = ENTRY_RATE_MAX) {
  const kept = filterHitsInWindow(prev, now, windowMs);
  if (kept.length >= max) {
    return { limited: true, hits: kept };
  }
  return { limited: false, hits: [...kept, now] };
}
