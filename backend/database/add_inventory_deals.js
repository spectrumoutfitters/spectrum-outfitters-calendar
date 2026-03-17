import db from './db.js';

/**
 * Cached deal results for inventory items.
 * Keeps the app fast and avoids hammering external sites.
 */
export async function addInventoryDealsTable() {
  try {
    await db.runAsync(`
      CREATE TABLE IF NOT EXISTS inventory_deals (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        item_id INTEGER NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
        source TEXT NOT NULL,
        title TEXT,
        url TEXT NOT NULL,
        price REAL,
        currency TEXT DEFAULT 'USD',
        shipping TEXT,
        coupon_code TEXT,
        expires_at DATETIME,
        score REAL DEFAULT 0,
        reason TEXT,
        raw_json TEXT,
        fetched_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await db.runAsync('CREATE INDEX IF NOT EXISTS idx_inventory_deals_item ON inventory_deals(item_id, fetched_at DESC)').catch(() => {});
    await db.runAsync('CREATE INDEX IF NOT EXISTS idx_inventory_deals_source ON inventory_deals(source, fetched_at DESC)').catch(() => {});
    console.log('✅ inventory_deals table ready');
  } catch (e) {
    console.warn('inventory deals table migration warning:', e.message);
  }
}

