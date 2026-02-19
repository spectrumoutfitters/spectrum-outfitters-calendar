import db from './db.js';

async function addScanLogTable() {
  try {
    await db.runAsync(`
      CREATE TABLE IF NOT EXISTS inventory_scan_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        item_id INTEGER NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
        barcode TEXT NOT NULL,
        scanned_by INTEGER NOT NULL REFERENCES users(id),
        event_type TEXT NOT NULL DEFAULT 'quantity_increase' CHECK(event_type IN ('quantity_increase', 'refill_receive')),
        refill_request_id INTEGER REFERENCES inventory_refill_requests(id),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await db.runAsync(`CREATE INDEX IF NOT EXISTS idx_scan_log_item ON inventory_scan_log(item_id)`);
    await db.runAsync(`CREATE INDEX IF NOT EXISTS idx_scan_log_created ON inventory_scan_log(created_at)`);
    await db.runAsync(`CREATE INDEX IF NOT EXISTS idx_scan_log_barcode ON inventory_scan_log(barcode)`);
    console.log('✅ inventory_scan_log table ready');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating scan log table:', error);
    process.exit(1);
  }
}

addScanLogTable();
