import db from './db.js';

const addCleanupAcknowledgmentsTable = async () => {
  try {
    // Create cleanup_acknowledgments table
    await db.runAsync(`
      CREATE TABLE IF NOT EXISTS cleanup_acknowledgments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL REFERENCES users(id),
        time_entry_id INTEGER REFERENCES time_entries(id),
        acknowledgment_date DATE NOT NULL,
        acknowledged_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        message_shown TEXT,
        UNIQUE(user_id, acknowledgment_date)
      )
    `);
    console.log('✅ Created cleanup_acknowledgments table');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating cleanup_acknowledgments table:', error);
    process.exit(1);
  }
};

addCleanupAcknowledgmentsTable();
