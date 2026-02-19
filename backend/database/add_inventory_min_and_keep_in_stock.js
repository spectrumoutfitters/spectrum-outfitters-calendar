import db from './db.js';

async function addMinAndKeepInStock() {
  try {
    await db.runAsync(`ALTER TABLE inventory_items ADD COLUMN min_quantity REAL`).catch(() => {});
    await db.runAsync(`ALTER TABLE inventory_items ADD COLUMN keep_in_stock INTEGER DEFAULT 1`).catch(() => {});
    console.log('✅ Inventory min_quantity and keep_in_stock ready');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error adding columns:', error);
    process.exit(1);
  }
}

addMinAndKeepInStock();
