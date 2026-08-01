/**
 * Pure CRM invoice line-type normalization and cents bucketing.
 * Kept free of Express/DB so unit tests need no sqlite.
 */

export function toInt(v) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n) : null;
}

export function normalizeLineType(v) {
  const t = String(v || '').trim().toLowerCase();
  if (!t) return 'part';
  if (t.startsWith('lab')) return 'labor';
  if (t.startsWith('fee') || t === 'misc') return 'fee';
  if (t.startsWith('tax')) return 'fee';
  if (t.startsWith('par')) return 'part';
  return t;
}

/** Bucket invoice line items into parts / labor / fees (cents). */
export function bucketInvoiceLineCents(items) {
  let parts = 0;
  let labor = 0;
  let fees = 0;

  for (const it of items || []) {
    const cents = toInt(it?.total_cents) || 0;
    const type = normalizeLineType(it?.line_type);
    if (type === 'labor') labor += cents;
    else if (type === 'fee') fees += cents;
    else parts += cents;
  }

  return { parts, labor, fees };
}

export function invoiceTotalCents({ parts, labor, fees }, taxCents) {
  const tax = toInt(taxCents) || 0;
  return parts + labor + fees + tax;
}

/** Mirror payment_status refresh used after recalcInvoiceTotals. */
export function paymentStatusFromPaid(paidCents, totalCents) {
  const paid = toInt(paidCents) || 0;
  const total = toInt(totalCents) || 0;
  return paid >= total && total > 0 ? 'paid' : paid > 0 ? 'partial' : 'unpaid';
}
