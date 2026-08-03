/**
 * Guards against charging a stale Stripe PaymentIntent after the invoice
 * amount due has decreased (manual payment or total edit).
 */

const TERMINAL_STATUSES = new Set([
  'succeeded',
  'paid',
  'canceled',
  'cancelled',
  'failed',
  'refunded',
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

/**
 * Local payment rows that still look cancelable (open / non-terminal).
 */
export function selectOpenPaymentRowsToCancel(rows) {
  const list = Array.isArray(rows) ? rows : [];
  return list.filter((row) => {
    if (!row?.provider_payment_intent_id) return false;
    return isOpenStripePaymentIntentStatus(row.status);
  });
}

/**
 * When a PaymentIntent succeeds after amount due dropped, compute how much
 * of the charge to keep vs refund so the invoice is not overpaid.
 *
 * @returns {{ keepCents: number, refundCents: number }}
 */
export function computeOverchargeRefundCents(totalCents, otherSucceededCents, chargedCents) {
  const total = Math.round(Number(totalCents));
  const other = Math.round(Number(otherSucceededCents));
  const charged = Math.round(Number(chargedCents));
  const safeTotal = Number.isFinite(total) && total > 0 ? total : 0;
  const safeOther = Number.isFinite(other) && other > 0 ? other : 0;
  const safeCharged = Number.isFinite(charged) && charged > 0 ? charged : 0;
  const remainingBefore = Math.max(0, safeTotal - safeOther);
  const keepCents = Math.min(safeCharged, remainingBefore);
  const refundCents = Math.max(0, safeCharged - keepCents);
  return { keepCents, refundCents };
}
