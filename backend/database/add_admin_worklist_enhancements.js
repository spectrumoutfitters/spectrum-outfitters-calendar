import db from './db.js';

const addAdminWorklistEnhancements = async () => {
  try {
    console.log('🚀 Adding admin worklist enhancements...\n');

    // Check if columns already exist to make migration idempotent
    const tableInfo = await db.allAsync(`PRAGMA table_info(admin_worklist_items)`);
    const existingColumns = tableInfo.map(col => col.name);

    // Add priority column
    if (!existingColumns.includes('priority')) {
      await db.runAsync(`
        ALTER TABLE admin_worklist_items
        ADD COLUMN priority TEXT CHECK(priority IN ('low', 'medium', 'high', 'urgent')) DEFAULT 'medium'
      `);
      console.log('✅ Added priority column');
    } else {
      console.log('⏭️  priority column already exists');
    }

    // Add category column
    if (!existingColumns.includes('category')) {
      await db.runAsync(`
        ALTER TABLE admin_worklist_items
        ADD COLUMN category TEXT DEFAULT 'general'
      `);
      console.log('✅ Added category column');
    } else {
      console.log('⏭️  category column already exists');
    }

    // Add due_time column
    if (!existingColumns.includes('due_time')) {
      await db.runAsync(`
        ALTER TABLE admin_worklist_items
        ADD COLUMN due_time TIME
      `);
      console.log('✅ Added due_time column');
    } else {
      console.log('⏭️  due_time column already exists');
    }

    // Add notes column
    if (!existingColumns.includes('notes')) {
      await db.runAsync(`
        ALTER TABLE admin_worklist_items
        ADD COLUMN notes TEXT
      `);
      console.log('✅ Added notes column');
    } else {
      console.log('⏭️  notes column already exists');
    }

    // Add metadata column (JSON string)
    if (!existingColumns.includes('metadata')) {
      await db.runAsync(`
        ALTER TABLE admin_worklist_items
        ADD COLUMN metadata TEXT
      `);
      console.log('✅ Added metadata column');
    } else {
      console.log('⏭️  metadata column already exists');
    }

    // Add estimated_minutes column
    if (!existingColumns.includes('estimated_minutes')) {
      await db.runAsync(`
        ALTER TABLE admin_worklist_items
        ADD COLUMN estimated_minutes INTEGER
      `);
      console.log('✅ Added estimated_minutes column');
    } else {
      console.log('⏭️  estimated_minutes column already exists');
    }

    // Add actual_minutes column
    if (!existingColumns.includes('actual_minutes')) {
      await db.runAsync(`
        ALTER TABLE admin_worklist_items
        ADD COLUMN actual_minutes INTEGER
      `);
      console.log('✅ Added actual_minutes column');
    } else {
      console.log('⏭️  actual_minutes column already exists');
    }

    // Add assigned_to column
    if (!existingColumns.includes('assigned_to')) {
      await db.runAsync(`
        ALTER TABLE admin_worklist_items
        ADD COLUMN assigned_to INTEGER REFERENCES users(id)
      `);
      console.log('✅ Added assigned_to column');
    } else {
      console.log('⏭️  assigned_to column already exists');
    }

    // Create admin_worklist_history table
    const historyTableExists = await db.getAsync(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name='admin_worklist_history'
    `);

    if (!historyTableExists) {
      await db.runAsync(`
        CREATE TABLE IF NOT EXISTS admin_worklist_history (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          item_id INTEGER NOT NULL REFERENCES admin_worklist_items(id) ON DELETE CASCADE,
          completed_at DATETIME NOT NULL,
          completed_by INTEGER REFERENCES users(id),
          time_taken_minutes INTEGER,
          notes TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);
      console.log('✅ Created admin_worklist_history table');

      // Create indexes for better performance
      await db.runAsync(`
        CREATE INDEX IF NOT EXISTS idx_worklist_history_item
        ON admin_worklist_history(item_id, completed_at DESC)
      `);
      await db.runAsync(`
        CREATE INDEX IF NOT EXISTS idx_worklist_history_user
        ON admin_worklist_history(completed_by, completed_at DESC)
      `);
      console.log('✅ Created indexes for admin_worklist_history');
    } else {
      console.log('⏭️  admin_worklist_history table already exists');
    }

    // Update existing items with default priority and category based on item_type
    await db.runAsync(`
      UPDATE admin_worklist_items
      SET priority = CASE
        WHEN item_type = 'smart' AND smart_key IN ('pending_time_off', 'unapproved_time_entries', 'tasks_in_review') THEN 'high'
        WHEN item_type = 'smart' THEN 'medium'
        ELSE 'medium'
      END,
      category = CASE
        WHEN item_type = 'smart' AND smart_key = 'pending_time_off' THEN 'time_approval'
        WHEN item_type = 'smart' AND smart_key = 'unapproved_time_entries' THEN 'time_approval'
        WHEN item_type = 'smart' AND smart_key = 'tasks_in_review' THEN 'task_review'
        WHEN item_type = 'template' THEN 'general'
        WHEN item_type = 'manual' THEN 'general'
        ELSE 'general'
      END
      WHERE priority IS NULL OR category IS NULL
    `);
    console.log('✅ Updated existing items with default priority and category');

    console.log('\n✅ Admin worklist enhancements added successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error adding admin worklist enhancements:', error);
    process.exit(1);
  }
};

addAdminWorklistEnhancements();
