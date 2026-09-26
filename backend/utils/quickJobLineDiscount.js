/**
 * Apply a quick-job line discount to a cent total.
 *
 * Admin UI stores "$ off line" as dollars (the number typed next to Unit $)
 * and "% off line" as a percent. Line totals are cents.
 *
 * @param {number} totalCents
 * @param {string|null|undefined} discountType 'percent' | 'amount' | other
 * @param {number|string|null|undefined} discountValue
 * @returns {number}
 */
export function applyQuickJobLineDiscount(totalCents, discountType, discountValue) {
  const total = Number(totalCents);
  if (!Number.isFinite(total)) return 0;

  const type = discountType == null ? '' : String(discountType);
  const dv = Number(discountValue);
  if (!type || !Number.isFinite(dv)) return total;

  if (type === 'percent') {
    return Math.max(0, Math.round(total * (1 - dv / 100)));
  }
  if (type === 'amount') {
    const offCents = Math.round(dv * 100);
    return Math.max(0, total - offCents);
  }
  return total;
}
