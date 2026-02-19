import db from './db.js';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const fixShopWideForeignKey = async () => {
  try {
    const dbPath = process.env.DATABASE_PATH 
      ? (path.isAbsolute(process.env.DATABASE_PATH) 
          ? process.env.DATABASE_PATH 
          : path.resolve(__dirname, process.env.DATABASE_PATH))
      : path.join(__dirname, 'shop_tasks.db');
    console.log('Using database at:', dbPath);
    
    // SQLite doesn't support ALTER COLUMN to make a column nullable
    // We need to recreate the table or use a workaround
    // For shop-wide entries, we'll allow user_id to be 0 (which won't match any user)
    // But we need to disable foreign key checks temporarily or handle it differently
    
    // Check if we can disable foreign key constraints
    await db.runAsync('PRAGMA foreign_keys = OFF');
    
    // Update any shop-wide entries to use NULL instead of 0
    await db.runAsync(`
      UPDATE schedule_entries 
      SET user_id = NULL 
      WHERE is_shop_wide = 1 AND user_id = 0
    `);
    
    // Re-enable foreign keys
    await db.runAsync('PRAGMA foreign_keys = ON');
    
    console.log('✅ Shop-wide foreign key issue fixed');
    console.log('Note: For shop-wide entries, user_id can be NULL');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error fixing shop-wide foreign key:', error);
    console.error('Error details:', error.message);
    process.exit(1);
  }
};

fixShopWideForeignKey();

