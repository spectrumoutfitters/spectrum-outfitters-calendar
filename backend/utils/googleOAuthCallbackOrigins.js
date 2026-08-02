/**
 * Pure helpers for Google OAuth popup callback HTML (postMessage target + fallback).
 * Kept separate from routes/googleCalendar.js so origin resolution can be unit-tested
 * without loading Express middleware / SQLite / googleapis.
 */

/** First non-empty string from a query param (Express may pass arrays). */
export function firstQueryParam(val) {
  if (val == null) return undefined;
  const v = Array.isArray(val) ? val[0] : val;
  const s = typeof v === 'string' ? v.trim() : '';
  return s ? s : undefined;
}

/**
 * Origin the OAuth popup uses for window.opener.postMessage.
 * Prefer FRONTEND_URL / PUBLIC_FRONTEND_ORIGIN; fall back to local Vite.
 */
export function oauthPostMessageTargetOrigin(env = process.env) {
  const raw = (env.FRONTEND_URL || env.PUBLIC_FRONTEND_ORIGIN || '').trim();
  if (raw) {
    try {
      const withProto = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
      return new URL(withProto).origin;
    } catch {
      /* fall through */
    }
  }
  const port = env.FRONTEND_PORT || 5173;
  const useHttpsLocal = env.FRONTEND_USE_HTTPS === '1';
  return `${useHttpsLocal ? 'https' : 'http'}://localhost:${port}`;
}

/**
 * Full URL to navigate to when the popup has no opener (or postMessage fails).
 * Only uses FRONTEND_URL when it already includes a scheme; otherwise local Vite.
 */
export function oauthFallbackRedirectUrl(env = process.env) {
  const raw = (env.FRONTEND_URL || '').trim();
  if (/^https?:\/\//i.test(raw)) {
    return raw.replace(/\/+$/, '');
  }
  const port = env.FRONTEND_PORT || 5173;
  const useHttpsLocal = env.FRONTEND_USE_HTTPS === '1';
  return `${useHttpsLocal ? 'https' : 'http'}://localhost:${port}`;
}
