import db from './db.js';

export async function addShopmonkeyRevenueTable() {
  try {
    await db.runAsync(`
      CREATE TABLE IF NOT EXISTS shopmonkey_daily_revenue (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL UNIQUE,
        revenue DECIMAL(10,2) NOT NULL DEFAULT 0,
        charge_count INTEGER DEFAULT 0,
        refund_total DECIMAL(10,2) DEFAULT 0,
        synced_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await db.runAsync(
      'CREATE INDEX IF NOT EXISTS idx_sm_daily_revenue_date ON shopmonkey_daily_revenue(date)'
    ).catch(() => {});
    console.log('✅ shopmonkey_daily_revenue table created');
  } catch (error) {
    console.error('Error creating shopmonkey_daily_revenue table:', error);
  }
}
