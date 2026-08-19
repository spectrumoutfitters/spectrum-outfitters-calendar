/**
 * Pure helpers for affiliate public-track dedupe, commission settlement, and id coercion.
 * Keep quirks: OR-match any ShopMonkey id; String(0) is a real key; 0 is an invalid assigned id.
 */

export function parseAffiliateTrackToken(body) {
  return String(body?.affiliate_token || body?.token || '').trim();
}

export function isAffiliateTrackTokenMissing(token) {
  return !token;
}

/** `!= null` so 0/false become strings; empty string stays '' and is later skipped by truthiness. */
export function shopmonkeyIdString(value) {
  return value != null ? String(value) : null;
}

export function normalizeShopmonkeyTrackIds(body) {
  return {
    workRequestId: shopmonkeyIdString(body?.shopmonkey_work_request_id),
    orderId: shopmonkeyIdString(body?.shopmonkey_order_id),
    customerId: shopmonkeyIdString(body?.shopmonkey_customer_id),
  };
}

/**
 * Build OR-dedupe SQL fragments. Falsy ids (including '') are omitted.
 * Caller always prefixes `affiliate_link_id = ?`.
 */
export function buildTrackDedupeClause(ids) {
  const whereParts = [];
  const extraParams = [];
  if (ids?.workRequestId) {
    whereParts.push('shopmonkey_work_request_id = ?');
    extraParams.push(ids.workRequestId);
  }
  if (ids?.orderId) {
    whereParts.push('shopmonkey_order_id = ?');
    extraParams.push(ids.orderId);
  }
  if (ids?.customerId) {
    whereParts.push('shopmonkey_customer_id = ?');
    extraParams.push(ids.customerId);
  }
  return { whereParts, extraParams, canDedupe: whereParts.length > 0 };
}

/** Truthy `raw_json` wins; otherwise stringify the whole body (including {}). */
export function serializeTrackRawJson(body) {
  return body?.raw_json ? JSON.stringify(body.raw_json) : JSON.stringify(body || {});
}

/**
 * Optional positive numeric id. `null`/`undefined` omit; `0` and NaN are invalid.
 */
export function parseOptionalPositiveId(raw) {
  if (raw == null) return { value: null, invalid: false };
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) return { value, invalid: true };
  return { value, invalid: false };
}

export function parseRequiredPositiveId(raw) {
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) return { value, invalid: true };
  return { value, invalid: false };
}

/**
 * Commission is settled only for a customer id with a paid invoice and an unpaid submission.
 * Earliest-unpaid selection stays in SQL; this mirrors the JS continue-guards.
 */
export function shouldSettleAffiliateCommission({ customerId, firstPaidInvoice, earliestSubmission } = {}) {
  if (!customerId) return false;
  if (!firstPaidInvoice?.id) return false;
  if (!earliestSubmission?.id) return false;
  return true;
}
