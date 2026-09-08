/**
 * Pure Google OAuth callback helpers (query coerce + popup origin / fallback URL).
 * Extracted from routes/googleCalendar.js — keep behavior identical.
 */

export function firstQueryParam(val) {
  if (val == null) return undefined;
  const v = Array.isArray(val) ? val[0] : val;
  const s = typeof v === 'string' ? v.trim() : '';
  return s ? s : undefined;
}

/** Where the SPA runs (OAuth popup notifies opener on this origin). */
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

export function oauthFallbackRedirectUrl(env = process.env) {
  const raw = (env.FRONTEND_URL || '').trim();
  if (/^https?:\/\//i.test(raw)) {
    return raw.replace(/\/+$/, '');
  }
  const port = env.FRONTEND_PORT || 5173;
  const useHttpsLocal = env.FRONTEND_USE_HTTPS === '1';
  return `${useHttpsLocal ? 'https' : 'http'}://localhost:${port}`;
}
