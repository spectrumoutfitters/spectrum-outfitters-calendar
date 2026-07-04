/**
 * Single source of truth for Admin area primary + secondary tabs (Overview → Settings).
 * Used by Admin.jsx and JumpPalette so labels stay in sync.
 */

export const ADMIN_MAIN_TABS_ADMIN = [
  { id: 'overview', label: 'Overview' },
  { id: 'grand_opening', label: 'Grand Opening Day' },
  { id: 'people', label: 'People' },
  { id: 'inventory', label: 'Inventory' },
  { id: 'finance', label: 'Finance' },
  { id: 'settings', label: 'Settings' },
];

export const ADMIN_MAIN_TABS_EMPLOYEE = [{ id: 'grand_opening', label: 'Grand Opening Day' }];

/** @type {Record<string, Array<{ id: string; label: string }>>} */
export const ADMIN_SUB_TABS = {
  people: [
    { id: 'status', label: 'Status' },
    { id: 'schedule', label: 'Schedule' },
    { id: 'time', label: 'Time' },
    { id: 'users', label: 'Users' },
    { id: 'worklist', label: 'Worklist' },
    { id: 'history', label: 'History' },
  ],
  inventory: [
    { id: 'inventory', label: 'Inventory' },
    { id: 'orders', label: 'Orders' },
    { id: 'products', label: 'Products' },
  ],
  finance: [
    { id: 'payroll', label: 'Payroll' },
    { id: 'paystub_maker', label: 'Pay stub PDF' },
    { id: 'shop_financing', label: 'Shop Financing' },
    { id: 'finance', label: 'P&L / Summary' },
    { id: 'analytics', label: 'Analytics' },
    { id: 'reports', label: 'Reports' },
    { id: 'compliance', label: 'Compliance' },
  ],
  settings: [
    { id: 'general', label: 'General' },
    { id: 'customer_booking', label: 'Customer booking' },
    { id: 'security', label: 'Security' },
    { id: 'updates', label: 'Updates' },
  ],
};

const LEGACY_ADMIN_TAB_MAP = {
  dashboard: { main: 'overview' },
  overview: { main: 'overview' },
  grand_opening: { main: 'grand_opening' },

  worklist: { main: 'people', sub: 'worklist' },
  status: { main: 'people', sub: 'status' },
  time: { main: 'people', sub: 'time' },
  users: { main: 'people', sub: 'users' },
  schedule: { main: 'people', sub: 'schedule' },
  history: { main: 'people', sub: 'history' },

  inventory: { main: 'inventory', sub: 'inventory' },
  orders: { main: 'inventory', sub: 'orders' },
  products: { main: 'inventory', sub: 'products' },

  payroll: { main: 'finance', sub: 'payroll' },
  paystub_maker: { main: 'finance', sub: 'paystub_maker' },
  shop_financing: { main: 'finance', sub: 'shop_financing' },
  finance: { main: 'finance', sub: 'finance' },
  analytics: { main: 'finance', sub: 'analytics' },
  reports: { main: 'finance', sub: 'reports' },
  compliance: { main: 'finance', sub: 'compliance' },

  settings: { main: 'settings', sub: 'general' },
  general: { main: 'settings', sub: 'general' },
  customer_booking: { main: 'settings', sub: 'customer_booking' },
  security: { main: 'settings', sub: 'security' },
  updates: { main: 'settings', sub: 'updates' },
};

export function resolveLegacyAdminTab(tabId) {
  const key = `${tabId || ''}`.trim();
  const resolved = LEGACY_ADMIN_TAB_MAP[key];
  return resolved ? { ...resolved } : null;
}
