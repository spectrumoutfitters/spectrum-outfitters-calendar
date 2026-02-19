import db from './db.js';

async function setDefaultLastLogin() {
  try {
    console.log('Setting default last_login for existing users...');
    
    // For users without last_login, set it to their most recent time entry clock_in
    // If they have no time entries, use their created_at date
    await db.runAsync(`
      UPDATE users
      SET last_login = (
        SELECT COALESCE(
          MAX(te.clock_in),
          users.created_at
        )
        FROM time_entries te
        WHERE te.user_id = users.id
      )
      WHERE last_login IS NULL
    `);
    
    const result = await db.getAsync(`
      SELECT COUNT(*) as count 
      FROM users 
      WHERE last_login IS NOT NULL
    `);
    
    console.log(`✅ Set default last_login for ${result.count} users`);
    console.log('   - Used most recent time entry clock_in if available');
    console.log('   - Otherwise used account created_at date');
  } catch (error) {
    console.error('❌ Error setting default last_login:', error);
    throw error;
  }
}

setDefaultLastLogin()
  .then(() => {
    console.log('Migration completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
  });

