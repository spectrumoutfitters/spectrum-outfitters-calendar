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

export const DEFAULT_ADMIN_SUB_TABS = {
  people: 'status',
  inventory: 'inventory',
  finance: 'payroll',
  settings: 'general',
};

const LEGACY_ADMIN_TAB_TARGETS = {
  overview: { main: 'overview' },
  grand_opening: { main: 'grand_opening' },
  team: { main: 'people', sub: 'status' },
  people: { main: 'people', sub: 'status' },
  status: { main: 'people', sub: 'status' },
  schedule: { main: 'people', sub: 'schedule' },
  time: { main: 'people', sub: 'time' },
  users: { main: 'people', sub: 'users' },
  worklist: { main: 'people', sub: 'worklist' },
  history: { main: 'people', sub: 'history' },
  shop: { main: 'inventory', sub: 'inventory' },
  inventory: { main: 'inventory', sub: 'inventory' },
  orders: { main: 'inventory', sub: 'orders' },
  products: { main: 'inventory', sub: 'products' },
  insights: { main: 'finance', sub: 'finance' },
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

export function isAdminMainTab(id) {
  return ADMIN_MAIN_TABS_ADMIN.some((tab) => tab.id === id);
}

export function isAdminSubTab(main, sub) {
  return !!ADMIN_SUB_TABS[main]?.some((tab) => tab.id === sub);
}

/**
 * Resolve current or legacy Admin destinations into the nested tab model.
 * Legacy `/admin?tab=...` links are still emitted by backend worklist items,
 * dashboard shortcuts, and older saved localStorage values.
 */
export function resolveAdminNavTarget(mainOrLegacy, sub) {
  const main = `${mainOrLegacy || ''}`.trim();
  const secondary = `${sub || ''}`.trim();
  if (!main) return null;

  if (isAdminMainTab(main)) {
    if (isAdminSubTab(main, secondary)) return { main, sub: secondary };
    return { main, sub: DEFAULT_ADMIN_SUB_TABS[main] };
  }

  const legacy = LEGACY_ADMIN_TAB_TARGETS[main];
  if (!legacy || !isAdminMainTab(legacy.main)) return null;

  const legacySub = isAdminSubTab(legacy.main, secondary) ? secondary : legacy.sub;
  return { main: legacy.main, sub: legacySub };
}
