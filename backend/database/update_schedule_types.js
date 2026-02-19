import db from './db.js';

const updateScheduleTypes = async () => {
  try {
    // Check if table exists
    const tableInfo = await db.allAsync(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name='schedule_entries'
    `);
    
    if (tableInfo.length === 0) {
      console.log('Schedule table does not exist. Run add_schedule_migration.js first.');
      process.exit(0);
    }

    // SQLite doesn't support ALTER TABLE to modify CHECK constraints
    // We need to recreate the table with the new constraint
    console.log('Updating schedule_entries table to support more types...');
    
    // Step 1: Create new table with updated types
    await db.runAsync(`
      CREATE TABLE IF NOT EXISTS schedule_entries_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER REFERENCES users(id),
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        type TEXT CHECK(type IN ('day_off', 'time_off_request', 'approved_time_off', 'out_of_office', 'vacation', 'sick_leave', 'personal_leave', 'training', 'meeting', 'other')) DEFAULT 'day_off',
        status TEXT CHECK(status IN ('pending', 'approved', 'rejected', 'scheduled')) DEFAULT 'scheduled',
        reason TEXT,
        notes TEXT,
        created_by INTEGER REFERENCES users(id),
        approved_by INTEGER REFERENCES users(id),
        approved_at DATETIME,
        is_shop_wide INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Step 2: Copy all data from old table to new table
    await db.runAsync(`
      INSERT INTO schedule_entries_new 
      (id, user_id, start_date, end_date, type, status, reason, notes, created_by, approved_by, approved_at, is_shop_wide, created_at, updated_at)
      SELECT 
        id, user_id, start_date, end_date, type, status, reason, notes, created_by, approved_by, approved_at,
        COALESCE(is_shop_wide, 0) as is_shop_wide,
        created_at, updated_at
      FROM schedule_entries
    `);

    // Step 3: Drop old table
    await db.runAsync(`DROP TABLE schedule_entries`);

    // Step 4: Rename new table to original name
    await db.runAsync(`ALTER TABLE schedule_entries_new RENAME TO schedule_entries`);

    // Step 5: Recreate indexes
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
    await db.runAsync(`
      CREATE INDEX IF NOT EXISTS idx_schedule_shop_wide ON schedule_entries(is_shop_wide)
    `);

    console.log('✅ Successfully updated schedule_entries table with new types!');
    console.log('✅ New types available: day_off, time_off_request, approved_time_off, out_of_office, vacation, sick_leave, personal_leave, training, meeting, other');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error updating schedule types:', error);
    console.error('Error details:', error.message);
    process.exit(1);
  }
};

updateScheduleTypes();
