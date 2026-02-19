import db from './db.js';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const addTaskTimeTracking = async () => {
  try {
    const dbPath = process.env.DATABASE_PATH 
      ? (path.isAbsolute(process.env.DATABASE_PATH) 
          ? process.env.DATABASE_PATH 
          : path.resolve(__dirname, process.env.DATABASE_PATH))
      : path.join(__dirname, 'shop_tasks.db');
    console.log('Using database at:', dbPath);
    
    // Add started_at to tasks table
    await db.runAsync(`
      ALTER TABLE tasks ADD COLUMN started_at DATETIME
    `).catch(() => {
      console.log('started_at column may already exist');
    });

    // Add started_by to tasks table (who started the task)
    await db.runAsync(`
      ALTER TABLE tasks ADD COLUMN started_by INTEGER REFERENCES users(id)
    `).catch(() => {
      console.log('started_by column may already exist');
    });

    // Add completed_at to tasks table (when task was completed)
    await db.runAsync(`
      ALTER TABLE tasks ADD COLUMN completed_at DATETIME
    `).catch(() => {
      console.log('completed_at column may already exist');
    });

    // Add completed_by to tasks table (who completed the task)
    await db.runAsync(`
      ALTER TABLE tasks ADD COLUMN completed_by INTEGER REFERENCES users(id)
    `).catch(() => {
      console.log('completed_by column may already exist');
    });

    console.log('✅ Task time tracking columns added successfully');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error adding task time tracking:', error);
    console.error('Error details:', error.message);
    process.exit(1);
  }
};

addTaskTimeTracking();

