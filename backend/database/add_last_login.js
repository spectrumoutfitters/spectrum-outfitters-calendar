import db from './db.js';

async function addLastLogin() {
  try {
    console.log('Adding last_login column to users table...');
    
    // Check if column already exists
    const tableInfo = await db.allAsync('PRAGMA table_info(users)');
    const hasLastLogin = tableInfo.some(col => col.name === 'last_login');
    
    if (hasLastLogin) {
      console.log('✅ last_login column already exists');
      return;
    }
    
    // Add last_login column
    await db.runAsync(`
      ALTER TABLE users ADD COLUMN last_login DATETIME
    `);
    
    console.log('✅ Successfully added last_login column to users table');
  } catch (error) {
    console.error('❌ Error adding last_login column:', error);
    throw error;
  }
}

addLastLogin()
  .then(() => {
    console.log('Migration completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
  });

