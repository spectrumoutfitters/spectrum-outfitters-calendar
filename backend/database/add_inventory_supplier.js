import db from './db.js';

/**
 * Add supplier fields to inventory_items:
 * supplier_name, supplier_contact, supplier_part_number, reorder_cost
 */
export async function addInventorySupplierColumns() {
  const columns = [
    { name: 'supplier_name', sql: 'ALTER TABLE inventory_items ADD COLUMN supplier_name TEXT' },
    { name: 'supplier_contact', sql: 'ALTER TABLE inventory_items ADD COLUMN supplier_contact TEXT' },
    { name: 'supplier_part_number', sql: 'ALTER TABLE inventory_items ADD COLUMN supplier_part_number TEXT' },
    { name: 'reorder_cost', sql: 'ALTER TABLE inventory_items ADD COLUMN reorder_cost REAL' },
  ];
  try {
    const info = await db.allAsync('PRAGMA table_info(inventory_items)');
    const names = new Set((info || []).map(c => c.name));
    for (const col of columns) {
      if (!names.has(col.name)) {
        try {
          await db.runAsync(col.sql);
        } catch (e) {
          // Column may already exist in a concurrent run; ignore
        }
      }
    }
    console.log('✅ inventory_items supplier columns ready');
  } catch (e) {
    console.warn('inventory supplier columns migration warning:', e.message);
  }
}
