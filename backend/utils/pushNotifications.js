import webpush from 'web-push';
import db from '../database/db.js';

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY ||
  'BD4IZGXRgxbB_D8f6O4VHGbypy7yjp77X_TIoHErXitAhLrqRa6QBuKfnNz7lSX5EkGxyOXm7aKi2Ub5Sul75PM';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY ||
  '5IF2yBn5OqA8IpAhFfIRoCH_s2rP58y6UkR3d3EVF7c';

webpush.setVapidDetails('mailto:neel@gotospectrum.com', VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

async function sendPush(subscription, payload) {
  try {
    await webpush.sendNotification(subscription, JSON.stringify(payload));
    return true;
  } catch (err) {
    if (err.statusCode === 410) {
      // Subscription is gone — clean it up
      await db.runAsync(
        'DELETE FROM push_subscriptions WHERE endpoint = ?',
        [subscription.endpoint]
      ).catch(() => {});
    }
    return false;
  }
}

export async function sendPushToUser(userId, { title, body = '', icon = '/spectrum-icon.png', url = '/', tag }) {
  const subs = await db.allAsync(
    'SELECT * FROM push_subscriptions WHERE user_id = ?',
    [userId]
  ).catch(() => []);
  for (const sub of (subs || [])) {
    const subscription = {
      endpoint: sub.endpoint,
      keys: { p256dh: sub.p256dh, auth: sub.auth }
    };
    await sendPush(subscription, { title, body, icon, url, tag });
  }
}

export async function sendPushToAdmins({ title, body = '', icon = '/spectrum-icon.png', url = '/', tag }) {
  const admins = await db.allAsync(
    "SELECT id FROM users WHERE role = 'admin' AND is_active = 1"
  ).catch(() => []);
  for (const admin of (admins || [])) {
    await sendPushToUser(admin.id, { title, body, icon, url, tag });
  }
}

export async function sendPushToAll({ title, body = '', icon = '/spectrum-icon.png', url = '/', tag }) {
  const subs = await db.allAsync('SELECT * FROM push_subscriptions').catch(() => []);
  for (const sub of (subs || [])) {
    const subscription = {
      endpoint: sub.endpoint,
      keys: { p256dh: sub.p256dh, auth: sub.auth }
    };
    await sendPush(subscription, { title, body, icon, url, tag });
  }
}
