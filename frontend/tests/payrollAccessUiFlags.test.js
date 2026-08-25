import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  canTogglePayrollAccess,
  hasPayrollAccessRow,
  isMasterAdminRow,
  payrollAccessButtonLabel,
  sqliteFlagGranted,
} from '../src/utils/payrollAccessUiFlags.js';

describe('sqliteFlagGranted', () => {
  it('treats sqlite 1 and boolean true as granted (unlike AuthContext boolean-true-only)', () => {
    assert.equal(sqliteFlagGranted(1), true);
    assert.equal(sqliteFlagGranted(true), true);
    assert.equal(sqliteFlagGranted(0), false);
    assert.equal(sqliteFlagGranted(false), false);
    assert.equal(sqliteFlagGranted('1'), false);
    assert.equal(sqliteFlagGranted('true'), false);
    assert.equal(sqliteFlagGranted(null), false);
    assert.equal(sqliteFlagGranted(undefined), false);
  });
});

describe('isMasterAdminRow / hasPayrollAccessRow', () => {
  it('grants master-admin and payroll on sqlite 1 or boolean true', () => {
    assert.equal(isMasterAdminRow({ is_master_admin: 1 }), true);
    assert.equal(isMasterAdminRow({ is_master_admin: true }), true);
    assert.equal(isMasterAdminRow({ is_master_admin: 0 }), false);
    assert.equal(isMasterAdminRow({ is_master_admin: '1' }), false);
    assert.equal(hasPayrollAccessRow({ payroll_access: 1 }), true);
    assert.equal(hasPayrollAccessRow({ payroll_access: true }), true);
    assert.equal(hasPayrollAccessRow({ payroll_access: 0, is_master_admin: 1 }), true);
    assert.equal(hasPayrollAccessRow({ payroll_access: 0 }), false);
    assert.equal(hasPayrollAccessRow({ payroll_access: '1' }), false);
    assert.equal(hasPayrollAccessRow(null), false);
  });
});

describe('canTogglePayrollAccess / payrollAccessButtonLabel', () => {
  it('disables the toggle for master admins and labels Master / Granted / Denied', () => {
    assert.equal(canTogglePayrollAccess({ role: 'admin', is_master_admin: 1 }), false);
    assert.equal(canTogglePayrollAccess({ role: 'admin', is_master_admin: true }), false);
    assert.equal(canTogglePayrollAccess({ role: 'admin', is_master_admin: 0 }), true);
    assert.equal(canTogglePayrollAccess({ role: 'employee', is_master_admin: 0 }), false);
    assert.equal(payrollAccessButtonLabel({ is_master_admin: 1 }), '🔑 Master');
    assert.equal(payrollAccessButtonLabel({ payroll_access: 1 }), '✓ Granted');
    assert.equal(payrollAccessButtonLabel({ payroll_access: true }), '✓ Granted');
    assert.equal(payrollAccessButtonLabel({ payroll_access: 0 }), '✗ Denied');
    assert.equal(payrollAccessButtonLabel({}), '✗ Denied');
  });
});
