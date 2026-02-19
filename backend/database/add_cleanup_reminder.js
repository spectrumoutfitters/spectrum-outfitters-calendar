import db from './db.js';

async function addCleanupReminder() {
  try {
    console.log('Adding cleanup_reminder_settings table...');
    
    // Create settings table if it doesn't exist
    await db.runAsync(`
      CREATE TABLE IF NOT EXISTS cleanup_reminder_settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        message TEXT NOT NULL DEFAULT 'Great work today! Before you head out, let''s finish strong by ensuring our entire shop is clean and ready for tomorrow. A clean shop is a professional shop, and it shows pride in our work. Thank you for being part of a team that takes pride in our workspace!',
        enabled INTEGER DEFAULT 1,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_by INTEGER,
        FOREIGN KEY (updated_by) REFERENCES users(id)
      )
    `);

    // Insert default settings if none exist
    const existing = await db.getAsync('SELECT * FROM cleanup_reminder_settings LIMIT 1');
    if (!existing) {
      await db.runAsync(`
        INSERT INTO cleanup_reminder_settings (message, enabled)
        VALUES (?, ?)
      `, [
        'Great work today! Before you head out, let\'s finish strong by ensuring our entire shop is clean and ready for tomorrow. A clean shop is a professional shop, and it shows pride in our work. Thank you for being part of a team that takes pride in our workspace!',
        1
      ]);
      console.log('✅ Default cleanup reminder settings created');
    } else {
      console.log('✅ Cleanup reminder settings already exist');
    }

    console.log('✅ Cleanup reminder migration completed successfully');
  } catch (error) {
    console.error('❌ Error adding cleanup reminder settings:', error);
    throw error;
  }
}

addCleanupReminder()
  .then(() => {
    console.log('Migration completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
  });

