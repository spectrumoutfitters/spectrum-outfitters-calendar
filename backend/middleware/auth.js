import jwt from 'jsonwebtoken';
import db from '../database/db.js';
import { ensureUserColumns } from '../database/startup.js';
import {
  requireAdmin,
  requireMasterAdmin,
  requirePayrollAccess,
} from '../utils/authGates.js';

export { requireAdmin, requireMasterAdmin, requirePayrollAccess };

export const authenticateToken = async (req, res, next) => {
  // Prefer Authorization header so a stale `token` cookie cannot block a valid Bearer (local dev / rotated secrets).
  const bearer = req.headers.authorization?.split(' ')[1];
  const token = bearer || req.cookies?.token;

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
