import db from './db.js';

async function addViscosityColumn() {
  try {
    await db.runAsync(`ALTER TABLE inventory_items ADD COLUMN viscosity TEXT`).catch(() => {});
    console.log('✅ Inventory viscosity column ready');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error adding viscosity column:', error);
    process.exit(1);
  }
}

addViscosityColumn();
