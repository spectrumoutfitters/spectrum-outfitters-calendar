/**
 * ShopMonkey route credential gate.
 * Distinct from Turn14 placeholder-vs-empty (#106) and ShopMonkey
 * work-item / RO extract helpers (#74/#76).
 *
 * Missing, whitespace-only, or the exact .env placeholder → not configured.
 * Trim is only used for the empty check; a placeholder with trailing
 * spaces still counts as configured (current route behavior).
 */

export const SHOPMONKEY_PLACEHOLDER_API_KEY = 'your_shopmonkey_api_key_here';

export function isShopmonkeyApiKeyConfigured(value) {
  const key = arguments.length > 0 ? value : process.env.SHOPMONKEY_API_KEY;
  return Boolean(key) && key.trim() !== '' && key !== SHOPMONKEY_PLACEHOLDER_API_KEY;
}
