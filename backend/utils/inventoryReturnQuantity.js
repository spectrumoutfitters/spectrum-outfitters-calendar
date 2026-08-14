/**
 * Pure helpers for POST /api/inventory/items/:id/request-return quantity rules.
 * Extracted from routes/inventory.js — keep behavior identical.
 */

export function currentInventoryQuantity(quantity) {
  return quantity != null ? Number(quantity) : 0;
}

/**
 * Optional return_quantity when multiple units are on hand.
 *
 * Quirks preserved from the route:
 * - Exceed-on-hand check only runs when currentQty > 1 (qty of 1 can request more than on hand).
 * - Omitted qty with currentQty <= 1 stores null; notification text still uses effective 1.
 * - Decimals are floored after the exceed check (which uses the raw parse).
 */
export function parseInventoryReturnQuantity(returnQtyRaw, currentQty) {
  let returnQty = null;
  if (returnQtyRaw !== undefined && returnQtyRaw !== null && returnQtyRaw !== '') {
    const parsed = Number.parseFloat(returnQtyRaw);
    if (!Number.isFinite(parsed) || parsed < 1) {
      return { error: 'Return quantity must be at least 1.' };
    }
    if (currentQty > 1 && parsed > currentQty) {
      return { error: `Return quantity cannot exceed current quantity (${currentQty}).` };
    }
    returnQty = Math.floor(parsed);
  }
  if (currentQty > 1 && (returnQty == null || returnQty < 1)) {
    return { error: 'Please specify how many need to be returned.' };
  }
  const effectiveReturnQty = returnQty != null ? returnQty : (currentQty >= 1 ? 1 : 1);
  return { returnQty, effectiveReturnQty };
}
