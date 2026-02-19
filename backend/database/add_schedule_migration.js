import db from './db.js';

const addScheduleTable = async () => {
  try {
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

    console.log('Schedule table created successfully');
    process.exit(0);
  } catch (error) {
    console.error('Error adding schedule table:', error);
    process.exit(1);
  }
};

addScheduleTable();

