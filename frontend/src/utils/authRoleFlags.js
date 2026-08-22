/**
 * Frontend auth gates. These are stricter than some backend sqlite flags:
 * master-admin / payroll_access must be boolean true (integer 1 does not count).
 */

export function isAdminUser(user) {
  return user?.role === 'admin' || user?.is_master_admin === true;
}

export function hasPayrollAccessUser(user) {
  return user?.payroll_access === true || user?.is_master_admin === true;
}

export function isMasterAdminUser(user) {
  return user?.is_master_admin === true;
}

/** Header clock is hidden only on explicit false (0/'0'/nullish still show). */
export function shouldShowClockInHeader(user) {
  return user?.show_clock_in_header !== false;
}

/** /auth/me only drops the stored token on HTTP 401. */
export function shouldClearAuthToken(error) {
  return error?.response?.status === 401;
}
