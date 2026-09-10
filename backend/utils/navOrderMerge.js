/**
 * Merge newly added default nav keys into a saved order at each key's default index.
 * Extracted from routes/settings.js — keep splice-by-default-index behavior identical.
 */

export const DEFAULT_NAV_ORDER = [
  'dashboard',
  'mylist',
  'tasks',
  'time',
  'schedule',
  'inventory',
  'products',
  'profile',
  'admin'
];

export function mergeNavOrder(saved, defaults = DEFAULT_NAV_ORDER) {
  let order = Array.isArray(saved) ? [...saved] : [...defaults];
  const missing = defaults.filter((k) => !order.includes(k));
  if (missing.length > 0) {
    for (const key of missing) {
      const defaultIdx = defaults.indexOf(key);
      const insertAt = Math.min(defaultIdx, order.length);
      order.splice(insertAt, 0, key);
    }
  }
  return order;
}
