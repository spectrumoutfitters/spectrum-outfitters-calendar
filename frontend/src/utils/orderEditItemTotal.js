/**
 * Admin order-edit line totals (OrderManagement updateOrderItem).
 * Distinct from backend order-item validation (#73) and paid_at stamps (#103).
 */

/** `quantity || 1` means 0 / '' / null count as 1; parseInt is greedy. */
export function lineItemAmount(item) {
  return parseFloat(item?.price || 0) * parseInt(item?.quantity || 1);
}

export function computeOrderItemsTotal(items) {
  return (items || []).reduce((sum, item) => sum + lineItemAmount(item), 0);
}

/**
 * Apply one field change, optionally copy catalog price when product_id is truthy,
 * then restamp total_amount. Falsy product_id skips the catalog lookup.
 */
export function applyOrderItemEdit(items, index, field, value, products) {
  const newItems = [...(items || [])];
  newItems[index] = { ...newItems[index], [field]: value };

  if (field === 'product_id' && value) {
    const product = (products || []).find((p) => p.id === parseInt(value));
    if (product) {
      newItems[index].price = product.price;
    }
  }

  return { items: newItems, total_amount: computeOrderItemsTotal(newItems) };
}
