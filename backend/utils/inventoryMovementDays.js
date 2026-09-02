/**
 * GET /inventory/movement/summary ?days= coerce.
 * `Math.min(365, Math.max(1, Number(daysRaw || 30)))` — no integer floor.
 * Falsy daysRaw (undefined / null / "" / 0) becomes 30; string "0" becomes 1.
 * Non-numeric strings stay NaN (SQLite then receives "-NaN days").
 */
export function movementSummaryDays(daysRaw) {
  return Math.min(365, Math.max(1, Number(daysRaw || 30)));
}

export function movementSummarySinceExpr(daysRaw) {
  return `-${movementSummaryDays(daysRaw)} days`;
}

/**
 * Low-stock predicate duplicated in /low-stock and movement-summary SQL:
 * (min_quantity IS NOT NULL AND quantity <= min_quantity)
 * OR (min_quantity IS NULL AND quantity < 3)
 */
export function isLowStockItem({ quantity, min_quantity } = {}) {
  if (min_quantity != null) return quantity <= min_quantity;
  return quantity < 3;
}
