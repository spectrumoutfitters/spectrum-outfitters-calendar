import db from './db.js';

const addWeeklySalaryColumn = async () => {
  try {
    // Check if column already exists
    const tableInfo = await db.allAsync("PRAGMA table_info(users)");
    const hasWeeklySalary = tableInfo.some(col => col.name === 'weekly_salary');
    
    if (!hasWeeklySalary) {
      await db.runAsync(`
        ALTER TABLE users ADD COLUMN weekly_salary DECIMAL(10,2) DEFAULT 0
      `);
      console.log('✅ Added weekly_salary column to users table');
    } else {
      console.log('✅ weekly_salary column already exists');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error adding weekly_salary column:', error);
    process.exit(1);
  }
};

addWeeklySalaryColumn();

