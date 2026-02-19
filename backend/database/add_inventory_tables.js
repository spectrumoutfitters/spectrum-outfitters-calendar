import db from './db.js';

const seedCategories = async () => {
  const categories = [
    { name: 'Oils & Fluids', sort_order: 10 },
    { name: 'Cleaning', sort_order: 20 },
    { name: 'Spray Paint & Coatings', sort_order: 30 },
    { name: 'Parts', sort_order: 40 },
    { name: 'Fasteners', sort_order: 50 },
    { name: 'Filters', sort_order: 60 },
    { name: 'Belts & Hoses', sort_order: 70 },
    { name: 'Hardware', sort_order: 80 },
    { name: 'Other', sort_order: 999 }
  ];

  for (const c of categories) {
    await db.runAsync(
      `INSERT OR IGNORE INTO inventory_categories (name, sort_order) VALUES (?, ?)`,
      [c.name, c.sort_order]
    );
  }
};

const addInventoryTables = async () => {
  try {
    await db.runAsync(`
      CREATE TABLE IF NOT EXISTS inventory_categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        sort_order INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await db.runAsync(`
      CREATE TABLE IF NOT EXISTS inventory_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        barcode TEXT UNIQUE,
        name TEXT NOT NULL,
        category_id INTEGER REFERENCES inventory_categories(id),
        unit TEXT DEFAULT 'each',
        price DECIMAL(10,2),
        quantity REAL DEFAULT 0,
        last_counted_at DATETIME,
        last_counted_by INTEGER REFERENCES users(id),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await db.runAsync(`CREATE INDEX IF NOT EXISTS idx_inventory_items_barcode ON inventory_items(barcode)`);
    await db.runAsync(`CREATE INDEX IF NOT EXISTS idx_inventory_items_category ON inventory_items(category_id)`);
    await db.runAsync(`CREATE INDEX IF NOT EXISTS idx_inventory_items_name ON inventory_items(name)`);

    await seedCategories();

    console.log('✅ Inventory tables ready (inventory_categories, inventory_items)');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating inventory tables:', error);
    process.exit(1);
  }
};

addInventoryTables();

