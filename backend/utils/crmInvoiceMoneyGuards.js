/** Reject negative CRM invoice line money (matches create-path rules). */
export function assertNonNegativeInvoiceMoney(unitPriceCents, totalCents) {
  if (unitPriceCents != null && Number(unitPriceCents) < 0) {
    return { ok: false, error: 'unit_price_cents must be >= 0' };
  }
  if (totalCents != null && Number(totalCents) < 0) {
    return { ok: false, error: 'total_cents must be >= 0' };
  }
  return { ok: true };
}
