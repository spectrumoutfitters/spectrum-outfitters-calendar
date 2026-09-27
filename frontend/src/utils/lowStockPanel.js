/** Quantity shown on a low-stock row. Null and undefined display as 0. */
export function lowStockDisplayQuantity(quantity) {
  return quantity ?? 0;
}

/** Out of stock when the displayed quantity is zero or negative. */
export function lowStockIsOut(quantity) {
  return lowStockDisplayQuantity(quantity) <= 0;
}

export function lowStockAlreadyRequested(id, reorderedIds) {
  return reorderedIds.has(id);
}

/** Items that still need a refill request. Ids already in the set are skipped. */
export function lowStockStillNeedsReorder(items, reorderedIds) {
  return (items || []).filter((it) => !lowStockAlreadyRequested(it.id, reorderedIds));
}
