/**
 * Route-param coerce used by payments invoice/customer endpoints.
 * Mirrors `const id = raw != null ? Number(raw) : null; if (!id || !Number.isFinite(id))`.
 * Rejects missing / 0 / NaN; accepts negatives and non-integers (e.g. 1.5).
 */

export function parsePaymentRouteId(raw) {
  const id = raw != null ? Number(raw) : null;
  if (!id || !Number.isFinite(id)) return { ok: false };
  return { ok: true, id };
}

/** Falsy pmId (including 0 / "") is missing; any other value is String(pmId). */
export function parsePaymentMethodId(raw) {
  return raw ? String(raw) : null;
}

export function requirePaymentRouteId(raw, missingError) {
  const parsed = parsePaymentRouteId(raw);
  if (!parsed.ok) return { ok: false, error: missingError };
  return parsed;
}

export function requireCustomerAndPaymentMethod(customerRaw, pmRaw) {
  const customer = parsePaymentRouteId(customerRaw);
  const pmId = parsePaymentMethodId(pmRaw);
  if (!customer.ok || !pmId) {
    return { ok: false, error: 'Customer id and payment method id are required' };
  }
  return { ok: true, crmCustomerId: customer.id, pmId };
}
