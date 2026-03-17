import db from './db.js';

/**
 * Add location + vendor + Amazon helper fields to inventory_items:
 * - location (where to find it in the shop)
 * - location_notes (optional extra detail)
 * - preferred_vendor (who we like to buy from)
 * - amazon_asin / amazon_url (fast reorder helpers)
 */
export async function addInventoryLocationVendorAmazonColumns() {
  const columns = [
    { name: 'location', sql: 'ALTER TABLE inventory_items ADD COLUMN location TEXT' },
    { name: 'location_notes', sql: 'ALTER TABLE inventory_items ADD COLUMN location_notes TEXT' },
    { name: 'preferred_vendor', sql: 'ALTER TABLE inventory_items ADD COLUMN preferred_vendor TEXT' },
    { name: 'amazon_asin', sql: 'ALTER TABLE inventory_items ADD COLUMN amazon_asin TEXT' },
    { name: 'amazon_url', sql: 'ALTER TABLE inventory_items ADD COLUMN amazon_url TEXT' },
  ];

  try {
    const info = await db.allAsync('PRAGMA table_info(inventory_items)');
    const names = new Set((info || []).map((c) => c.name));
    for (const col of columns) {
      if (!names.has(col.name)) {
        try {
          await db.runAsync(col.sql);
        } catch (e) {
          // Column may already exist in a concurrent run; ignore
        }
      }
    }

    await db
      .runAsync('CREATE INDEX IF NOT EXISTS idx_inventory_items_location ON inventory_items(location)')
      .catch(() => {});
    await db
      .runAsync('CREATE INDEX IF NOT EXISTS idx_inventory_items_vendor ON inventory_items(preferred_vendor)')
      .catch(() => {});
    await db
      .runAsync('CREATE INDEX IF NOT EXISTS idx_inventory_items_asin ON inventory_items(amazon_asin)')
      .catch(() => {});

    console.log('✅ inventory_items location/vendor/Amazon columns ready');
  } catch (e) {
    console.warn('inventory location/vendor/Amazon columns migration warning:', e.message);
  }
}

