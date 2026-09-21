import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  hasPayrollAccess,
  isMasterAdminRow,
  revokePayrollAccessError,
  isSafePayrollFilename,
  isPayrollWriteDataMissing,
  isPayrollVaultMetaPayload,
} from '../utils/payrollAccessGate.js';

describe('hasPayrollAccess', () => {
  it('grants access when payroll_access is 1', () => {
    assert.equal(hasPayrollAccess({ payroll_access: 1, is_master_admin: 0 }), true);
  });

  it('grants access when is_master_admin is 1 even without payroll_access', () => {
    assert.equal(hasPayrollAccess({ payroll_access: 0, is_master_admin: 1 }), true);
  });

  it('denies boolean true flags that are not SQLite 1', () => {
    assert.equal(hasPayrollAccess({ payroll_access: true, is_master_admin: true }), false);
  });

  it('denies missing user', () => {
    assert.equal(hasPayrollAccess(null), false);
    assert.equal(hasPayrollAccess(undefined), false);
  });
});

describe('isMasterAdminRow', () => {
  it('requires is_master_admin === 1', () => {
    assert.equal(isMasterAdminRow({ is_master_admin: 1 }), true);
    assert.equal(isMasterAdminRow({ is_master_admin: true }), false);
    assert.equal(isMasterAdminRow({ is_master_admin: 0 }), false);
  });
});

describe('revokePayrollAccessError', () => {
  it('allows granting access', () => {
    assert.equal(
      revokePayrollAccessError({
        targetIsMasterAdmin: true,
        targetId: '1',
        actorId: 1,
        payrollAccess: true,
      }),
      null,
    );
  });

  it('blocks removing master-admin access before the self-revoke check', () => {
    assert.equal(
      revokePayrollAccessError({
        targetIsMasterAdmin: true,
        targetId: '9',
        actorId: 9,
        payrollAccess: false,
      }),
      'Cannot remove payroll access from master admin',
    );
  });

  it('blocks removing your own access', () => {
    assert.equal(
      revokePayrollAccessError({
        targetIsMasterAdmin: false,
        targetId: '12',
        actorId: 12,
        payrollAccess: false,
      }),
      'Cannot remove your own payroll access',
    );
  });

  it('uses parseInt on target id (prefix numbers match)', () => {
    assert.equal(
      revokePayrollAccessError({
        targetIsMasterAdmin: false,
        targetId: '10abc',
        actorId: 10,
        payrollAccess: false,
      }),
      'Cannot remove your own payroll access',
    );
  });

  it('only treats strict boolean false as a revoke', () => {
    assert.equal(
      revokePayrollAccessError({
        targetIsMasterAdmin: true,
        targetId: '1',
        actorId: 1,
        payrollAccess: 0,
      }),
      null,
    );
  });

  it('allows revoking a different non-master admin', () => {
    assert.equal(
      revokePayrollAccessError({
        targetIsMasterAdmin: false,
        targetId: '4',
        actorId: 1,
        payrollAccess: false,
      }),
      null,
    );
  });
});

describe('isSafePayrollFilename', () => {
  it('allows a plain json filename', () => {
    assert.equal(isSafePayrollFilename('employees.json'), true);
  });

  it('rejects parent-directory and path separators', () => {
    assert.equal(isSafePayrollFilename('../secret.json'), false);
    assert.equal(isSafePayrollFilename('dir/file.json'), false);
    assert.equal(isSafePayrollFilename('dir\\file.json'), false);
  });

  it('rejects non-string names (empty string has no path tokens, so it is allowed)', () => {
    assert.equal(isSafePayrollFilename(''), true);
    assert.equal(isSafePayrollFilename(null), false);
  });
});

describe('isPayrollWriteDataMissing', () => {
  it('treats undefined and null as missing, but not empty string or 0', () => {
    assert.equal(isPayrollWriteDataMissing(undefined), true);
    assert.equal(isPayrollWriteDataMissing(null), true);
    assert.equal(isPayrollWriteDataMissing(''), false);
    assert.equal(isPayrollWriteDataMissing(0), false);
    assert.equal(isPayrollWriteDataMissing({}), false);
  });
});

describe('isPayrollVaultMetaPayload', () => {
  it('requires salt and verifier strings', () => {
    assert.equal(isPayrollVaultMetaPayload('abc', 'def'), true);
    assert.equal(isPayrollVaultMetaPayload('', ''), true);
    assert.equal(isPayrollVaultMetaPayload(1, 'def'), false);
    assert.equal(isPayrollVaultMetaPayload('abc', undefined), false);
  });
});
