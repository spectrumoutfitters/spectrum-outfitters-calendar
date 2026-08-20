/**
 * Pure helpers for the unauthenticated invoice payment page.
 * Distinct from frontend invoicePaymentMath (display) and stripePayments.cents (null on NaN).
 */

export function parsePublicInvoiceToken(raw) {
  return String(raw || '').trim();
}

export function isPublicInvoiceTokenMissing(token) {
  return !token;
}

/**
 * Non-finite values become 0 (unlike stripePayments, which uses null and blocks the charge).
 * Number(null) === 0 so a missing total looks fully paid.
 */
export function invoiceCents(n) {
  const x = Number(n);
  return Number.isFinite(x) ? Math.round(x) : 0;
}

export function publicInvoiceAmountDueCents(totalCents, paidCents) {
  return Math.max(0, invoiceCents(totalCents) - invoiceCents(paidCents));
}
