import db from './db.js';

async function addImageUrlColumn() {
  try {
    await db.runAsync(`ALTER TABLE inventory_items ADD COLUMN image_url TEXT`).catch(() => {});
    console.log('✅ Inventory image_url column ready');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error adding image_url column:', error);
    process.exit(1);
  }
}

addImageUrlColumn();
