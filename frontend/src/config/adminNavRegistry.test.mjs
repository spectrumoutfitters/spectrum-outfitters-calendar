import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  ADMIN_MAIN_TABS_ADMIN,
  ADMIN_SUB_TABS,
  resolveLegacyAdminTab,
} from './adminNavRegistry.js';

describe('resolveLegacyAdminTab', () => {
  it('maps shipped flat admin links to nested admin tabs', () => {
    const cases = {
      dashboard: { main: 'overview' },
      status: { main: 'people', sub: 'status' },
      time: { main: 'people', sub: 'time' },
      worklist: { main: 'people', sub: 'worklist' },
      schedule: { main: 'people', sub: 'schedule' },
      inventory: { main: 'inventory', sub: 'inventory' },
      products: { main: 'inventory', sub: 'products' },
      orders: { main: 'inventory', sub: 'orders' },
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

    for (const [legacy, expected] of Object.entries(cases)) {
      assert.deepEqual(resolveLegacyAdminTab(legacy), expected, legacy);
    }
  });

  it('only resolves destinations that exist in the shared registry', () => {
    for (const legacy of [
      'dashboard',
      'status',
      'time',
      'worklist',
      'schedule',
      'inventory',
      'products',
      'orders',
      'payroll',
      'paystub_maker',
      'shop_financing',
      'finance',
      'analytics',
      'reports',
      'compliance',
      'settings',
      'customer_booking',
      'security',
      'updates',
    ]) {
      const resolved = resolveLegacyAdminTab(legacy);
      assert.ok(
        ADMIN_MAIN_TABS_ADMIN.some((tab) => tab.id === resolved.main),
        `${legacy} main tab exists`,
      );
      if (resolved.sub) {
        assert.ok(
          (ADMIN_SUB_TABS[resolved.main] || []).some((tab) => tab.id === resolved.sub),
          `${legacy} sub tab exists`,
        );
      }
    }
  });

  it('ignores unknown legacy tab ids', () => {
    assert.equal(resolveLegacyAdminTab('missing'), null);
    assert.equal(resolveLegacyAdminTab(''), null);
    assert.equal(resolveLegacyAdminTab(null), null);
  });

  it('returns a copy so callers cannot mutate registry state', () => {
    const first = resolveLegacyAdminTab('payroll');
    first.main = 'overview';

    assert.deepEqual(resolveLegacyAdminTab('payroll'), {
      main: 'finance',
      sub: 'payroll',
    });
  });
});
