import db from './db.js';

const addMessagesTable = async () => {
  try {
    // Messages table for team chat and private messages
    await db.runAsync(`
      CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sender_id INTEGER REFERENCES users(id) NOT NULL,
        recipient_id INTEGER REFERENCES users(id),
        message TEXT NOT NULL,
        is_team_message BOOLEAN DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        read_at DATETIME
      )
    `);

    // Message read status for tracking unread messages
    await db.runAsync(`
      CREATE TABLE IF NOT EXISTS message_reads (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        message_id INTEGER REFERENCES messages(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id),
        read_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(message_id, user_id)
      )
    `);

    // Indexes for better query performance
    await db.runAsync(`
      CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id)
    `);
    await db.runAsync(`
      CREATE INDEX IF NOT EXISTS idx_messages_recipient ON messages(recipient_id)
    `);
    await db.runAsync(`
      CREATE INDEX IF NOT EXISTS idx_messages_team ON messages(is_team_message)
    `);
    await db.runAsync(`
      CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at)
    `);

    console.log('Messages tables created successfully');
    process.exit(0);
  } catch (error) {
    console.error('Error adding messages tables:', error);
    process.exit(1);
  }
};

addMessagesTable();

