/**
 * Socket.io + Express CORS origin gate used by server.js.
 * Distinct from Google OAuth callback/popup origin helpers.
 */

export const SPECTRUM_PRODUCTION_ORIGIN_RE =
  /^https?:\/\/([a-z0-9-]+\.)*spectrumoutfitters\.com(:\d+)?$/i;

export function productionOriginRegexForEnv(nodeEnv) {
  return nodeEnv === 'production' ? SPECTRUM_PRODUCTION_ORIGIN_RE : null;
}

export function parseAllowedOriginsList(csv) {
  if (csv == null || csv === '') return [];
  return String(csv)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/** RFC1918 / loopback origins used for shop LAN + local Vite (HTTP or HTTPS). */
export function isLocalNetworkOrigin(origin) {
  return /^https?:\/\/(192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.|localhost|127\.0\.0\.1)/.test(
    String(origin || ''),
  );
}

/**
 * Allow: missing origin (curl/mobile), configured prefixes (port stripped),
 * production spectrumoutfitters.com hosts (when regex is set), or LAN/loopback.
 */
export function isAllowedCorsOrigin(origin, { allowedOrigins = [], productionOriginRegex = null } = {}) {
  if (!origin) return true;
  if (allowedOrigins.some((allowed) => origin.startsWith(String(allowed).replace(/:\d+$/, '')))) {
    return true;
  }
  if (productionOriginRegex && productionOriginRegex.test(origin)) {
    return true;
  }
  return isLocalNetworkOrigin(origin);
}
