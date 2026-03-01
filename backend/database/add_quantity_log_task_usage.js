import db from './db.js';

/**
 * Add 'used_on_task' and 'batch_received' reasons to inventory_quantity_log,
 * plus task_id and notes columns for tracking which task consumed inventory.
 * SQLite cannot alter CHECK constraints, so we recreate the table.
 */
export async function addQuantityLogTaskUsage() {
  try {
    // Check if already migrated (task_id column exists)
    const info = await db.allAsync('PRAGMA table_info(inventory_quantity_log)');
    const cols = new Set((info || []).map(c => c.name));
    if (cols.has('task_id')) return; // Already migrated

    await db.runAsync(`
      CREATE TABLE IF NOT EXISTS inventory_quantity_log_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        item_id INTEGER NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
        quantity_before REAL NOT NULL,
        quantity_after REAL NOT NULL,
        changed_by INTEGER REFERENCES users(id),
        reason TEXT NOT NULL DEFAULT 'count' CHECK(reason IN ('count', 'refill_received', 'task_approved', 'use', 'used_on_task', 'batch_received')),
        refill_request_id INTEGER REFERENCES inventory_refill_requests(id),
        task_id INTEGER,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await db.runAsync(`
      INSERT INTO inventory_quantity_log_new (id, item_id, quantity_before, quantity_after, changed_by, reason, refill_request_id, created_at)
      SELECT id, item_id, quantity_before, quantity_after, changed_by, reason, refill_request_id, created_at
      FROM inventory_quantity_log
    `);
    await db.runAsync('DROP TABLE inventory_quantity_log');
    await db.runAsync('ALTER TABLE inventory_quantity_log_new RENAME TO inventory_quantity_log');
    await db.runAsync('CREATE INDEX IF NOT EXISTS idx_quantity_log_item ON inventory_quantity_log(item_id)');
    await db.runAsync('CREATE INDEX IF NOT EXISTS idx_quantity_log_created ON inventory_quantity_log(created_at)');
    await db.runAsync('CREATE INDEX IF NOT EXISTS idx_quantity_log_task ON inventory_quantity_log(task_id)');
    console.log('✅ inventory_quantity_log: added used_on_task/batch_received reasons + task_id/notes columns');
  } catch (e) {
    console.warn('inventory_quantity_log task_usage migration warning:', e.message);
  }
}
