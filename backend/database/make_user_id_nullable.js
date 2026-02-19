import db from './db.js';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const makeUserIdNullable = async () => {
  try {
    const dbPath = process.env.DATABASE_PATH 
      ? (path.isAbsolute(process.env.DATABASE_PATH) 
          ? process.env.DATABASE_PATH 
          : path.resolve(__dirname, process.env.DATABASE_PATH))
      : path.join(__dirname, 'shop_tasks.db');
    console.log('Using database at:', dbPath);
    
    // SQLite doesn't support ALTER COLUMN to change NOT NULL
    // We need to recreate the table
    console.log('Recreating schedule_entries table with nullable user_id...');
    
    // Disable foreign keys temporarily
    await db.runAsync('PRAGMA foreign_keys = OFF');
    
    // Create new table with nullable user_id
    await db.runAsync(`
      CREATE TABLE IF NOT EXISTS schedule_entries_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER REFERENCES users(id),
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        type TEXT CHECK(type IN ('day_off', 'time_off_request', 'approved_time_off')) DEFAULT 'day_off',
        status TEXT CHECK(status IN ('pending', 'approved', 'rejected', 'scheduled')) DEFAULT 'scheduled',
        reason TEXT,
        notes TEXT,
        created_by INTEGER REFERENCES users(id),
        approved_by INTEGER REFERENCES users(id),
        approved_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        is_shop_wide BOOLEAN DEFAULT 0
      )
    `);
    
    // Check if is_shop_wide column exists in old table
    const oldTableInfo = await db.allAsync('PRAGMA table_info(schedule_entries)');
    const hasShopWide = oldTableInfo.some(col => col.name === 'is_shop_wide');
    
    // Copy data from old table to new table
    if (hasShopWide) {
      // If is_shop_wide exists, copy all columns
      await db.runAsync(`
        INSERT INTO schedule_entries_new 
        SELECT * FROM schedule_entries
      `);
    } else {
      // If is_shop_wide doesn't exist, copy without it (will default to 0)
      await db.runAsync(`
        INSERT INTO schedule_entries_new 
        (id, user_id, start_date, end_date, type, status, reason, notes, created_by, approved_by, approved_at, created_at, updated_at)
        SELECT id, user_id, start_date, end_date, type, status, reason, notes, created_by, approved_by, approved_at, created_at, updated_at
        FROM schedule_entries
      `);
    }
    
    // Drop old table
    await db.runAsync('DROP TABLE schedule_entries');
    
    // Rename new table
    await db.runAsync('ALTER TABLE schedule_entries_new RENAME TO schedule_entries');
    
    // Recreate indexes
    await db.runAsync(`
      CREATE INDEX IF NOT EXISTS idx_schedule_user ON schedule_entries(user_id)
    `);
    await db.runAsync(`
      CREATE INDEX IF NOT EXISTS idx_schedule_dates ON schedule_entries(start_date, end_date)
    `);
    await db.runAsync(`
      CREATE INDEX IF NOT EXISTS idx_schedule_status ON schedule_entries(status)
    `);
    await db.runAsync(`
      CREATE INDEX IF NOT EXISTS idx_schedule_type ON schedule_entries(type)
    `);
    
    // Re-enable foreign keys
    await db.runAsync('PRAGMA foreign_keys = ON');
    
    console.log('✅ Schedule table recreated with nullable user_id');
    console.log('✅ Shop-wide entries can now use user_id = NULL');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error making user_id nullable:', error);
    console.error('Error details:', error.message);
    process.exit(1);
  }
};

makeUserIdNullable();

