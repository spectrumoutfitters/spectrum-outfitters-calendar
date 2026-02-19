import db from './db.js';

const addUpdatesSystem = async () => {
  try {
    // Create system_updates table
    await db.runAsync(`
      CREATE TABLE IF NOT EXISTS system_updates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        version TEXT,
        update_type TEXT CHECK(update_type IN ('feature', 'bugfix', 'improvement', 'announcement', 'maintenance')) DEFAULT 'feature',
        priority TEXT CHECK(priority IN ('low', 'medium', 'high', 'critical')) DEFAULT 'medium',
        is_active INTEGER DEFAULT 1,
        is_pending INTEGER DEFAULT 1,
        approved_by INTEGER REFERENCES users(id),
        approved_at DATETIME,
        show_on_login INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        created_by INTEGER REFERENCES users(id)
      )
    `);
    console.log('✅ Created system_updates table');

    // Create system_updates_read table to track which users have seen which updates
    await db.runAsync(`
      CREATE TABLE IF NOT EXISTS system_updates_read (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        update_id INTEGER NOT NULL REFERENCES system_updates(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        read_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(update_id, user_id)
      )
    `);
    console.log('✅ Created system_updates_read table');

    // Create indexes for better performance
    await db.runAsync(`
      CREATE INDEX IF NOT EXISTS idx_updates_active 
      ON system_updates(is_active, show_on_login, created_at DESC)
    `);
    await db.runAsync(`
      CREATE INDEX IF NOT EXISTS idx_updates_read_user 
      ON system_updates_read(user_id, read_at DESC)
    `);
    await db.runAsync(`
      CREATE INDEX IF NOT EXISTS idx_updates_read_update 
      ON system_updates_read(update_id)
    `);
    console.log('✅ Created indexes');

    console.log('\n✅ System updates tables created successfully!');
  } catch (error) {
    console.error('❌ Error creating system updates tables:', error);
    throw error;
  }
};

addUpdatesSystem()
  .then(() => {
    console.log('Migration completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
  });
