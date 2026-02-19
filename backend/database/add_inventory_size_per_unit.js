import db from './db.js';

async function addSizePerUnit() {
  try {
    await db.runAsync(`ALTER TABLE inventory_items ADD COLUMN size_per_unit TEXT`).catch(() => {});
    console.log('✅ Inventory size_per_unit ready (e.g. "32 oz" per bottle for fluids)');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error adding size_per_unit:', error);
    process.exit(1);
  }
}

addSizePerUnit();
