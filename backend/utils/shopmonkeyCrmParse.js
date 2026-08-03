/**
 * Pure ShopMonkey → CRM field parsing helpers (no DB / ShopMonkey client).
 */

export function pickId(...candidates) {
  for (const c of candidates) {
    if (c == null) continue;
    const s = String(c).trim();
    if (s) return s;
  }
  return null;
}

export function pickCustomerId(order) {
  return pickId(
    order?.customerId,
    order?.customer_id,
    order?.customer?.id,
    order?.customer?.customerId,
    order?.customer?.customer_id
  );
}

export function pickVehicleId(order) {
  return pickId(
    order?.vehicleId,
    order?.vehicle_id,
    order?.vehicle?.id,
    order?.vehicle?.vehicleId,
    order?.vehicle?.vehicle_id
  );
}

export function pickOrderId(order) {
  return pickId(order?.id, order?._id, order?.orderId, order?.order_id);
}

export function formatCustomerName(customer) {
  const name = pickId(customer?.name, customer?.displayName, customer?.fullName);
  if (name) return name;
  const first = pickId(customer?.firstName, customer?.first_name);
  const last = pickId(customer?.lastName, customer?.last_name);
  return [first, last].filter(Boolean).join(' ') || null;
}

export function extractLineItemFields(li) {
  const id = pickId(li?.id, li?._id, li?.lineItemId, li?.line_item_id);
  const description = pickId(li?.name, li?.description, li?.title, li?.displayName, li?.itemName) || null;
  const lineType = pickId(li?.type, li?.lineType, li?.line_type, li?.kind) || null;
  const partNumber =
    pickId(li?.partNumber, li?.part_number, li?.sku, li?.vendorPartNumber, li?.supplierPartNumber) || null;

  const quantityRaw = li?.quantity ?? li?.qty ?? li?.units;
  const quantity = quantityRaw != null && quantityRaw !== '' ? Number.parseFloat(quantityRaw) : null;

  const unitPriceCentsRaw = li?.unitPriceCents ?? li?.unit_price_cents ?? li?.priceCents ?? li?.price_cents;
  const unitPriceCents =
    unitPriceCentsRaw != null && unitPriceCentsRaw !== '' ? Number.parseInt(unitPriceCentsRaw, 10) : null;

  const totalCentsRaw = li?.totalCents ?? li?.total_cents ?? li?.amountCents ?? li?.amount_cents;
  const totalCents = totalCentsRaw != null && totalCentsRaw !== '' ? Number.parseInt(totalCentsRaw, 10) : null;

  return {
    shopmonkey_line_item_id: id,
    line_type: lineType,
    description,
    part_number: partNumber,
    quantity: Number.isFinite(quantity) ? quantity : null,
    unit_price_cents: Number.isFinite(unitPriceCents) ? unitPriceCents : null,
    total_cents: Number.isFinite(totalCents) ? totalCents : null,
  };
}

/**
 * Walk nested ShopMonkey list responses and return the first orders-like array.
 * Handles circular references without throwing.
 */
export function normalizeOrdersArray(response) {
  const seen = new Set();
  const walk = (v) => {
    if (v == null) return null;
    if (Array.isArray(v)) return v;
    if (typeof v !== 'object') return null;
    if (seen.has(v)) return null;
    seen.add(v);

    for (const key of ['orders', 'items', 'results', 'data']) {
      if (Object.prototype.hasOwnProperty.call(v, key)) {
        const arr = walk(v[key]);
        if (arr) return arr;
      }
    }
    return null;
  };

  const arr = walk(response);
  return Array.isArray(arr) ? arr : [];
}
