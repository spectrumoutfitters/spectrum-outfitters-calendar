import webpush from 'web-push';
import db from '../database/db.js';

webpush.setVapidDetails(
  'mailto:neel@gotospectrum.com',
  'BD4IZGXRgxbB_D8f6O4VHGbypy7yjp77X_TIoHErXitAhLrqRa6QBuKfnNz7lSX5EkGxyOXm7aKi2Ub5Sul75PM',
  '5IF2yBn5OqA8IpAhFfIRoCH_s2rP58y6UkR3d3EVF7c'
);

export async function sendPushToUser(userId, payload) {
  let subs;
  try {
    subs = await db.allAsync('SELECT * FROM push_subscriptions WHERE user_id = ?', [userId]);
  } catch (_) {
    return;
  }
  if (!subs || subs.length === 0) return;

  const payloadStr = JSON.stringify(payload);
  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payloadStr
      );
    } catch (err) {
      if (err.statusCode === 410) {
        await db.runAsync('DELETE FROM push_subscriptions WHERE endpoint = ?', [sub.endpoint]).catch(() => {});
      }
    }
  }
}

export async function sendPushToAdmins(payload) {
  try {
    const admins = await db.allAsync("SELECT id FROM users WHERE role = 'admin' AND is_active = 1");
    for (const admin of (admins || [])) {
      await sendPushToUser(admin.id, payload);
    }
  } catch (_) {}
}

export async function sendPushToAll(payload) {
  try {
    const rows = await db.allAsync('SELECT DISTINCT user_id FROM push_subscriptions');
    for (const row of (rows || [])) {
      await sendPushToUser(row.user_id, payload);
    }
  } catch (_) {}
}
