/**
 * Pure short-link slug + URL validation helpers (no Express/SQLite).
 */

/** Normalize custom short-link slugs to a–z / 0–9 / dash, max 50 chars. */
export function normalizeSlug(input) {
  if (!input) return '';
  return String(input)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-') // only allow a–z, 0–9, dash
    .replace(/^-+|-+$/g, '') // trim leading/trailing dashes
    .slice(0, 50);
}

/** Basic absolute URL check used by admin shorten endpoint (matches prior route behavior). */
export function isValidAbsoluteUrl(raw) {
  const target = String(raw || '').trim();
  if (!target) return false;
  try {
    // eslint-disable-next-line no-new
    new URL(target);
    return true;
  } catch {
    return false;
  }
}

/** Optional absolute short-link URL when SHORT_LINK_BASE_URL is configured. */
export function buildShortLinkFullUrl(base, slug) {
  const origin = String(base || '').trim().replace(/\/+$/, '');
  if (!origin || !slug) return undefined;
  return `${origin}/secure/${slug}`;
}
