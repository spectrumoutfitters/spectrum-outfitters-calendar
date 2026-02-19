import db from './db.js';

async function addRefillTables() {
  try {
    await db.runAsync(`
      CREATE TABLE IF NOT EXISTS inventory_refill_requests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        item_id INTEGER NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
        requested_by INTEGER NOT NULL REFERENCES users(id),
        requested_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'ordered', 'received', 'cancelled')),
        expected_arrival_date DATE,
        admin_notes TEXT,
        received_at DATETIME,
        received_by INTEGER REFERENCES users(id),
        quantity_received REAL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await db.runAsync(`CREATE INDEX IF NOT EXISTS idx_refill_requests_item ON inventory_refill_requests(item_id)`);
    await db.runAsync(`CREATE INDEX IF NOT EXISTS idx_refill_requests_status ON inventory_refill_requests(status)`);
    await db.runAsync(`CREATE INDEX IF NOT EXISTS idx_refill_requests_expected ON inventory_refill_requests(expected_arrival_date)`);

    await db.runAsync(`
      CREATE TABLE IF NOT EXISTS inventory_quantity_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        item_id INTEGER NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
        quantity_before REAL NOT NULL,
        quantity_after REAL NOT NULL,
        changed_by INTEGER REFERENCES users(id),
        reason TEXT NOT NULL DEFAULT 'count' CHECK(reason IN ('count', 'refill_received')),
        refill_request_id INTEGER REFERENCES inventory_refill_requests(id),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await db.runAsync(`CREATE INDEX IF NOT EXISTS idx_quantity_log_item ON inventory_quantity_log(item_id)`);
    await db.runAsync(`CREATE INDEX IF NOT EXISTS idx_quantity_log_created ON inventory_quantity_log(created_at)`);

    console.log('✅ Inventory refill requests and quantity log tables ready');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating refill tables:', error);
    process.exit(1);
  }
}

addRefillTables();
