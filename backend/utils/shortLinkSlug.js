/**
 * Pure payment short-link slug + target URL gates.
 * Extracted from routes/shortLinks.js — keep behavior identical.
 */

export function normalizeSlug(input) {
  if (!input) return '';
  return String(input)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-') // only allow a–z, 0–9, dash
    .replace(/^-+|-+$/g, '') // trim leading/trailing dashes
    .slice(0, 50);
}

export function isValidShortLinkTarget(rawTarget) {
  const target = (rawTarget || '').trim();
  if (!target) return false;
  try {
    // eslint-disable-next-line no-new
    new URL(target);
    return true;
  } catch {
    return false;
  }
}
