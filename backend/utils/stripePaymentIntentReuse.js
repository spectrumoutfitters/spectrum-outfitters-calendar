/**
 * Helpers to avoid creating multiple chargeable Stripe PaymentIntents
 * for the same invoice amount due (refresh / multi-tab overcharge).
 */

const TERMINAL_STATUSES = new Set([
  'succeeded',
  'paid',
  'canceled',
  'cancelled',
  'failed',
]);

const OPEN_STATUSES = new Set([
  'requires_payment_method',
  'requires_confirmation',
  'requires_action',
  'processing',
  'requires_capture',
  'created',
]);

export function isOpenStripePaymentIntentStatus(status) {
  const s = String(status || '').trim().toLowerCase();
  if (!s || TERMINAL_STATUSES.has(s)) return false;
  return OPEN_STATUSES.has(s);
}

export function stripePaymentIntentIdempotencyKey(crmInvoiceId, amountDueCents) {
  const id = Number(crmInvoiceId);
  const amount = Math.round(Number(amountDueCents));
  if (!Number.isFinite(id) || id <= 0 || !Number.isFinite(amount) || amount <= 0) {
    throw new Error('invalid_idempotency_key_inputs');
  }
  return `crm-invoice-${id}-due-${amount}`;
}

/**
 * Pick the newest DB payment row that still looks reusable for amountDue.
 * Stripe retrieve/cancel happens in the caller.
 */
export function selectCandidateOpenPaymentRows(rows, amountDueCents) {
  const amount = Math.round(Number(amountDueCents));
  if (!Number.isFinite(amount) || amount <= 0) return [];
  const list = Array.isArray(rows) ? rows : [];
  return list.filter((row) => {
    if (!row?.provider_payment_intent_id) return false;
    if (!isOpenStripePaymentIntentStatus(row.status)) return false;
    const rowAmount = Math.round(Number(row.amount_cents));
    // Include amount mismatches so caller can cancel stale open intents.
    return Number.isFinite(rowAmount);
  });
}

export function shouldReuseRetrievedPaymentIntent(intent, amountDueCents) {
  if (!intent || !intent.client_secret) return false;
  const amount = Math.round(Number(amountDueCents));
  if (!Number.isFinite(amount) || amount <= 0) return false;
  if (Math.round(Number(intent.amount)) !== amount) return false;
  return isOpenStripePaymentIntentStatus(intent.status);
}
