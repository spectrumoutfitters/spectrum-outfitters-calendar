import db from './db.js';

const addClockHeaderSetting = async () => {
  try {
    // Check if column already exists
    const tableInfo = await db.allAsync("PRAGMA table_info(users)");
    const hasSetting = tableInfo.some(col => col.name === 'show_clock_in_header');
    
    if (!hasSetting) {
      await db.runAsync(`
        ALTER TABLE users ADD COLUMN show_clock_in_header BOOLEAN DEFAULT 1
      `);
      console.log('✅ Added show_clock_in_header column to users table');
    } else {
      console.log('✅ show_clock_in_header column already exists');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error adding show_clock_in_header column:', error);
    process.exit(1);
  }
};

addClockHeaderSetting();

