/**
 * Shared inventory stock display helpers (employee Inventory + admin InventoryManagement).
 * Levels drive grouping, attention counts, and tile colors.
 */

export const LEVEL_ORDER = ['return_needed', 'out', 'low', 'ok', 'no_min'];

export const ATTENTION_LEVELS = new Set(['return_needed', 'out', 'low']);

// For fluids: when size_per_unit is set (e.g. "32" or "32 oz"), show actual amount.
// E.g. 0.5 of a 32 oz bottle = 16 oz.
export function formatQuantityWithSize(item) {
  const q = item?.quantity;
  const u = item?.unit || 'each';
  const s = item?.size_per_unit;
  const base = `${q ?? 0} ${u}`;
  if (s == null || s === '' || q == null) return base;
  const match = String(s).trim().match(/^([\d.]+)\s*(.*)$/);
  if (!match) return base;
  const sizeNum = parseFloat(match[1]);
  let suffix = (match[2] || '').trim();
  if (!Number.isFinite(sizeNum)) return base;
  const equiv = q * sizeNum;
  const equivStr = Number.isInteger(equiv) ? String(equiv) : equiv.toFixed(1).replace(/\.0$/, '');
  if (!suffix) suffix = 'oz';
  return `${equivStr} ${suffix} (${q} of ${sizeNum} ${suffix})`;
}

/** Inventory level for grouping: return_needed, out, low, ok, no_min (no min set) */
export function getInventoryLevel(item) {
  const needsReturn = Boolean(item?.needs_return) && !item?.returned_at;
  if (needsReturn) return 'return_needed';
  const q = item?.quantity ?? 0;
  const min = item?.min_quantity;
  if (min == null || min === '') return 'no_min';
  if (q <= 0) return 'out';
  if (q < min) return 'low';
  return 'ok';
}

/**
 * Tile border/background classes from stock level.
 * Includes dark: variants (no-op in light mode).
 */
export function getTileColorClass(item) {
  const needsReturn = Boolean(item?.needs_return) && !item?.returned_at;
  if (needsReturn) return 'border-2 border-orange-500 bg-orange-100 dark:bg-orange-900/30 dark:border-orange-600';
  const q = item?.quantity ?? 0;
  const min = item?.min_quantity;
  if (min == null || min === '') return 'border-gray-200 dark:border-neutral-700';
  if (q <= 0) return 'border-red-300 bg-red-50 dark:bg-red-900/20 dark:border-red-700';
  if (q < min) return 'border-amber-300 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-700';
  return 'border-green-300 bg-green-50 dark:bg-green-900/20 dark:border-green-700';
}
