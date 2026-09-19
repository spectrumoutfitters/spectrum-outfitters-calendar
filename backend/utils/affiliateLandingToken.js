/**
 * Public /affiliates/:token landing gate in server.js.
 * Distinct from affiliate customer URL builders and public-track id coercion.
 */

export function isValidAffiliateLandingToken(token) {
  const t = String(token ?? '').trim();
  return Boolean(t && /^[a-fA-F0-9]{8,}$/.test(t));
}
