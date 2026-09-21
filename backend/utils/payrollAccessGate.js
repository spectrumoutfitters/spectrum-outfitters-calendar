/** Payroll access flags from a users-row (SQLite 0/1). */
export function hasPayrollAccess(user) {
  return user?.payroll_access === 1 || user?.is_master_admin === 1;
}

export function isMasterAdminRow(user) {
  return user?.is_master_admin === 1;
}

/**
 * Block revoking payroll access from the master admin or from yourself.
 * Only a strict boolean `false` triggers the deny (0/'false' do not).
 * Master-admin deny wins when both would apply.
 */
export function revokePayrollAccessError({ targetIsMasterAdmin, targetId, actorId, payrollAccess }) {
  if (payrollAccess !== false) return null;
  if (targetIsMasterAdmin) return 'Cannot remove payroll access from master admin';
  if (parseInt(targetId) === actorId) return 'Cannot remove your own payroll access';
  return null;
}

/** Reject directory traversal in payroll data filenames. */
export function isSafePayrollFilename(filename) {
  if (typeof filename !== 'string') return false;
  return !filename.includes('..') && !filename.includes('/') && !filename.includes('\\');
}

export function isPayrollWriteDataMissing(data) {
  return data === undefined || data === null;
}

export function isPayrollVaultMetaPayload(salt, verifier) {
  return typeof salt === 'string' && typeof verifier === 'string';
}
