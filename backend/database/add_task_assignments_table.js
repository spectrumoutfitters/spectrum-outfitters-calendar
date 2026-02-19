import db from './db.js';

const addTaskAssignmentsTable = async () => {
  try {
    // Create task_assignments table for many-to-many relationship
    await db.runAsync(`
      CREATE TABLE IF NOT EXISTS task_assignments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        assigned_by INTEGER REFERENCES users(id),
        UNIQUE(task_id, user_id)
      )
    `);

    // Migrate existing assigned_to data to task_assignments
    const existingTasks = await db.allAsync('SELECT id, assigned_to FROM tasks WHERE assigned_to IS NOT NULL');
    
    for (const task of existingTasks) {
      // Check if assignment already exists
      const existing = await db.getAsync(
        'SELECT id FROM task_assignments WHERE task_id = ? AND user_id = ?',
        [task.id, task.assigned_to]
      );
      
      if (!existing) {
        await db.runAsync(
          'INSERT INTO task_assignments (task_id, user_id, assigned_at) VALUES (?, ?, CURRENT_TIMESTAMP)',
          [task.id, task.assigned_to]
        );
        console.log(`Migrated assignment: Task ${task.id} -> User ${task.assigned_to}`);
      }
    }

    console.log('✅ Created task_assignments table and migrated existing data');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating task_assignments table:', error);
    process.exit(1);
  }
};

addTaskAssignmentsTable();

