import jwt from 'jsonwebtoken';
import db from '../database/db.js';
import { ensureUserColumns } from '../database/startup.js';
import {
  pickRequestToken,
  adminAccessDecision,
  masterAdminAccessDecision,
  payrollAccessDecision,
} from '../utils/authRoleGate.js';

export const authenticateToken = async (req, res, next) => {
  // Prefer Authorization header so a stale `token` cookie cannot block a valid Bearer (local dev / rotated secrets).
  const token = pickRequestToken(req);

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
  const decision = adminAccessDecision(req.user);
  if (!decision.ok) {
    return res.status(decision.status).json({ error: decision.error });
  }
  next();
};

export const requireMasterAdmin = (req, res, next) => {
  const decision = masterAdminAccessDecision(req.user);
  if (!decision.ok) {
    return res.status(decision.status).json({ error: decision.error });
  }
  next();
};

export const requirePayrollAccess = (req, res, next) => {
  const decision = payrollAccessDecision(req.user);
  if (!decision.ok) {
    return res.status(decision.status).json({ error: decision.error });
  }
  next();
};

