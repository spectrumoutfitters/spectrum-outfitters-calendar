import db from './db.js';

export async function addCustomerStatusTable() {
  try {
    await db.runAsync(`
      CREATE TABLE IF NOT EXISTS customer_status_links (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
        token TEXT UNIQUE NOT NULL,
        customer_name TEXT,
        customer_phone TEXT,
        created_by INTEGER REFERENCES users(id),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await db.runAsync(
      'CREATE UNIQUE INDEX IF NOT EXISTS idx_customer_status_token ON customer_status_links(token)'
    ).catch(() => {});
    await db.runAsync(
      'CREATE INDEX IF NOT EXISTS idx_customer_status_task ON customer_status_links(task_id)'
    ).catch(() => {});
  } catch (err) {
    console.error('addCustomerStatusTable error:', err.message);
  }
}
