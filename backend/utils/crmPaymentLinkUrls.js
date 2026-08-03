/**
 * Pure helpers for CRM public invoice payment / short-link URLs.
 * Kept separate so origin resolution can be unit-tested without Express/SQLite.
 */

function firstHeaderValue(value) {
  return (value == null ? '' : String(value)).split(',')[0].trim();
}

function trimTrailingSlashes(url) {
  return String(url || '').trim().replace(/\/+$/, '');
}

/**
 * Resolve the public app origin used for /pay/:token links.
 * Prefers PUBLIC_APP_URL / FRONTEND_URL, else request forwarded host.
 */
export function baseAppUrl(req, env = process.env) {
  const fromEnv = trimTrailingSlashes(env.PUBLIC_APP_URL || env.FRONTEND_URL || '');
  if (fromEnv) return fromEnv;

  const proto = firstHeaderValue(req?.headers?.['x-forwarded-proto'] || req?.protocol || 'https') || 'https';
  const host = firstHeaderValue(req?.headers?.['x-forwarded-host'] || req?.headers?.host || '');
  return host ? `${proto}://${host}` : '';
}

/**
 * Resolve the branded short-link origin (/secure/:slug).
 * Prefers SHORT_LINK_BASE_URL, else falls back to baseAppUrl(req).
 */
export function shortLinkBase(req, env = process.env) {
  const base = trimTrailingSlashes(env.SHORT_LINK_BASE_URL || '');
  if (base) return base;
  return baseAppUrl(req, env);
}

/** Build absolute or relative invoice pay URL for a payment-link token. */
export function buildInvoicePayUrl(appUrl, token) {
  const payPath = `/pay/${token}`;
  const base = trimTrailingSlashes(appUrl);
  return base ? `${base}${payPath}` : payPath;
}

/** Build absolute /secure/:slug URL when a short-link base is available. */
export function buildSecureShortUrl(base, slug) {
  if (!slug) return null;
  const origin = trimTrailingSlashes(base);
  if (!origin) return null;
  return `${origin}/secure/${slug}`;
}
