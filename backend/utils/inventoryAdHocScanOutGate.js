/**
 * Ad-hoc inventory scan-out gates (POST /items/:id/use — not tied to a task).
 * Distinct from use-on-task / batch-receive qty (#107): this path also requires
 * a trimmed reason and a barcode that matches the item (primary or alternate).
 * Kept free of Express/DB so unit tests need no sqlite.
 */

/** Empty / null / whitespace → null; otherwise trimmed string. */
export function normalizeBarcode(raw) {
  if (raw === undefined || raw === null) return null;
  const str = String(raw).trim();
  return str.length ? str : null;
}

/**
 * Parse scan-out body. Qty must be a positive finite number (0 rejected).
 * Reason: undefined/null → ''; whitespace-only fails. Barcode uses normalizeBarcode.
 */
export function parseAdHocScanOut({ quantity_used, reason, barcode } = {}) {
  const quantityUsed = Number.parseFloat(quantity_used);
  if (!Number.isFinite(quantityUsed) || quantityUsed <= 0) {
    return { ok: false, error: 'Quantity to use must be a positive number.' };
  }

  const reasonText = reason !== undefined && reason !== null ? String(reason).trim() : '';
  if (!reasonText) {
    return { ok: false, error: 'Reason is required when scanning out an item not on a task.' };
  }

  const scanned = normalizeBarcode(barcode);
  if (!scanned) {
    return { ok: false, error: 'Scan the item barcode to confirm. Barcode is required.' };
  }

  return { ok: true, quantityUsed, reason: reasonText, barcode: scanned };
}

/** True when the scanned code equals the item primary barcode or an alternate exists. */
export function itemBarcodeMatches(itemBarcode, scanned, hasAlternateMatch) {
  const primary = normalizeBarcode(itemBarcode);
  return primary === scanned || Boolean(hasAlternateMatch);
}
