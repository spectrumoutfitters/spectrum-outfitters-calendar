import db from './db.js';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const addBoardTypeColumn = async () => {
  try {
    const dbPath = process.env.DATABASE_PATH 
      ? (path.isAbsolute(process.env.DATABASE_PATH) 
          ? process.env.DATABASE_PATH 
          : path.resolve(__dirname, process.env.DATABASE_PATH))
      : path.join(__dirname, 'shop_tasks.db');
    console.log('Using database at:', dbPath);
    
    // Add board_type column to messages table
    // 'admin_board' = Admin Board (admin only)
    // 'team_board' = Team Board (everyone)
    // NULL or 'team' = legacy team messages (convert to 'admin_board' for backward compatibility)
    await db.runAsync(`
      ALTER TABLE messages ADD COLUMN board_type TEXT CHECK(board_type IN ('admin_board', 'team_board'))
    `).catch(() => {
      console.log('board_type column may already exist');
    });

    // Convert existing team messages to admin_board (backward compatibility)
    await db.runAsync(`
      UPDATE messages 
      SET board_type = 'admin_board' 
      WHERE is_team_message = 1 AND (board_type IS NULL OR board_type = '')
    `);

    console.log('✅ Board type column added successfully');
    console.log('✅ Existing team messages converted to admin_board');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error adding board_type column:', error);
    console.error('Error details:', error.message);
    process.exit(1);
  }
};

addBoardTypeColumn();

