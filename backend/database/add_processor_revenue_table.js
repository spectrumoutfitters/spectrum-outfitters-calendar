import db from './db.js';

/**
 * Table for payment processor (e.g. Stripe) daily revenue.
 * One row per (date, processor); used for daily income when no Shop Monkey data for that day.
 */
export async function addProcessorRevenueTable() {
  try {
    await db.runAsync(`
      CREATE TABLE IF NOT EXISTS processor_daily_revenue (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL,
        processor TEXT NOT NULL DEFAULT 'stripe',
        revenue DECIMAL(10,2) NOT NULL DEFAULT 0,
        charge_count INTEGER DEFAULT 0,
        refund_total DECIMAL(10,2) DEFAULT 0,
        synced_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(date, processor)
      )
    `);
    await db.runAsync(
      'CREATE INDEX IF NOT EXISTS idx_processor_daily_revenue_date ON processor_daily_revenue(date)'
    ).catch(() => {});
    await db.runAsync(
      'CREATE INDEX IF NOT EXISTS idx_processor_daily_revenue_processor ON processor_daily_revenue(processor)'
    ).catch(() => {});
    console.log('✅ processor_daily_revenue table created');
  } catch (error) {
    console.error('Error creating processor_daily_revenue table:', error);
  }
}
