/**
 * Pure helpers for login / JWT / GET /me flag coercion.
 * Extracted from routes/auth.js — keep behavior identical.
 */

/** Payroll access is granted only when the stored value is strictly `1`. */
export function isPayrollAccessFlag(value) {
  return value === 1;
}

/** Master-admin is granted only when the stored value is strictly `1`. */
export function isMasterAdminFlag(value) {
  return value === 1;
}

/**
 * Clock-in header visibility: hidden when the column is `0` or null/undefined.
 * Any other stored value (including `1`, `true`, `'0'`) shows the header.
 */
export function showClockInHeaderFlag(value) {
  return value !== 0 && value != null;
}

/**
 * Login payload only: missing weekly salary becomes 0 via `??`.
 * GET /me does not apply this and returns the stored value (including null).
 */
export function loginWeeklySalary(value) {
  return value ?? 0;
}

/** Claims embedded in the JWT at login. */
export function jwtAuthClaims(user) {
  return {
    id: user.id,
    username: user.username,
    role: user.role,
    payroll_access: isPayrollAccessFlag(user.payroll_access),
    is_master_admin: isMasterAdminFlag(user.is_master_admin),
  };
}

/** Public user object returned by POST /api/auth/login. */
export function loginUserPayload(user) {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    full_name: user.full_name,
    role: user.role,
    hourly_rate: user.hourly_rate,
    weekly_salary: loginWeeklySalary(user.weekly_salary),
    show_clock_in_header: showClockInHeaderFlag(user.show_clock_in_header),
    payroll_access: isPayrollAccessFlag(user.payroll_access),
    is_master_admin: isMasterAdminFlag(user.is_master_admin),
  };
}

/** Public user object returned by GET /api/auth/me (spreads the row, then overlays flags). */
export function meUserPayload(user) {
  return {
    ...user,
    show_clock_in_header: showClockInHeaderFlag(user.show_clock_in_header),
    payroll_access: isPayrollAccessFlag(user.payroll_access),
    is_master_admin: isMasterAdminFlag(user.is_master_admin),
  };
}
