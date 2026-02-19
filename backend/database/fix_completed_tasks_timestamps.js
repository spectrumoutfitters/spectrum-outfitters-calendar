import db from './db.js';

const fixCompletedTasksTimestamps = async () => {
  try {
    console.log('Fixing completed tasks that are missing completed_at timestamps...');
    
    // Find all tasks that are marked as completed but don't have completed_at set
    const tasksToFix = await db.allAsync(`
      SELECT id, title, status, updated_at
      FROM tasks
      WHERE status = 'completed' 
        AND completed_at IS NULL
    `);
    
    if (tasksToFix.length === 0) {
      console.log('✅ No tasks need fixing. All completed tasks have completed_at timestamps.');
      process.exit(0);
    }
    
    console.log(`Found ${tasksToFix.length} completed task(s) missing completed_at timestamp:`);
    tasksToFix.forEach(task => {
      console.log(`  - Task #${task.id}: "${task.title}"`);
    });
    
    // Fix each task by setting completed_at to updated_at (or current time if updated_at is null)
    let fixedCount = 0;
    for (const task of tasksToFix) {
      const completedAt = task.updated_at || new Date().toISOString();
      
      await db.runAsync(`
        UPDATE tasks
        SET completed_at = ?
        WHERE id = ?
      `, [completedAt, task.id]);
      
      fixedCount++;
      console.log(`  ✓ Fixed task #${task.id}`);
    }
    
    console.log(`\n✅ Successfully fixed ${fixedCount} task(s)!`);
    process.exit(0);
  } catch (error) {
    console.error('❌ Error fixing completed tasks:', error);
    console.error('Error details:', error.message);
    process.exit(1);
  }
};

fixCompletedTasksTimestamps();
