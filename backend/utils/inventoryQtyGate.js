/**
 * Inventory stock *delta* gates (receive / use-on-task / batch-receive / new-item).
 * Distinct from count overwrite (#101), request-return qty (#91), and
 * mark-returned leftover (#92).
 */

/** Refill receive: empty/null/'' → missing; 0 is allowed; negatives are not. */
export function parseReceiveQuantity(quantityReceived) {
  const qty =
    quantityReceived === undefined || quantityReceived === null || quantityReceived === ''
      ? null
      : Number.parseFloat(quantityReceived);
  if (qty === null || !Number.isFinite(qty) || qty < 0) {
    return { ok: false, error: 'quantity_received must be a non-negative number' };
  }
  return { ok: true, quantity: qty };
}

/** pending/ordered (and any other non-terminal) can receive; received/cancelled cannot. */
export function refillReceiveStatusGate(status) {
  if (status === 'received') {
    return { ok: false, error: 'This refill was already received' };
  }
  if (status === 'cancelled') {
    return { ok: false, error: 'Cannot receive a cancelled request' };
  }
  return { ok: true };
}

export function stockAfterReceive(currentQuantity, qty) {
  return (currentQuantity ?? 0) + qty;
}

/**
 * Use-on-task / batch-receive id: `value != null ? Number(value) : null`,
 * then `!id || !Number.isFinite(id)` — numeric `0` is missing; negatives pass.
 */
export function parseRequiredPositiveId(raw, field) {
  const id = raw != null ? Number(raw) : null;
  if (!id || !Number.isFinite(id)) {
    return { ok: false, error: `${field} is required` };
  }
  return { ok: true, id };
}

/** Use-on-task: must be a positive finite number (0 is rejected, unlike receive). */
export function parseUseOnTaskQuantity(quantityUsedRaw) {
  const quantityUsed = Number.parseFloat(quantityUsedRaw);
  if (!Number.isFinite(quantityUsed) || quantityUsed <= 0) {
    return { ok: false, error: 'quantity_used must be a positive number' };
  }
  return { ok: true, quantity: quantityUsed };
}

/** Over-use is allowed: stock floors at 0, never goes negative. */
export function stockAfterUse(currentQuantity, quantityUsed) {
  return Math.max(0, (currentQuantity ?? 0) - quantityUsed);
}

/**
 * Batch-receive one row. Invalid ids/qty are skipped (not 400):
 * `!itemId` (0 missing) or non-finite / qty <= 0.
 */
export function parseBatchReceiveEntry(entry) {
  const itemId = entry?.item_id != null ? Number(entry.item_id) : null;
  const qty = Number.parseFloat(entry?.quantity);
  if (!itemId || !Number.isFinite(itemId) || !Number.isFinite(qty) || qty <= 0) {
    return null;
  }
  return { itemId, qty };
}

export function parseBatchReceiveItems(items) {
  if (!Array.isArray(items) || items.length === 0) {
    return { ok: false, error: 'items array is required' };
  }
  return { ok: true, items };
}

/** New-item request: trimmed name required; blank notes/barcode become null. */
export function parseNewItemRequest({ item_name, notes, barcode } = {}) {
  const name = (item_name || '').trim();
  if (!name) {
    return { ok: false, error: 'Item name is required' };
  }
  return {
    ok: true,
    name,
    notes: (notes || '').trim() || null,
    barcode: (barcode || '').trim() || null,
  };
}

/** PATCH may only move to addressed/dismissed — not pending. */
export function parseNewItemRequestStatus(status) {
  if (!['addressed', 'dismissed'].includes(status)) {
    return { ok: false, error: 'status must be addressed or dismissed' };
  }
  return { ok: true, status };
}
