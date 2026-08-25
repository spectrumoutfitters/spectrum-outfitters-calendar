/**
 * User-management payroll-access button flags.
 * Unlike AuthContext (boolean `true` only), this UI treats sqlite `1` as granted.
 */

export function sqliteFlagGranted(value) {
  return value === 1 || value === true;
}

export function isMasterAdminRow(user) {
  return sqliteFlagGranted(user?.is_master_admin);
}

export function hasPayrollAccessRow(user) {
  return sqliteFlagGranted(user?.payroll_access) || isMasterAdminRow(user);
}

export function canTogglePayrollAccess(user) {
  return user?.role === 'admin' && !isMasterAdminRow(user);
}

export function payrollAccessButtonLabel(user) {
  if (isMasterAdminRow(user)) return '🔑 Master';
  if (sqliteFlagGranted(user?.payroll_access)) return '✓ Granted';
  return '✗ Denied';
}
