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

/**
 * Older Dashboard/worklist links still use /admin?tab=<flat-id>. Resolve those
 * flat ids into the nested admin navigation introduced by the jump palette.
 *
 * @param {string | null | undefined} tabId
 * @returns {{ main: string, sub?: string } | null}
 */
export function resolveLegacyAdminTab(tabId) {
  const id = `${tabId || ''}`.trim();
  if (!id) return null;

  if (id === 'overview' || id === 'grand_opening') return { main: id };

  for (const [main, subs] of Object.entries(ADMIN_SUB_TABS)) {
    if (subs.some((sub) => sub.id === id)) {
      return { main, sub: id };
    }
  }

  if (id === 'settings') return { main: 'settings', sub: 'general' };

  return null;
}
