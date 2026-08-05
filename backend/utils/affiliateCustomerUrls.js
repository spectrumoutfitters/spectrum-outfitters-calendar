/**
 * Pure affiliate customer landing URL helpers (env → base/prefix/path).
 * Kept in sync with backend/routes/affiliates.js.
 */

export function customerBaseUrl(env = process.env) {
  const base = (
    env.CUSTOMER_AFFILIATE_BASE_URL ||
    env.CUSTOMER_PUBLIC_URL ||
    env.PUBLIC_APP_URL ||
    env.FRONTEND_URL ||
    ''
  )
    .trim()
    .replace(/\/+$/, '');
  return base || '';
}

export function customerPathPrefix(env = process.env) {
  const p = (env.CUSTOMER_AFFILIATE_PATH_PREFIX || '').trim().replace(/\/+$/, '');
  if (!p) return '';
  return p.startsWith('/') ? p : `/${p}`;
}

/**
 * Build relative path and optional absolute full_url for an affiliate token.
 */
export function buildAffiliateCustomerUrls(token, env = process.env) {
  const cBase = customerBaseUrl(env);
  const prefix = customerPathPrefix(env);
  const path = `${prefix}/affiliates/${token}`.replace(/\/+/g, '/');
  return {
    path: path.startsWith('/') ? path : `/${path}`,
    full_url: cBase ? `${cBase}${path}` : null,
  };
}
