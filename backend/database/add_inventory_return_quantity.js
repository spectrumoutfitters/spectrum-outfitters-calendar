import db from './db.js';

async function addReturnQuantity() {
  try {
    await db.runAsync(`ALTER TABLE inventory_items ADD COLUMN return_quantity INTEGER`).catch(() => {});
    console.log('✅ Inventory return_quantity column ready');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error adding return_quantity:', error);
    process.exit(1);
  }
}

addReturnQuantity();
