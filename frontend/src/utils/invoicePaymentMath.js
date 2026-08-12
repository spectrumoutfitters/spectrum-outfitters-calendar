/**
 * Pure helpers for CRM invoice payment display / balance due.
 * Keep status filtering aligned with backend ledgers that only count
 * `succeeded` and `paid` rows toward amount paid.
 */

export function formatCents(cents) {
  const n = Number(cents);
  if (!Number.isFinite(n)) return '—';
  return `$${(n / 100).toFixed(2)}`;
}

export function countsTowardInvoicePaid(status) {
  const s = String(status || '').toLowerCase();
  return s === 'succeeded' || s === 'paid';
}

/**
 * Sum payment row amounts that reduce balance due.
 * Ignores pending/failed/canceled/open intents and non-finite amounts.
 */
export function sumSucceededPaymentCents(payments) {
  let sum = 0;
  for (const p of payments || []) {
    if (!countsTowardInvoicePaid(p?.status)) continue;
    const a = Number(p?.amount_cents);
    if (Number.isFinite(a)) sum += a;
  }
  return sum;
}

/**
 * Remaining balance due in cents.
 * Uses Number() coercion (so `null` total becomes 0); returns null only when
 * the coerced total is non-finite (e.g. undefined / NaN).
 * @returns {number|null}
 */
export function invoiceAmountDueCents(totalCents, paidCents) {
  const total = Number(totalCents);
  if (!Number.isFinite(total)) return null;
  const paid = Number(paidCents);
  const safePaid = Number.isFinite(paid) ? paid : 0;
  return Math.max(0, total - safePaid);
}
