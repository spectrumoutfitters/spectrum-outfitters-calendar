import db from './db.js';

const addZelleAchPayments = async () => {
  try {
    // Check if column already exists
    const tableInfo = await db.allAsync("PRAGMA table_info(sales_daily_summary)");
    const hasZelleAch = tableInfo.some(col => col.name === 'zelle_ach_amount');
    
    if (!hasZelleAch) {
      await db.runAsync(`
        ALTER TABLE sales_daily_summary ADD COLUMN zelle_ach_amount DECIMAL(10,2) DEFAULT 0
      `);
      console.log('✅ Added zelle_ach_amount column to sales_daily_summary table');
    } else {
      console.log('✅ zelle_ach_amount column already exists');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error adding zelle_ach_amount column:', error);
    process.exit(1);
  }
};

addZelleAchPayments();
