import express from 'express';
import db from '../database/db.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';
import { sendPushToUser, sendPushToAdmins, sendPushToAll } from '../utils/pushNotifications.js';

const router = express.Router();

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY ||
  'BD4IZGXRgxbB_D8f6O4VHGbypy7yjp77X_TIoHErXitAhLrqRa6QBuKfnNz7lSX5EkGxyOXm7aKi2Ub5Sul75PM';

// GET /api/push/vapid-public-key
router.get('/vapid-public-key', (req, res) => {
  res.json({ publicKey: VAPID_PUBLIC_KEY });
});

// POST /api/push/subscribe
router.post('/subscribe', authenticateToken, async (req, res) => {
  const { endpoint, keys } = req.body;
  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return res.status(400).json({ error: 'Invalid subscription object' });
  }
  try {
    await db.runAsync(
      `INSERT OR REPLACE INTO push_subscriptions (user_id, endpoint, p256dh, auth)
       VALUES (?, ?, ?, ?)`,
      [req.user.id, endpoint, keys.p256dh, keys.auth]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('Push subscribe error:', err);
    res.status(500).json({ error: 'Failed to save subscription' });
  }
});

// DELETE /api/push/unsubscribe
router.delete('/unsubscribe', authenticateToken, async (req, res) => {
  const { endpoint } = req.body;
  if (!endpoint) return res.status(400).json({ error: 'Endpoint required' });
  await db.runAsync(
    'DELETE FROM push_subscriptions WHERE endpoint = ? AND user_id = ?',
    [endpoint, req.user.id]
  ).catch(() => {});
  res.json({ success: true });
});

// POST /api/push/test — send test push to self (admin only)
router.post('/test', authenticateToken, requireAdmin, async (req, res) => {
  await sendPushToUser(req.user.id, {
    title: 'Test Notification',
    body: 'Push notifications are working correctly!',
    url: '/'
  });
  res.json({ success: true });
});

// POST /api/push/broadcast — admin only
router.post('/broadcast', authenticateToken, requireAdmin, async (req, res) => {
  const { title, body, target = 'all' } = req.body;
  if (!title || !body) return res.status(400).json({ error: 'Title and body required' });
  try {
    if (target === 'admins') {
      await sendPushToAdmins({ title, body });
    } else if (target === 'employees') {
      const employees = await db.allAsync(
        "SELECT id FROM users WHERE role = 'employee' AND is_active = 1"
      ).catch(() => []);
      for (const emp of (employees || [])) {
        await sendPushToUser(emp.id, { title, body });
      }
    } else {
      await sendPushToAll({ title, body });
    }
    res.json({ success: true });
  } catch (err) {
    console.error('Push broadcast error:', err);
    res.status(500).json({ error: 'Broadcast failed', details: err.message });
  }
});

export default router;
