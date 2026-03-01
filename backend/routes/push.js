import express from 'express';
import db from '../database/db.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';
import { sendPushToUser, sendPushToAdmins, sendPushToAll } from '../utils/pushNotifications.js';

const router = express.Router();
router.use(authenticateToken);

const VAPID_PUBLIC_KEY = 'BD4IZGXRgxbB_D8f6O4VHGbypy7yjp77X_TIoHErXitAhLrqRa6QBuKfnNz7lSX5EkGxyOXm7aKi2Ub5Sul75PM';

// GET /api/push/vapid-public-key
router.get('/vapid-public-key', (req, res) => {
  res.json({ publicKey: VAPID_PUBLIC_KEY });
});

// POST /api/push/subscribe
router.post('/subscribe', async (req, res) => {
  try {
    const { endpoint, keys } = req.body;
    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return res.status(400).json({ error: 'Missing subscription fields' });
    }
    await db.runAsync(
      `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(endpoint) DO UPDATE SET user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth`,
      [req.user.id, endpoint, keys.p256dh, keys.auth]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('Subscribe error:', err);
    res.status(500).json({ error: 'Failed to save subscription' });
  }
});

// DELETE /api/push/unsubscribe
router.delete('/unsubscribe', async (req, res) => {
  try {
    const { endpoint } = req.body;
    if (!endpoint) return res.status(400).json({ error: 'Missing endpoint' });
    await db.runAsync(
      'DELETE FROM push_subscriptions WHERE endpoint = ? AND user_id = ?',
      [endpoint, req.user.id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to remove subscription' });
  }
});

// POST /api/push/test
router.post('/test', async (req, res) => {
  try {
    await sendPushToUser(req.user.id, {
      title: 'Test Notification',
      body: 'Push notifications are working!'
    });
    res.json({ success: true });
  } catch (err) {
    console.error('Test push error:', err);
    res.status(500).json({ error: 'Failed to send test notification' });
  }
});

// POST /api/push/broadcast (admin only)
router.post('/broadcast', requireAdmin, async (req, res) => {
  try {
    const { title, body, target } = req.body;
    if (!title || !body) return res.status(400).json({ error: 'Missing title or body' });

    const payload = { title, body };

    if (target === 'admins') {
      await sendPushToAdmins(payload);
    } else if (target === 'employees') {
      const employees = await db.allAsync(
        "SELECT id FROM users WHERE role = 'employee' AND is_active = 1"
      );
      for (const emp of (employees || [])) {
        await sendPushToUser(emp.id, payload);
      }
    } else {
      await sendPushToAll(payload);
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Broadcast push error:', err);
    res.status(500).json({ error: 'Failed to broadcast notification' });
  }
});

export default router;
