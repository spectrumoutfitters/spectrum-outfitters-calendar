/**
 * Authz predicates from middleware/auth.js.
 * Distinct from routes/auth.js session flags (#97) and frontend
 * AuthContext isAdmin / payroll flags (#102).
 *
 * requireAdmin uses `is_master_admin === true` (numeric 1 does not count).
 * requireMasterAdmin / requirePayrollAccess use truthy `is_master_admin`.
 * Bearer Authorization is preferred over a stale cookie token.
 */

export function pickRequestToken(req) {
  const bearer = req?.headers?.authorization?.split(' ')[1];
  return bearer || req?.cookies?.token || undefined;
}

export function adminAccessDecision(user) {
  if (!user) {
    return { ok: false, status: 401, error: 'Authentication required' };
  }
  const isAdmin = user.role === 'admin' || user.is_master_admin === true;
  if (!isAdmin) {
    return { ok: false, status: 403, error: 'Admin access required' };
  }
  return { ok: true };
}

export function masterAdminAccessDecision(user) {
  if (!user) {
    return { ok: false, status: 401, error: 'Authentication required' };
  }
  if (user.role !== 'admin' || !user.is_master_admin) {
    return { ok: false, status: 403, error: 'Master admin access required' };
  }
  return { ok: true };
}

export function payrollAccessDecision(user) {
  if (!user) {
    return { ok: false, status: 401, error: 'Authentication required' };
  }
  if (user.role !== 'admin') {
    return { ok: false, status: 403, error: 'Admin access required' };
  }
  if (!user.payroll_access && !user.is_master_admin) {
    return { ok: false, status: 403, error: 'Payroll access denied. Contact master admin.' };
  }
  return { ok: true };
}
