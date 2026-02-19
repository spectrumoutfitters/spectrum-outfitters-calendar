import sqlite3 from 'sqlite3';
import { promisify } from 'util';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { existsSync, mkdirSync } from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Resolve database path - handle both absolute and relative paths
let dbPath = process.env.DATABASE_PATH;
if (!dbPath) {
  dbPath = path.join(__dirname, 'shop_tasks.db');
} else if (!path.isAbsolute(dbPath)) {
  // If relative path, resolve from backend directory (parent of database directory)
  // This handles DATABASE_PATH=./database/shop_tasks.db correctly
  const backendDir = path.resolve(__dirname, '..');
  dbPath = path.resolve(backendDir, dbPath);
  // Normalize the path to handle any double slashes or weird paths
  dbPath = path.normalize(dbPath);
}

// Ensure database directory exists
const dbDir = path.dirname(dbPath);
if (!existsSync(dbDir)) {
  mkdirSync(dbDir, { recursive: true });
}

// Open database connection
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
    console.error('Database path:', dbPath);
    process.exit(1);
  } else {
    console.log('Connected to SQLite database at:', dbPath);
  }
});

// Enable foreign keys
db.run('PRAGMA foreign_keys = ON');

// Promisify database methods with proper handling
db.runAsync = function(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) {
        reject(err);
      } else {
        resolve({ lastID: this.lastID, changes: this.changes });
      }
    });
  });
};

db.getAsync = promisify(db.get.bind(db));
db.allAsync = promisify(db.all.bind(db));

export default db;

