import db from './db.js';

const addSubtasksTable = async () => {
  try {
    // Add subtasks table
    await db.runAsync(`
      CREATE TABLE IF NOT EXISTS task_subtasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        is_completed BOOLEAN DEFAULT 0,
        completed_at DATETIME,
        completed_by INTEGER REFERENCES users(id),
        order_index INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Update tasks table to add archived status and admin_approved field
    await db.runAsync(`
      ALTER TABLE tasks ADD COLUMN is_archived BOOLEAN DEFAULT 0
    `).catch(() => {
      // Column might already exist
      console.log('is_archived column may already exist');
    });

    await db.runAsync(`
      ALTER TABLE tasks ADD COLUMN admin_approved BOOLEAN DEFAULT 0
    `).catch(() => {
      // Column might already exist
      console.log('admin_approved column may already exist');
    });

    await db.runAsync(`
      ALTER TABLE tasks ADD COLUMN torqued_to_spec BOOLEAN DEFAULT 0
    `).catch(() => {
      // Column might already exist
      console.log('torqued_to_spec column may already exist');
    });

    await db.runAsync(`
      ALTER TABLE tasks ADD COLUMN submitted_for_review_at DATETIME
    `).catch(() => {
      // Column might already exist
      console.log('submitted_for_review_at column may already exist');
    });

    console.log('Subtasks table and task enhancements added successfully');
    process.exit(0);
  } catch (error) {
    console.error('Error adding subtasks table:', error);
    process.exit(1);
  }
};

addSubtasksTable();

