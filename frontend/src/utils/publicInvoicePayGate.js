/**
 * Public /pay/:token Stripe intent + paid-display gates.
 * Distinct from CRM invoicePaymentMath (#88), publicInvoiceMath due (#100),
 * and invoicePaymentStatus (#124).
 */

/**
 * Create a PaymentIntent only after amount_due_cents is known and Number(...) > 0.
 * NaN is not <= 0, so a non-numeric due still starts an intent (current PayInvoice.jsx).
 */
export function shouldStartPaymentIntent(amountDueCents) {
  if (amountDueCents == null) return false;
  if (Number(amountDueCents) <= 0) return false;
  return true;
}

/**
 * Paid banner uses Number(amountDueCents || 0) <= 0.
 * Falsy values (null / '' / NaN / 0) collapse to 0 and look paid.
 * A truthy non-numeric string ('abc') stays unpaid because Number('abc') is NaN.
 */
export function isInvoiceAlreadyPaid(amountDueCents) {
  return Number(amountDueCents || 0) <= 0;
}
