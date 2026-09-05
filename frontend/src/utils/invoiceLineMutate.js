/**
 * Invoice editor mutation coercions (tax / manual payment / add-line).
 * Distinct from invoicePaymentMath display/balance helpers.
 */

/** Empty draft → 0; otherwise Number + round, non-finite → 0. Negatives are kept. */
export function taxCentsFromDraft(taxDraft) {
  const cents = taxDraft.trim() === '' ? 0 : Number(taxDraft);
  return Number.isFinite(cents) ? Math.round(cents) : 0;
}

/**
 * Dollars string → cents, or null when parseFloat is non-finite.
 * Caller rejects `!cents || cents <= 0` (0 / null / negatives fail; no weekly fallback).
 */
export function manualPaymentCentsFromDollars(manualAmount) {
  const dollars = Number.parseFloat(manualAmount || '');
  return Number.isFinite(dollars) ? Math.round(dollars * 100) : null;
}

export function isRejectedManualPaymentCents(cents) {
  return !cents || cents <= 0;
}

/** Number(qty); non-finite → 1. Empty string is Number('') === 0 (kept, not defaulted). */
export function invoiceAddItemQuantity(quantity) {
  const qty = Number(quantity);
  return Number.isFinite(qty) ? qty : 1;
}

/** Number(unit) dollars → rounded cents; non-finite → null. Empty string → 0. */
export function invoiceAddItemUnitCents(unitPrice) {
  const unit = Number(unitPrice);
  return Number.isFinite(unit) ? Math.round(unit * 100) : null;
}
