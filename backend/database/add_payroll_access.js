import db from './db.js';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const addPayrollAccess = async () => {
  try {
    const dbPath = process.env.DATABASE_PATH 
      ? (path.isAbsolute(process.env.DATABASE_PATH) 
          ? process.env.DATABASE_PATH 
          : path.resolve(__dirname, process.env.DATABASE_PATH))
      : path.join(__dirname, 'shop_tasks.db');
    console.log('Using database at:', dbPath);
    
    // Add payroll_access column to users table
    await db.runAsync(`
      ALTER TABLE users ADD COLUMN payroll_access BOOLEAN DEFAULT 0
    `).catch((err) => {
      if (err.message.includes('duplicate column')) {
        console.log('payroll_access column already exists');
      } else {
        throw err;
      }
    });

    // Add is_master_admin column to users table
    await db.runAsync(`
      ALTER TABLE users ADD COLUMN is_master_admin BOOLEAN DEFAULT 0
    `).catch((err) => {
      if (err.message.includes('duplicate column')) {
        console.log('is_master_admin column already exists');
      } else {
        throw err;
      }
    });

    // Set Neel as master admin (check by username or full_name)
    await db.runAsync(`
      UPDATE users 
      SET is_master_admin = 1 
      WHERE LOWER(username) = 'neel' OR LOWER(full_name) LIKE '%neel%'
    `).catch((err) => {
      console.warn('Error setting master admin:', err.message);
    });

    // Grant payroll access to master admin
    await db.runAsync(`
      UPDATE users 
      SET payroll_access = 1 
      WHERE is_master_admin = 1
    `).catch((err) => {
      console.warn('Error granting payroll access to master admin:', err.message);
    });

    console.log('✅ Payroll access columns added successfully');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error adding payroll access:', error);
    console.error('Error details:', error.message);
    process.exit(1);
  }
};

addPayrollAccess();

