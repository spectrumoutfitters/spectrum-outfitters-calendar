/**
 * Task-modal inventory link quantity.
 * Fluids/consumables post parseFloat(qty) || null (0 / NaN → null); omitted qty → null.
 * Discrete parts always post 1, ignoring the qty field.
 */

export function isFluidOrConsumable(item) {
  const cat = (item?.category_name || '').toLowerCase();
  const unit = (item?.unit || item?.item_unit || '').toLowerCase();
  return cat.includes('oil') || cat.includes('fluid') || cat.includes('cleaning') ||
    unit.includes('oz') || unit.includes('qt') || unit.includes('gal') || unit.includes('bottle') || unit.includes('can');
}

export function quantityUsedForLink(item, qtyInput) {
  const isFluid = isFluidOrConsumable(item);
  return isFluid && qtyInput !== undefined && qtyInput !== '' && qtyInput !== null
    ? (parseFloat(qtyInput) || null)
    : (isFluid ? null : 1);
}

/** PATCH quantity_used: blank / null → null; otherwise parseFloat (0 kept, non-numeric → NaN). */
export function quantityUsedForUpdate(newQty) {
  return newQty === '' || newQty === null ? null : parseFloat(newQty);
}
