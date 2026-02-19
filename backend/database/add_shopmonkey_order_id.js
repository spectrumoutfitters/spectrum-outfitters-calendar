import db from './db.js';

const addShopMonkeyOrderId = async () => {
  try {
    // Add shopmonkey_order_id column to tasks table
    await db.runAsync(`
      ALTER TABLE tasks ADD COLUMN shopmonkey_order_id TEXT
    `).catch(() => {
      // Column might already exist
      console.log('shopmonkey_order_id column may already exist');
    });

    // Add shopmonkey_order_number column for easier searching
    await db.runAsync(`
      ALTER TABLE tasks ADD COLUMN shopmonkey_order_number TEXT
    `).catch(() => {
      // Column might already exist
      console.log('shopmonkey_order_number column may already exist');
    });

    // Add index for faster lookups
    await db.runAsync(`
      CREATE INDEX IF NOT EXISTS idx_tasks_shopmonkey_order_id 
      ON tasks(shopmonkey_order_id)
    `).catch(() => {
      // Index might already exist
      console.log('Index may already exist');
    });

    console.log('ShopMonkey order ID columns added successfully');
    process.exit(0);
  } catch (error) {
    console.error('Error adding ShopMonkey order ID columns:', error);
    process.exit(1);
  }
};

addShopMonkeyOrderId();

