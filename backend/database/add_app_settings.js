import db from './db.js';

async function addAppSettings() {
  try {
    await db.runAsync(`
      CREATE TABLE IF NOT EXISTS app_settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        key TEXT UNIQUE NOT NULL,
        value TEXT,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await db.runAsync('CREATE UNIQUE INDEX IF NOT EXISTS idx_app_settings_key ON app_settings(key)');
    console.log('✅ app_settings table ready');
  } catch (error) {
    console.error('❌ Error creating app_settings:', error);
    process.exit(1);
  }
  process.exit(0);
}

addAppSettings();
