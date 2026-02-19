import db from './db.js';

async function addInventoryReturns() {
  try {
    await db.runAsync(`ALTER TABLE inventory_items ADD COLUMN needs_return INTEGER DEFAULT 0`).catch(() => {});
    await db.runAsync(`ALTER TABLE inventory_items ADD COLUMN return_supplier TEXT`).catch(() => {});
    await db.runAsync(`ALTER TABLE inventory_items ADD COLUMN returned_at DATETIME`).catch(() => {});
    console.log('✅ Inventory return fields ready (needs_return, return_supplier, returned_at)');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error adding inventory return fields:', error);
    process.exit(1);
  }
}

addInventoryReturns();
