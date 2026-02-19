import db from './db.js';

async function addOrderDetailsColumns() {
  try {
    await db.runAsync(`ALTER TABLE inventory_refill_requests ADD COLUMN ordered_from TEXT`).catch(() => {});
    await db.runAsync(`ALTER TABLE inventory_refill_requests ADD COLUMN order_price REAL`).catch(() => {});
    await db.runAsync(`ALTER TABLE inventory_refill_requests ADD COLUMN order_quantity REAL`).catch(() => {});
    console.log('✅ Refill order details columns ready');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error adding order details columns:', error);
    process.exit(1);
  }
}

addOrderDetailsColumns();
