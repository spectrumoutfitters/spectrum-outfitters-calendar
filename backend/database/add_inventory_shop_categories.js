import db from './db.js';

/**
 * Add shop-friendly inventory categories for existing databases.
 * New installs get these from add_inventory_tables.js seed.
 */
async function addShopCategories() {
  const categories = [
    { name: 'Parts', sort_order: 40 },
    { name: 'Fasteners', sort_order: 50 },
    { name: 'Filters', sort_order: 60 },
    { name: 'Belts & Hoses', sort_order: 70 },
    { name: 'Spray Paint & Coatings', sort_order: 30 }
  ];

  for (const c of categories) {
    await db.runAsync(
      `INSERT OR IGNORE INTO inventory_categories (name, sort_order) VALUES (?, ?)`,
      [c.name, c.sort_order]
    );
  }

  console.log('✅ Shop categories ready (Parts, Fasteners, Filters, Belts & Hoses, Spray Paint & Coatings)');
  process.exit(0);
}

addShopCategories().catch((e) => {
  console.error('❌ Error adding shop categories:', e);
  process.exit(1);
});
