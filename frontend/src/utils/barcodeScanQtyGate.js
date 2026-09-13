/**
 * BarcodeScannerModal camera + qty gates.
 * Distinct from backend inventory qty (#107), admin save/qty (#125),
 * ad-hoc scan-out (#110), and return qty (#91).
 *
 * Camera: secure context OR hostname === 'localhost' (127.0.0.1 is not
 * treated as localhost here — current isSecure() behavior).
 */

export function isBarcodeScannerAllowed({ isSecureContext, hostname } = {}) {
  return isSecureContext === true || hostname === 'localhost';
}

export function parseUseOnTaskQuantity(raw) {
  const qty = parseFloat(raw);
  if (!qty || qty <= 0) {
    return { error: 'Enter a valid quantity' };
  }
  return { quantity: qty };
}

export function parseUseOnTaskSubmit({ taskId, qtyRaw }) {
  if (!taskId) {
    return { error: 'Please select a task' };
  }
  return parseUseOnTaskQuantity(qtyRaw);
}

/** Batch receive: parseFloat || 0, then drop non-positive quantities. */
export function parseBatchReceiveItems(batchItems) {
  return batchItems
    .map((b) => ({ item_id: b.item.id, quantity: parseFloat(b.qty) || 0 }))
    .filter((b) => b.quantity > 0);
}
