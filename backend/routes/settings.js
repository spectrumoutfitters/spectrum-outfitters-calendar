import express from 'express';
import db from '../database/db.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';
import { DEFAULT_NAV_ORDER, mergeNavOrder } from '../utils/navOrderMerge.js';

const router = express.Router();

// GET /api/settings/nav-order - Get sidebar nav order (any authenticated user)
router.get('/nav-order', authenticateToken, async (req, res) => {
  try {
    const row = await db.getAsync("SELECT value FROM app_settings WHERE key = 'nav_order'");
    let order = row?.value ? JSON.parse(row.value) : DEFAULT_NAV_ORDER;
    if (!Array.isArray(order)) order = DEFAULT_NAV_ORDER;

    order = mergeNavOrder(order, DEFAULT_NAV_ORDER);

    return res.json({ order });
  } catch (error) {
    console.error('Get nav-order error:', error);
    return res.json({ order: DEFAULT_NAV_ORDER });
  }
});

// PUT /api/settings/nav-order - Update sidebar nav order (admin only)
router.put('/nav-order', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { order } = req.body || {};
    if (!Array.isArray(order) || order.length === 0) {
      return res.status(400).json({ error: 'order must be a non-empty array' });
    }
    const value = JSON.stringify(order);
    await db.runAsync(
      `INSERT INTO app_settings (key, value, updated_at) VALUES ('nav_order', ?, CURRENT_TIMESTAMP)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP`,
      [value]
    );
    res.json({ order });
  } catch (error) {
    console.error('Put nav-order error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
