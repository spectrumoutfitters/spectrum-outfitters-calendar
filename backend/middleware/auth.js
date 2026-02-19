import jwt from 'jsonwebtoken';
import db from '../database/db.js';
import { ensureUserColumns } from '../database/startup.js';

export const authenticateToken = async (req, res, next) => {
  const token = req.cookies?.token || req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    await ensureUserColumns();
    const user = await db.getAsync(
      'SELECT id, username, role, payroll_access, is_master_admin FROM users WHERE id = ?',
      [decoded.id]
    );
    if (user) {
      req.user = {
        ...decoded,
        role: user.role,
        payroll_access: user.payroll_access === 1,
        is_master_admin: user.is_master_admin === 1
      };
    } else {
      req.user = decoded;
    }
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

export const requireAdmin = (req, res, next) => {
  const isAdmin = req.user.role === 'admin' || req.user.is_master_admin === true;
  if (!isAdmin) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

export const requireMasterAdmin = (req, res, next) => {
  if (req.user.role !== 'admin' || !req.user.is_master_admin) {
    return res.status(403).json({ error: 'Master admin access required' });
  }
  next();
};

export const requirePayrollAccess = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  if (!req.user.payroll_access && !req.user.is_master_admin) {
    return res.status(403).json({ error: 'Payroll access denied. Contact master admin.' });
  }
  next();
};

