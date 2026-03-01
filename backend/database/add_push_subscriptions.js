import db from './db.js';

export async function addPushSubscriptionsTable() {
  try {
    await db.runAsync(`
      CREATE TABLE IF NOT EXISTS push_subscriptions (
        id INTEGER PRIMARY KEY,
        user_id INTEGER,
        endpoint TEXT UNIQUE,
        p256dh TEXT,
        auth TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await db.runAsync('CREATE INDEX IF NOT EXISTS idx_push_subs_user ON push_subscriptions(user_id)').catch(() => {});
  } catch (_) {}
}
