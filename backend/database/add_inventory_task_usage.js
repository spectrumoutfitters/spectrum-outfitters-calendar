import db from './db.js';

export async function addInventoryTaskUsageTable() {
  try {
    await db.runAsync(`
      CREATE TABLE IF NOT EXISTS inventory_task_usage (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        item_id INTEGER NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
        task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
        quantity_used REAL NOT NULL DEFAULT 1,
        used_by INTEGER NOT NULL REFERENCES users(id),
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await db.runAsync('CREATE INDEX IF NOT EXISTS idx_inv_task_usage_task ON inventory_task_usage(task_id)').catch(() => {});
    await db.runAsync('CREATE INDEX IF NOT EXISTS idx_inv_task_usage_item ON inventory_task_usage(item_id)').catch(() => {});
  } catch (_) {}
}
