/**
 * Public GET /api/event/[slug] slug gate.
 * Distinct from admin config coerce (#104), eventServer fetch (#58),
 * and upload slug sanitizer (#105) — public GET does not strip chars or trim.
 */

export const PUBLIC_EVENT_SLUG_MAX = 80;

/** `!slug || slug.length > 80` — `'0'` is valid; empty / null / 81+ chars are not. */
export function isValidPublicEventSlug(slug) {
  return Boolean(slug) && String(slug).length <= PUBLIC_EVENT_SLUG_MAX;
}
