/**
 * Parse a physical inventory count before it overwrites on-hand quantity.
 * Distinct from use/receive/return qty helpers (those change stock by delta).
 */

export function parseCountQuantity(quantity) {
  const parsedQuantity = Number.parseFloat(quantity);
  if (!Number.isFinite(parsedQuantity)) {
    return { ok: false, error: 'Quantity must be a number' };
  }
  if (parsedQuantity < 0) {
    return { ok: false, error: 'Quantity cannot be negative' };
  }
  return { ok: true, quantity: parsedQuantity };
}

/**
 * Count endpoint stores trimmed viscosity, or null when omitted/blank.
 * Numeric 0 is kept as the string '0'.
 */
export function normalizeCountViscosity(viscosity) {
  return viscosity !== undefined && viscosity !== null && String(viscosity).trim()
    ? String(viscosity).trim()
    : null;
}
