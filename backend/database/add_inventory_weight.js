import db from './db.js';

async function addWeightColumns() {
  try {
    await db.runAsync(`ALTER TABLE inventory_items ADD COLUMN weight REAL`).catch(() => {});
    await db.runAsync(`ALTER TABLE inventory_items ADD COLUMN weight_unit TEXT`).catch(() => {});
    console.log('✅ Inventory weight columns ready');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error adding weight columns:', error);
    process.exit(1);
  }
}

addWeightColumns();
