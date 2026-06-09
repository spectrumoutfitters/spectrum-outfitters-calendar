import assert from 'node:assert/strict';
import test from 'node:test';

import {
  DEFAULT_ADMIN_SUB_TABS,
  isAdminMainTab,
  isAdminSubTab,
  resolveAdminNavTarget,
} from './adminNavRegistry.js';

test('resolves legacy flat admin tab links into nested tab targets', () => {
  assert.deepEqual(resolveAdminNavTarget('worklist'), { main: 'people', sub: 'worklist' });
  assert.deepEqual(resolveAdminNavTarget('time'), { main: 'people', sub: 'time' });
  assert.deepEqual(resolveAdminNavTarget('inventory'), { main: 'inventory', sub: 'inventory' });
  assert.deepEqual(resolveAdminNavTarget('orders'), { main: 'inventory', sub: 'orders' });
  assert.deepEqual(resolveAdminNavTarget('payroll'), { main: 'finance', sub: 'payroll' });
  assert.deepEqual(resolveAdminNavTarget('compliance'), { main: 'finance', sub: 'compliance' });
  assert.deepEqual(resolveAdminNavTarget('settings'), { main: 'settings', sub: 'general' });
});

test('resolves current admin deep links and validates their sub tabs', () => {
  assert.deepEqual(resolveAdminNavTarget('finance', 'paystub_maker'), {
    main: 'finance',
    sub: 'paystub_maker',
  });
  assert.deepEqual(resolveAdminNavTarget('finance', 'not-a-sub-tab'), {
    main: 'finance',
    sub: DEFAULT_ADMIN_SUB_TABS.finance,
  });
  assert.deepEqual(resolveAdminNavTarget('overview'), { main: 'overview', sub: undefined });
});

test('rejects unknown admin destinations', () => {
  assert.equal(resolveAdminNavTarget('messages'), null);
  assert.equal(resolveAdminNavTarget(''), null);
  assert.equal(isAdminMainTab('payroll'), false);
  assert.equal(isAdminSubTab('finance', 'payroll'), true);
});
