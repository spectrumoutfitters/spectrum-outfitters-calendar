/**
 * Quick Jobs admin save/display money + active-flag coercion.
 * Distinct from CRM invoice paid/due math (#88) and OrderManagement qty||1 (#105).
 */

/** sqlite `0` is inactive; boolean `false` and `'0'` still count as active (`!== 0`). */
export function isQuickJobActive(isActive) {
  return isActive !== 0;
}

/** Dollar text → integer cents; non-finite (blank, letters) → null. */
export function dollarsInputToCents(val) {
  const num = Number.parseFloat(val);
  return Number.isFinite(num) ? Math.round(num * 100) : null;
}

export function centsToDollarInput(unitPriceCents) {
  return unitPriceCents != null ? (Number(unitPriceCents) / 100).toFixed(2) : '';
}

/**
 * Save payload: `color || null`, `!!is_active`, `Number(sort_order) || 0`,
 * and `value != null ? Number(value) : null` for qty/cents/discount
 * (`''` is not nullish → Number('') === 0).
 */
export function coerceQuickJobSavePayload(editing) {
  return {
    name: editing.name,
    color: editing.color || null,
    is_active: !!editing.is_active,
    sort_order: Number(editing.sort_order) || 0,
    items: (editing.items || []).map((it) => ({
      ...it,
      quantity: it.quantity != null ? Number(it.quantity) : null,
      unit_price_cents: it.unit_price_cents != null ? Number(it.unit_price_cents) : null,
      discount_value: it.discount_value != null ? Number(it.discount_value) : null,
    })),
  };
}
