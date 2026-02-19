import db from './db.js';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const createScheduleTable = async () => {
  try {
    // Log which database we're using
    const dbPath = process.env.DATABASE_PATH 
      ? (path.isAbsolute(process.env.DATABASE_PATH) 
          ? process.env.DATABASE_PATH 
          : path.resolve(__dirname, process.env.DATABASE_PATH))
      : path.join(__dirname, 'shop_tasks.db');
    console.log('Using database at:', dbPath);
    console.log('Creating schedule_entries table...');
    
    // Schedule table for days off and time off requests
    await db.runAsync(`
      CREATE TABLE IF NOT EXISTS schedule_entries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER REFERENCES users(id) NOT NULL,
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
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Indexes for better query performance
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

    // Verify table was created
    const tableCheck = await db.allAsync(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name='schedule_entries'
    `);
    
    if (tableCheck.length > 0) {
      console.log('✅ Schedule table created successfully!');
      const columns = await db.allAsync('PRAGMA table_info(schedule_entries)');
      console.log(`✅ Table has ${columns.length} columns`);
    } else {
      console.error('❌ Table was not created');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating schedule table:', error);
    console.error('Error details:', error.message);
    process.exit(1);
  }
};

createScheduleTable();

