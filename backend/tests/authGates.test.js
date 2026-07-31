import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  requireAdmin,
  requireMasterAdmin,
  requirePayrollAccess,
} from '../utils/authGates.js';

function makeRes() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

function callGate(gate, user) {
  const req = { user };
  const res = makeRes();
  let nextCalled = false;
  gate(req, res, () => {
    nextCalled = true;
  });
  return { res, nextCalled };
}

describe('requireAdmin', () => {
  it('rejects missing user with 401', () => {
    const { res, nextCalled } = callGate(requireAdmin, undefined);
    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 401);
    assert.deepEqual(res.body, { error: 'Authentication required' });
  });

  it('allows role=admin', () => {
    const { res, nextCalled } = callGate(requireAdmin, { role: 'admin' });
    assert.equal(nextCalled, true);
    assert.equal(res.statusCode, 200);
  });

  it('allows master admin flag even when role is not admin', () => {
    const { nextCalled } = callGate(requireAdmin, {
      role: 'employee',
      is_master_admin: true,
    });
    assert.equal(nextCalled, true);
  });

  it('rejects employees without master flag', () => {
    const { res, nextCalled } = callGate(requireAdmin, { role: 'employee' });
    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 403);
    assert.deepEqual(res.body, { error: 'Admin access required' });
  });
});

describe('requireMasterAdmin', () => {
  it('rejects missing user with 401', () => {
    const { res, nextCalled } = callGate(requireMasterAdmin, null);
    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 401);
  });

  it('allows only admin + is_master_admin', () => {
    const { nextCalled } = callGate(requireMasterAdmin, {
      role: 'admin',
      is_master_admin: true,
    });
    assert.equal(nextCalled, true);
  });

  it('rejects admin without master flag', () => {
    const { res, nextCalled } = callGate(requireMasterAdmin, {
      role: 'admin',
      is_master_admin: false,
    });
    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 403);
    assert.deepEqual(res.body, { error: 'Master admin access required' });
  });

  it('rejects master flag without admin role', () => {
    const { res, nextCalled } = callGate(requireMasterAdmin, {
      role: 'employee',
      is_master_admin: true,
    });
    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 403);
  });
});

describe('requirePayrollAccess', () => {
  it('rejects missing user with 401', () => {
    const { res, nextCalled } = callGate(requirePayrollAccess, undefined);
    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 401);
  });

  it('rejects non-admins even with payroll_access', () => {
    const { res, nextCalled } = callGate(requirePayrollAccess, {
      role: 'employee',
      payroll_access: true,
    });
    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 403);
    assert.deepEqual(res.body, { error: 'Admin access required' });
  });

  it('rejects admins without payroll_access or master flag', () => {
    const { res, nextCalled } = callGate(requirePayrollAccess, {
      role: 'admin',
      payroll_access: false,
      is_master_admin: false,
    });
    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 403);
    assert.deepEqual(res.body, {
      error: 'Payroll access denied. Contact master admin.',
    });
  });

  it('allows admin with payroll_access', () => {
    const { nextCalled } = callGate(requirePayrollAccess, {
      role: 'admin',
      payroll_access: true,
    });
    assert.equal(nextCalled, true);
  });

  it('allows master admin without explicit payroll_access', () => {
    const { nextCalled } = callGate(requirePayrollAccess, {
      role: 'admin',
      payroll_access: false,
      is_master_admin: true,
    });
    assert.equal(nextCalled, true);
  });
});
