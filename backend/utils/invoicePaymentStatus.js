/**
 * CRM invoice payment_status from paid vs total cents.
 * Shared by payments.js (manual record), crm.js (total refresh), and
 * stripePayments.js (webhook). Distinct from frontend invoicePaymentMath
 * display (#88) and public-invoice due/cents (#100).
 *
 * `total > 0` is required for 'paid': a $0 invoice with any paid amount
 * stays 'partial', not 'paid'. Zero/zero is 'unpaid'.
 */
export function invoicePaymentStatus(paid, total) {
  return paid >= total && total > 0 ? 'paid' : paid > 0 ? 'partial' : 'unpaid';
}
