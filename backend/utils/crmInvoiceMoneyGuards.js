/** Reject negative CRM invoice money fields (line items and header tax). */

export function assertNonNegativeInvoiceMoney(unitPriceCents, totalCents) {
  if (unitPriceCents != null && Number(unitPriceCents) < 0) {
    return { ok: false, error: 'unit_price_cents must be >= 0' };
  }
  if (totalCents != null && Number(totalCents) < 0) {
    return { ok: false, error: 'total_cents must be >= 0' };
  }
  return { ok: true };
}

/** @param {unknown} taxCents */
export function assertNonNegativeTaxCents(taxCents) {
  if (taxCents != null && Number(taxCents) < 0) {
    return { ok: false, error: 'tax_cents must be >= 0' };
  }
  return { ok: true };
}
