/**
 * Turn14 route credential gates.
 * Distinct from the circuit breaker in utils/turn14.js (#66).
 *
 * /test treats env placeholders as missing. Search/pricing/orders only
 * require a non-empty trimmed secret — placeholders still count as configured.
 */

export const TURN14_PLACEHOLDER_CLIENT_ID = 'your_turn14_client_id_here';
export const TURN14_PLACEHOLDER_CLIENT_SECRET = 'your_turn14_client_secret_here';

/** Whitespace-only is missing; no placeholder check. Used by /debug hasClientId. */
export function isTurn14SecretPresent(value) {
  return Boolean(value && String(value).trim() !== '');
}

/**
 * Error-handler flag on /test: any non-empty env string counts, including
 * whitespace-only and placeholders (`!!(id && secret)`).
 */
export function isTurn14EnvSet(clientId, clientSecret) {
  return Boolean(clientId && clientSecret);
}

/** /test: present, trimmed non-empty, and not the exact .env placeholders. */
export function isTurn14ConfiguredForTest(clientId, clientSecret) {
  return (
    isTurn14SecretPresent(clientId) &&
    isTurn14SecretPresent(clientSecret) &&
    clientId !== TURN14_PLACEHOLDER_CLIENT_ID &&
    clientSecret !== TURN14_PLACEHOLDER_CLIENT_SECRET
  );
}

/** Search / part / pricing / order routes: trimmed non-empty only. */
export function isTurn14ConfiguredForApi(clientId, clientSecret) {
  return isTurn14SecretPresent(clientId) && isTurn14SecretPresent(clientSecret);
}

/**
 * GET /parts/:partNumber/pricing quantity query: `quantity ? parseInt(quantity) : 1`.
 * Falsy (including 0 / '') → 1; truthy `'0'` → 0; greedy parseInt.
 */
export function turn14PricingQuantity(quantity) {
  return quantity ? parseInt(quantity) : 1;
}
