import db from './db.js';

async function addTaskInventoryUsage() {
  await db.runAsync(`
    CREATE TABLE IF NOT EXISTS task_inventory_usage (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      item_id INTEGER NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
      quantity_used REAL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_by INTEGER REFERENCES users(id),
      UNIQUE(task_id, item_id)
    )
  `);
  await db.runAsync(`CREATE INDEX IF NOT EXISTS idx_task_inventory_usage_task ON task_inventory_usage(task_id)`);
  await db.runAsync(`CREATE INDEX IF NOT EXISTS idx_task_inventory_usage_item ON task_inventory_usage(item_id)`);
  console.log('✅ task_inventory_usage table ready');
  process.exit(0);
}

addTaskInventoryUsage().catch((e) => {
  console.error('❌ Error creating task_inventory_usage:', e);
  process.exit(1);
});
