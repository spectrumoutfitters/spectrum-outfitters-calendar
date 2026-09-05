/**
 * Affiliate public-quote iframe + postMessage track payload.
 * ShopMonkey shape variants are accepted via || fallbacks; falsy IDs
 * (0 / '' / null) fall through. Nested `payload.data` is used only when
 * it is a truthy object (arrays included).
 */

const SHOPMONKEY_QUOTE_BASE =
  'https://app.shopmonkey.cloud/public/quote-request/b6ddd723-82be-48b3-9166-59ac434cda7c';

export function normalizeAffiliateToken(token) {
  return String(token || '').trim();
}

export function buildAffiliateQuoteIframeSrc(affiliateToken) {
  const params = new URLSearchParams();
  params.set('noExternalScripts', '1');
  params.set('affiliateToken', affiliateToken);
  params.set('note', `AFFILIATE_TOKEN:${affiliateToken}`);
  params.set('description', `AFFILIATE_TOKEN:${affiliateToken}`);
  return `${SHOPMONKEY_QUOTE_BASE}?${params.toString()}`;
}

export function unwrapAffiliateMessageData(payload) {
  if (!payload) return null;
  if (typeof payload !== 'object') return null;
  return payload.data && typeof payload.data === 'object' ? payload.data : payload;
}

/**
 * @returns {{ workRequestId: *, orderId: *, customerId: * } | null}
 *   null when the payload is not an object or every ID is falsy.
 */
export function extractAffiliateTrackIds(payload) {
  const data = unwrapAffiliateMessageData(payload);
  if (!data) return null;
  const workRequestId =
    data?.workRequestId || data?.work_request_id || data?.workRequest?.id || data?.work_request?.id || null;
  const orderId = data?.orderId || data?.order_id || data?.order?.id || null;
  const customerId = data?.customerId || data?.customer_id || data?.customer?.id || null;
  if (!workRequestId && !orderId && !customerId) return null;
  return { workRequestId, orderId, customerId };
}
