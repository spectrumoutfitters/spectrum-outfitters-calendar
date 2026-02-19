import db from './db.js';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const setMasterAdmin = async () => {
  try {
    const dbPath = process.env.DATABASE_PATH 
      ? (path.isAbsolute(process.env.DATABASE_PATH) 
          ? process.env.DATABASE_PATH 
          : path.resolve(__dirname, process.env.DATABASE_PATH))
      : path.join(__dirname, 'shop_tasks.db');
    console.log('Using database at:', dbPath);
    
    // Get all users to show who we're updating
    const allUsers = await db.allAsync('SELECT id, username, full_name, role, is_master_admin, payroll_access FROM users');
    console.log('\nCurrent users:');
    allUsers.forEach(u => {
      console.log(`  ID: ${u.id}, Username: ${u.username}, Name: ${u.full_name}, Role: ${u.role}, Master: ${u.is_master_admin === 1 ? 'Yes' : 'No'}, Payroll: ${u.payroll_access === 1 ? 'Yes' : 'No'}`);
    });

    // Set Neel as master admin (check by username or full_name)
    const result = await db.runAsync(`
      UPDATE users 
      SET is_master_admin = 1, payroll_access = 1
      WHERE LOWER(username) = 'neel' OR LOWER(full_name) LIKE '%neel%'
    `);

    if (result.changes === 0) {
      console.log('\n⚠️  No user found with username "neel" or name containing "neel"');
      console.log('Please provide your exact username to set as master admin.');
      
      // Show admin users
      const admins = await db.allAsync('SELECT id, username, full_name FROM users WHERE role = ?', ['admin']);
      if (admins.length > 0) {
        console.log('\nAvailable admin users:');
        admins.forEach(a => {
          console.log(`  ID: ${a.id}, Username: ${a.username}, Name: ${a.full_name}`);
        });
      }
    } else {
      console.log(`\n✅ Successfully set ${result.changes} user(s) as master admin`);
      
      // Verify the update
      const updatedUsers = await db.allAsync(`
        SELECT id, username, full_name, is_master_admin, payroll_access 
        FROM users 
        WHERE is_master_admin = 1
      `);
      console.log('\nMaster admin users:');
      updatedUsers.forEach(u => {
        console.log(`  ID: ${u.id}, Username: ${u.username}, Name: ${u.full_name}`);
      });
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error setting master admin:', error);
    console.error('Error details:', error.message);
    process.exit(1);
  }
};

setMasterAdmin();

