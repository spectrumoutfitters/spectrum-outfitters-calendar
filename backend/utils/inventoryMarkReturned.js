/**
 * Decide how "mark returned" should change on-hand quantity.
 *
 * request-return stores return_quantity when multiple units are on the SKU.
 * mark-returned used to set returned_at on the whole row (hiding remaining stock)
 * and delete every task usage row for that item. Partial returns must decrement
 * only the flagged units and keep the rest in stock.
 */
export function decideMarkReturned({ quantity, returnQuantity } = {}) {
  const onHand = Number(quantity);
  const currentQty = Number.isFinite(onHand) && onHand > 0 ? onHand : 0;

  const rawReturn = returnQuantity == null || returnQuantity === '' ? null : Number(returnQuantity);
  const requested =
    rawReturn != null && Number.isFinite(rawReturn) && rawReturn > 0
      ? Math.floor(rawReturn)
      : currentQty;

  const qtyToRemove = Math.min(Math.max(0, requested), currentQty);
  const quantityAfter = Math.max(0, currentQty - qtyToRemove);
  const fullyReturned = quantityAfter <= 0;

  return {
    qtyToRemove,
    quantityAfter,
    fullyReturned,
    unlinkTaskUsage: fullyReturned,
    setReturnedAt: fullyReturned
  };
}
