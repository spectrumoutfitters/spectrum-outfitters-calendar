/**
 * Merge newly added default nav keys into a saved order at each key's default index.
 * Shared by Settings.jsx (admin editor) and Sidebar.jsx (live nav).
 * Backend DEFAULT_NAV_ORDER matches SETTINGS (includes mylist, no dispatch/crm/grand_opening).
 * Sidebar DEFAULT includes dispatch/crm/grand_opening and omits mylist.
 */

export const SETTINGS_DEFAULT_NAV_ORDER = [
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

export const SIDEBAR_DEFAULT_NAV_ORDER = [
  'dashboard',
  'dispatch',
  'tasks',
  'time',
  'schedule',
  'inventory',
  'products',
  'crm',
  'profile',
  'admin',
  'grand_opening'
];

export function mergeNavOrder(saved, defaults) {
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
