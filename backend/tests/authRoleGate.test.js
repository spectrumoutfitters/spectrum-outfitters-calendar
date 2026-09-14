import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  pickRequestToken,
  adminAccessDecision,
  masterAdminAccessDecision,
  payrollAccessDecision,
} from '../utils/authRoleGate.js';

describe('pickRequestToken', () => {
  it('prefers Authorization bearer over a cookie token', () => {
    assert.equal(
      pickRequestToken({
        headers: { authorization: 'Bearer header-token' },
        cookies: { token: 'cookie-token' },
      }),
      'header-token'
    );
  });

  it('falls back to the cookie when no bearer is present', () => {
    assert.equal(
      pickRequestToken({ headers: {}, cookies: { token: 'cookie-token' } }),
      'cookie-token'
    );
  });

  it('returns undefined when neither header nor cookie has a token', () => {
    assert.equal(pickRequestToken({ headers: {}, cookies: {} }), undefined);
    assert.equal(pickRequestToken({}), undefined);
  });
});

describe('adminAccessDecision', () => {
  it('returns 401 when user is missing', () => {
    assert.deepEqual(adminAccessDecision(null), {
      ok: false,
      status: 401,
      error: 'Authentication required',
    });
  });

  it('allows role admin or exact boolean is_master_admin', () => {
    assert.deepEqual(adminAccessDecision({ role: 'admin' }), { ok: true });
    assert.deepEqual(adminAccessDecision({ role: 'employee', is_master_admin: true }), { ok: true });
  });

  it('rejects numeric is_master_admin 1 (=== true only)', () => {
    assert.deepEqual(adminAccessDecision({ role: 'employee', is_master_admin: 1 }), {
      ok: false,
      status: 403,
      error: 'Admin access required',
    });
  });

  it('rejects a plain employee', () => {
    assert.deepEqual(adminAccessDecision({ role: 'employee' }), {
      ok: false,
      status: 403,
      error: 'Admin access required',
    });
  });
});

describe('masterAdminAccessDecision', () => {
  it('requires both role admin and truthy is_master_admin', () => {
    assert.deepEqual(masterAdminAccessDecision({ role: 'admin', is_master_admin: true }), { ok: true });
    assert.deepEqual(masterAdminAccessDecision({ role: 'admin', is_master_admin: 1 }), { ok: true });
    assert.deepEqual(masterAdminAccessDecision({ role: 'employee', is_master_admin: true }), {
      ok: false,
      status: 403,
      error: 'Master admin access required',
    });
    assert.deepEqual(masterAdminAccessDecision({ role: 'admin', is_master_admin: false }), {
      ok: false,
      status: 403,
      error: 'Master admin access required',
    });
  });
});

describe('payrollAccessDecision', () => {
  it('requires admin role first, then payroll_access or truthy master flag', () => {
    assert.deepEqual(payrollAccessDecision({ role: 'admin', payroll_access: true }), { ok: true });
    assert.deepEqual(payrollAccessDecision({ role: 'admin', is_master_admin: 1 }), { ok: true });
    assert.deepEqual(payrollAccessDecision({ role: 'employee', payroll_access: true }), {
      ok: false,
      status: 403,
      error: 'Admin access required',
    });
    assert.deepEqual(payrollAccessDecision({ role: 'admin' }), {
      ok: false,
      status: 403,
      error: 'Payroll access denied. Contact master admin.',
    });
  });
});
