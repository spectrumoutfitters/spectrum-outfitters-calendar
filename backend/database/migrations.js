import db from './db.js';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

const createTables = async () => {
  try {
    // Users table
    await db.runAsync(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        email TEXT,
        full_name TEXT NOT NULL,
        role TEXT CHECK(role IN ('admin', 'employee')) DEFAULT 'employee',
        hourly_rate DECIMAL(10,2) DEFAULT 0,
        is_active BOOLEAN DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Tasks table
    await db.runAsync(`
      CREATE TABLE IF NOT EXISTS tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT,
        assigned_to INTEGER REFERENCES users(id),
        created_by INTEGER REFERENCES users(id),
        status TEXT CHECK(status IN ('todo', 'in_progress', 'review', 'completed')) DEFAULT 'todo',
        priority TEXT CHECK(priority IN ('low', 'medium', 'high', 'urgent')) DEFAULT 'medium',
        category TEXT CHECK(category IN ('PPF', 'Tinting', 'Wraps', 'Maintenance', 'Upfitting', 'Signs', 'Admin', 'Other')) DEFAULT 'Other',
        due_date DATE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Time entries table
    await db.runAsync(`
      CREATE TABLE IF NOT EXISTS time_entries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER REFERENCES users(id),
        clock_in DATETIME NOT NULL,
        clock_out DATETIME,
        break_minutes INTEGER DEFAULT 0,
        notes TEXT,
        approved_by INTEGER REFERENCES users(id),
        week_ending_date DATE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Task comments table
    await db.runAsync(`
      CREATE TABLE IF NOT EXISTS task_comments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        task_id INTEGER REFERENCES tasks(id),
        user_id INTEGER REFERENCES users(id),
        comment TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Task history table
    await db.runAsync(`
      CREATE TABLE IF NOT EXISTS task_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        task_id INTEGER REFERENCES tasks(id),
        changed_by INTEGER REFERENCES users(id),
        field_changed TEXT,
        old_value TEXT,
        new_value TEXT,
        changed_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log('All tables created successfully');

    // Create default admin user
    const adminPassword = 'SpectrumAdmin2024!';
    const passwordHash = await bcrypt.hash(adminPassword, 10);
    
    try {
      await db.runAsync(`
        INSERT INTO users (username, password_hash, email, full_name, role, hourly_rate)
        VALUES (?, ?, ?, ?, ?, ?)
      `, ['admin', passwordHash, process.env.ADMIN_EMAIL || 'neel@spectrumoutfitters.com', 'System Administrator', 'admin', 0]);
      console.log('Default admin user created (username: admin, password: SpectrumAdmin2024!)');
    } catch (err) {
      if (err.message.includes('UNIQUE constraint')) {
        console.log('Admin user already exists');
      } else {
        throw err;
      }
    }

    console.log('Database initialization complete!');
    process.exit(0);
  } catch (error) {
    console.error('Error initializing database:', error);
    process.exit(1);
  }
};

createTables();

