/**
 * ShopMonkey public quote iframe postMessage gate.
 * Distinct from AffiliateQuote postMessage IDs (#116).
 */

export const SHOPMONKEY_QUOTE_ORIGIN = 'https://app.shopmonkey.cloud';

export const DEFAULT_SHOPMONKEY_QUOTE_EMBED_SRC =
  'https://app.shopmonkey.cloud/public/quote-request/b6ddd723-82be-48b3-9166-59ac434cda7c';

export function shopMonkeyQuoteEmbedSrc(envValue, defaultSrc = DEFAULT_SHOPMONKEY_QUOTE_EMBED_SRC) {
  return typeof envValue === 'string' && envValue.trim() ? envValue.trim() : defaultSrc;
}

export function shouldAcceptShopMonkeyQuoteMessage(
  event,
  allowedOrigin = SHOPMONKEY_QUOTE_ORIGIN
) {
  if (!event || event.origin !== allowedOrigin) return false;
  return Boolean(event.data && event.data.source === 'sm_wrf' && event.data.dataLayer);
}
