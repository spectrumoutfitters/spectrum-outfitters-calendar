/**
 * Normalize and validate order line quantities/prices before any destructive writes.
 * @param {Array<{ product_id?: unknown, quantity?: unknown, price?: unknown }>} items
 * @returns {{ ok: true, lines: Array<{ product_id: unknown, quantity: number, priceOverride: number|null }> } | { ok: false, error: string }}
 */
export function validateOrderItemLines(items) {
  if (!Array.isArray(items) || items.length === 0) {
    return { ok: false, error: 'Order must contain at least one item' };
  }
  const lines = [];
  for (const item of items) {
    if (!item || item.product_id == null || item.product_id === '') {
      return { ok: false, error: 'Each item requires product_id' };
    }
    const quantity = Number(item.quantity);
    if (!Number.isInteger(quantity) || quantity <= 0) {
      return { ok: false, error: 'Each item quantity must be a positive integer' };
    }
    let priceOverride = null;
    if (item.price !== undefined) {
      const p = Number.parseFloat(item.price);
      if (!Number.isFinite(p) || p < 0) {
        return { ok: false, error: 'Item price must be a non-negative number' };
      }
      priceOverride = p;
    }
    lines.push({ product_id: item.product_id, quantity, priceOverride });
  }
  return { ok: true, lines };
}
