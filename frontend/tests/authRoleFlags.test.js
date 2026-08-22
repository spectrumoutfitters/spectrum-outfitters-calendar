import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  hasPayrollAccessUser,
  isAdminUser,
  isMasterAdminUser,
  shouldClearAuthToken,
  shouldShowClockInHeader,
} from '../src/utils/authRoleFlags.js';

describe('isAdminUser', () => {
  it('requires exact role admin or boolean master-admin', () => {
    assert.equal(isAdminUser({ role: 'admin' }), true);
    assert.equal(isAdminUser({ role: 'employee', is_master_admin: true }), true);
    assert.equal(isAdminUser({ role: 'Admin' }), false);
    assert.equal(isAdminUser({ role: 'employee' }), false);
    assert.equal(isAdminUser({ role: 'admin ', is_master_admin: 1 }), false);
    assert.equal(isAdminUser({ is_master_admin: 1 }), false);
    assert.equal(isAdminUser({ is_master_admin: 'true' }), false);
    assert.equal(isAdminUser(null), false);
    assert.equal(isAdminUser(undefined), false);
  });
});

describe('hasPayrollAccessUser / isMasterAdminUser', () => {
  it('treats only boolean true as payroll or master-admin', () => {
    assert.equal(hasPayrollAccessUser({ payroll_access: true }), true);
    assert.equal(hasPayrollAccessUser({ is_master_admin: true }), true);
    assert.equal(hasPayrollAccessUser({ payroll_access: 1 }), false);
    assert.equal(hasPayrollAccessUser({ payroll_access: 'true' }), false);
    assert.equal(hasPayrollAccessUser({ payroll_access: false, is_master_admin: 1 }), false);
    assert.equal(isMasterAdminUser({ is_master_admin: true }), true);
    assert.equal(isMasterAdminUser({ is_master_admin: 1 }), false);
    assert.equal(isMasterAdminUser({ is_master_admin: 'true' }), false);
    assert.equal(isMasterAdminUser({ role: 'admin' }), false);
  });
});

describe('shouldShowClockInHeader', () => {
  it('hides only on explicit false', () => {
    assert.equal(shouldShowClockInHeader({ show_clock_in_header: false }), false);
    assert.equal(shouldShowClockInHeader({}), true);
    assert.equal(shouldShowClockInHeader({ show_clock_in_header: 0 }), true);
    assert.equal(shouldShowClockInHeader({ show_clock_in_header: '0' }), true);
    assert.equal(shouldShowClockInHeader({ show_clock_in_header: null }), true);
    assert.equal(shouldShowClockInHeader(undefined), true);
    assert.equal(shouldShowClockInHeader({ show_clock_in_header: true }), true);
  });
});

describe('shouldClearAuthToken', () => {
  it('clears only on HTTP 401', () => {
    assert.equal(shouldClearAuthToken({ response: { status: 401 } }), true);
    assert.equal(shouldClearAuthToken({ response: { status: 403 } }), false);
    assert.equal(shouldClearAuthToken({ response: { status: 500 } }), false);
    assert.equal(shouldClearAuthToken({ isNetworkError: true }), false);
    assert.equal(shouldClearAuthToken({}), false);
    assert.equal(shouldClearAuthToken(undefined), false);
  });
});
