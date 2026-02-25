import db from './db.js';

/**
 * Table for ad-hoc inventory scan-outs (use item not tied to a task).
 * Admins can list and acknowledge these.
 */
async function addAdHocScanOutTable() {
  try {
    await db.runAsync(`
      CREATE TABLE IF NOT EXISTS inventory_ad_hoc_scan_out (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        item_id INTEGER NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
        quantity_used REAL NOT NULL,
        used_by INTEGER NOT NULL REFERENCES users(id),
        reason_text TEXT NOT NULL,
        barcode_scanned TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        acknowledged_at DATETIME,
        acknowledged_by INTEGER REFERENCES users(id)
      )
    `);
    await db.runAsync('CREATE INDEX IF NOT EXISTS idx_ad_hoc_scan_out_item ON inventory_ad_hoc_scan_out(item_id)');
    await db.runAsync('CREATE INDEX IF NOT EXISTS idx_ad_hoc_scan_out_created ON inventory_ad_hoc_scan_out(created_at)');
    await db.runAsync('CREATE INDEX IF NOT EXISTS idx_ad_hoc_scan_out_ack ON inventory_ad_hoc_scan_out(acknowledged_at)');
    console.log('✅ inventory_ad_hoc_scan_out table ready');
  } catch (error) {
    console.error('❌ Error creating ad-hoc scan out table:', error);
    process.exit(1);
  }
  process.exit(0);
}

addAdHocScanOutTable();
