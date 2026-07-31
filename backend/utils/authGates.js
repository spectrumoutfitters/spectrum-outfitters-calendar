/**
 * Pure Express role gates (no DB / JWT). Kept separate so permission rules can be unit-tested
 * without opening SQLite via middleware/auth.js side effects.
 */

export function requireAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  const isAdmin = req.user.role === 'admin' || req.user.is_master_admin === true;
  if (!isAdmin) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

export function requireMasterAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  if (req.user.role !== 'admin' || !req.user.is_master_admin) {
    return res.status(403).json({ error: 'Master admin access required' });
  }
  next();
}

export function requirePayrollAccess(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  if (!req.user.payroll_access && !req.user.is_master_admin) {
    return res.status(403).json({ error: 'Payroll access denied. Contact master admin.' });
  }
  next();
}
