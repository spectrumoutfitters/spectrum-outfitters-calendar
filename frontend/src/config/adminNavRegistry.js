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

export const ADMIN_LEGACY_TAB_TARGETS = {
  overview: { main: 'overview' },
  grand_opening: { main: 'grand_opening' },
  status: { main: 'people', sub: 'status' },
  schedule: { main: 'people', sub: 'schedule' },
  time: { main: 'people', sub: 'time' },
  users: { main: 'people', sub: 'users' },
  worklist: { main: 'people', sub: 'worklist' },
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
  customer_booking: { main: 'settings', sub: 'customer_booking' },
  security: { main: 'settings', sub: 'security' },
  updates: { main: 'settings', sub: 'updates' },
};

function isValidAdminMain(main) {
  return ADMIN_MAIN_TABS_ADMIN.some((tab) => tab.id === main);
}

function isValidAdminSub(main, sub) {
  return !!sub && !!ADMIN_SUB_TABS[main]?.some((tab) => tab.id === sub);
}

/**
 * Resolve both the new Jump Palette URL shape and old dashboard/worklist links.
 *
 * @param {URLSearchParams} searchParams
 * @returns {{ main: string; sub?: string; paramsToDelete: string[] } | null}
 */
export function resolveAdminDeepLink(searchParams) {
  const adm = searchParams.get('adm');
  if (adm) {
    if (!isValidAdminMain(adm)) return null;
    const adsub = searchParams.get('adsub');
    return {
      main: adm,
      ...(isValidAdminSub(adm, adsub) ? { sub: adsub } : {}),
      paramsToDelete: ['adm', 'adsub'],
    };
  }

  const legacyTab = searchParams.get('tab');
  if (!legacyTab) return null;
  const target = ADMIN_LEGACY_TAB_TARGETS[legacyTab];
  if (!target || !isValidAdminMain(target.main)) return null;
  return {
    ...target,
    paramsToDelete: ['tab'],
  };
}
