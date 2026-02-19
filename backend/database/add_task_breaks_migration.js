import db from './db.js';

const addTaskBreaksTable = async () => {
  try {
    // Create task_breaks table to track breaks during task work
    // db.js already handles the correct database path resolution
    await db.runAsync(`
      CREATE TABLE IF NOT EXISTS task_breaks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id),
        break_start DATETIME NOT NULL,
        break_end DATETIME,
        reason TEXT NOT NULL,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Indexes for better query performance
    await db.runAsync(`
      CREATE INDEX IF NOT EXISTS idx_task_breaks_task ON task_breaks(task_id)
    `);
    await db.runAsync(`
      CREATE INDEX IF NOT EXISTS idx_task_breaks_user ON task_breaks(user_id)
    `);
    await db.runAsync(`
      CREATE INDEX IF NOT EXISTS idx_task_breaks_start ON task_breaks(break_start)
    `);

    console.log('✅ Task breaks table created successfully');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating task breaks table:', error);
    process.exit(1);
  }
};

addTaskBreaksTable();

