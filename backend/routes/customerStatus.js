import express from 'express';
import crypto from 'crypto';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';
import db from '../database/db.js';

const router = express.Router();

/**
 * POST /api/customer-status/generate
 * Auth required (admin). Creates/updates a public status link for a task.
 * Body: { task_id, customer_name, customer_phone }
 * Returns: { token, url }
 */
router.post('/generate', authenticateToken, requireAdmin, async (req, res) => {
  const { task_id, customer_name, customer_phone } = req.body;
  if (!task_id) return res.status(400).json({ error: 'task_id required' });

  try {
    const token = crypto.randomBytes(16).toString('hex');

    const existing = await db.getAsync(
      'SELECT id FROM customer_status_links WHERE task_id = ?',
      [task_id]
    );

    if (existing) {
      await db.runAsync(
        `UPDATE customer_status_links
         SET token = ?, customer_name = ?, customer_phone = ?, created_by = ?, created_at = CURRENT_TIMESTAMP
         WHERE task_id = ?`,
        [token, customer_name || null, customer_phone || null, req.user.id, task_id]
      );
    } else {
      await db.runAsync(
        `INSERT INTO customer_status_links (task_id, token, customer_name, customer_phone, created_by)
         VALUES (?, ?, ?, ?, ?)`,
        [task_id, token, customer_name || null, customer_phone || null, req.user.id]
      );
    }

    const url = `/status/${token}`;
    res.json({ token, url });
  } catch (err) {
    console.error('customer-status generate error:', err.message);
    res.status(500).json({ error: 'Failed to generate status link' });
  }
});

/**
 * GET /api/customer-status/:token
 * NO auth — public route. Returns task status for customers.
 */
router.get('/:token', async (req, res) => {
  const { token } = req.params;

  try {
    const link = await db.getAsync(
      `SELECT csl.customer_name, csl.task_id,
              t.title as task_title, t.status, t.description, t.due_date, t.updated_at as last_updated
       FROM customer_status_links csl
       JOIN tasks t ON csl.task_id = t.id
       WHERE csl.token = ?`,
      [token]
    );

    if (!link) return res.status(404).json({ error: 'Status link not found' });

    res.json({
      customer_name: link.customer_name,
      task_title: link.task_title,
      status: link.status,
      description: link.description,
      due_date: link.due_date,
      last_updated: link.last_updated,
    });
  } catch (err) {
    console.error('customer-status GET error:', err.message);
    res.status(500).json({ error: 'Failed to fetch status' });
  }
});

export default router;
