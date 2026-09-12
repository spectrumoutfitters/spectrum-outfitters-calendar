/** Parse a form number the way Inventory Management does: parseFloat, else null. */
export function parseInventoryNumber(v) {
  const n = Number.parseFloat(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * Validate admin inventory create/edit and build the item payload.
 * Quantity is intentionally not included — the UI applies it after the item save.
 */
export function prepareInventoryAdminPayload(form, { isCreate } = {}) {
  if (isCreate && !(form.barcode || '').trim()) {
    return { error: 'Barcode is required when adding an item. Scan or enter a barcode.' };
  }
  if (!form.name.trim()) {
    return { error: 'Name is required.' };
  }
  if (form.needs_return && !form.return_supplier.trim()) {
    return { error: 'Supplier is required when flagging for return (where was this part bought from?).' };
  }

  const parsedPrice = form.price === '' ? null : parseInventoryNumber(form.price);
  if (form.price !== '' && parsedPrice === null) {
    return { error: 'Price must be a number.' };
  }
  const parsedReorderCost = form.reorder_cost === '' ? null : parseInventoryNumber(form.reorder_cost);
  if (form.reorder_cost !== '' && parsedReorderCost === null) {
    return { error: 'Reorder cost must be a number.' };
  }

  const payload = {
    barcode: form.barcode.trim() || null,
    name: form.name.trim(),
    category_id: form.category_id ? Number(form.category_id) : null,
    unit: form.unit.trim() || 'each',
    price: parsedPrice,
    image_url: form.image_url && form.image_url.trim() ? form.image_url.trim() : undefined,
    needs_return: form.needs_return,
    return_supplier: form.return_supplier.trim() || null,
    size_per_unit: form.size_per_unit.trim() || null,
    min_quantity: form.min_quantity.trim() === '' ? null : parseInventoryNumber(form.min_quantity),
    keep_in_stock: form.keep_in_stock,
    location: form.location.trim() || null,
    location_notes: form.location_notes.trim() || null,
    preferred_vendor: form.preferred_vendor.trim() || null,
    supplier_name: form.supplier_name.trim() || null,
    supplier_contact: form.supplier_contact.trim() || null,
    supplier_part_number: form.supplier_part_number.trim() || null,
    reorder_cost: parsedReorderCost,
    amazon_asin: form.amazon_asin.trim() || null,
    amazon_url: form.amazon_url.trim() || null,
  };

  if (payload.price !== null && payload.price !== undefined && !Number.isFinite(payload.price)) {
    return { error: 'Price must be a number.' };
  }

  return { payload };
}

/** Optional quantity change after the item row exists. Empty skips the extra request. */
export function parseInventoryQuantityUpdate(raw) {
  if (raw === '') return { skip: true };
  const qNum = parseInventoryNumber(raw);
  if (qNum === null || qNum < 0) {
    return { error: 'Quantity must be a non-negative number.' };
  }
  return { quantity: qNum };
}
