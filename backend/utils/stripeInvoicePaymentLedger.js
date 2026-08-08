/**
 * Pure helpers for CRM invoice Stripe PaymentIntent ledger consistency.
 * Prevents charged-but-untracked intents (silent INSERT failure → unpaid invoice → second charge).
 */

export function cents(n) {
  const x = Number(n);
  return Number.isFinite(x) ? Math.round(x) : null;
}

/** Amount to record locally from a Stripe PaymentIntent object. */
export function paymentAmountCentsFromStripeIntent(obj) {
  const received = cents(obj?.amount_received);
  if (received != null && received > 0) return received;
  const amount = cents(obj?.amount);
  if (amount != null && amount > 0) return amount;
  return null;
}

/**
 * When webhook UPDATE matches no local row but Stripe reports a terminal success,
 * we must INSERT so amount-due math and paid status include the charge.
 */
export function shouldInsertMissingPaymentRow({ updateChanges, status }) {
  const changes = Number(updateChanges) || 0;
  if (changes > 0) return false;
  const s = String(status || '').toLowerCase();
  return s === 'succeeded' || s === 'paid';
}
