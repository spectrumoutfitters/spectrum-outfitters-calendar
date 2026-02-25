import db from './db.js';

/**
 * Allow reason 'use' in inventory_quantity_log (for employee scan-out / use item not on a task).
 * SQLite cannot alter CHECK, so we recreate the table.
 */
async function addQuantityLogUseReason() {
  try {
    await db.runAsync(`
      CREATE TABLE IF NOT EXISTS inventory_quantity_log_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        item_id INTEGER NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
        quantity_before REAL NOT NULL,
        quantity_after REAL NOT NULL,
        changed_by INTEGER REFERENCES users(id),
        reason TEXT NOT NULL DEFAULT 'count' CHECK(reason IN ('count', 'refill_received', 'task_approved', 'use')),
        refill_request_id INTEGER REFERENCES inventory_refill_requests(id),
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
    console.log('✅ inventory_quantity_log now allows reason use');
  } catch (error) {
    console.error('❌ Error updating quantity log:', error);
    process.exit(1);
  }
  process.exit(0);
}

addQuantityLogUseReason();
