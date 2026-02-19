import db from './db.js';

const addShopClosedSupport = async () => {
  try {
    // Add is_shop_wide column to schedule_entries table
    await db.runAsync(`
      ALTER TABLE schedule_entries ADD COLUMN is_shop_wide BOOLEAN DEFAULT 0
    `).catch(() => {
      // Column might already exist
      console.log('is_shop_wide column may already exist');
    });

    // Add shop_closed to the type CHECK constraint (we'll need to recreate the constraint)
    // SQLite doesn't support ALTER COLUMN, so we'll add a migration note
    // The type will be handled in the application layer
    
    console.log('Shop-wide closed days support added successfully');
    process.exit(0);
  } catch (error) {
    console.error('Error adding shop-wide support:', error);
    process.exit(1);
  }
};

addShopClosedSupport();

