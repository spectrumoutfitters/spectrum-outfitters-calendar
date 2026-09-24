/**
 * ShopMonkey work-item import selection.
 * Missing `selected` is included. Explicit false is excluded.
 * Non-arrays become an empty selection (nothing imported).
 */

export function shopMonkeySelectionState(workItems) {
  const safe = Array.isArray(workItems) ? workItems : [];
  const items = safe.map((item) => ({ ...item, selected: item.selected !== false }));
  return {
    items,
    selectAll: items.length > 0 && items.every((item) => item.selected !== false),
  };
}

export function toggleShopMonkeySelection(items, index) {
  const updated = items.map((item) => ({ ...item }));
  updated[index].selected = !updated[index].selected;
  return {
    items: updated,
    selectAll: updated.every((item) => item.selected),
  };
}

export function applyShopMonkeySelectAll(items, selectAll) {
  const next = !selectAll;
  return {
    selectAll: next,
    items: items.map((item) => ({ ...item, selected: next })),
  };
}

export function confirmedShopMonkeyItems(items) {
  return (items || []).filter((item) => item.selected);
}
