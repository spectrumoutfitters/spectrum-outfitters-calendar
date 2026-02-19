import db from './db.js';

const addAdminWorklistTables = async () => {
  try {
    // Create admin_worklist_templates table for recurring items
    await db.runAsync(`
      CREATE TABLE IF NOT EXISTS admin_worklist_templates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT,
        recurrence TEXT CHECK(recurrence IN ('daily', 'weekly', 'monthly')) DEFAULT 'daily',
        day_of_week INTEGER,
        day_of_month INTEGER,
        link_target TEXT,
        sort_order INTEGER DEFAULT 0,
        enabled INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        created_by INTEGER REFERENCES users(id)
      )
    `);
    console.log('✅ Created admin_worklist_templates table');

    // Create admin_worklist_items table for daily items
    await db.runAsync(`
      CREATE TABLE IF NOT EXISTS admin_worklist_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        item_date DATE NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        item_type TEXT CHECK(item_type IN ('template', 'smart', 'manual')) DEFAULT 'template',
        template_id INTEGER REFERENCES admin_worklist_templates(id),
        smart_key TEXT,
        smart_count INTEGER DEFAULT 0,
        link_target TEXT,
        sort_order INTEGER DEFAULT 0,
        is_completed INTEGER DEFAULT 0,
        completed_by INTEGER REFERENCES users(id),
        completed_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(item_date, template_id),
        UNIQUE(item_date, smart_key)
      )
    `);
    console.log('✅ Created admin_worklist_items table');

    // Seed starter templates
    const starterTemplates = [
      {
        title: 'Review time clock entries',
        description: 'Check and approve employee time entries from yesterday',
        recurrence: 'daily',
        link_target: '/admin?tab=time',
        sort_order: 1
      },
      {
        title: 'Check pending time off requests',
        description: 'Review and approve/deny any pending time off requests',
        recurrence: 'daily',
        link_target: '/admin?tab=time',
        sort_order: 2
      },
      {
        title: 'Review tasks awaiting approval',
        description: 'Check tasks submitted for review and approve/send back',
        recurrence: 'daily',
        link_target: '/tasks?status=review',
        sort_order: 3
      },
      {
        title: 'Check employee schedule for the week',
        description: 'Ensure all employees are scheduled appropriately',
        recurrence: 'weekly',
        day_of_week: 1, // Monday
        link_target: '/admin?tab=schedule',
        sort_order: 4
      },
      {
        title: 'Review payroll for the week',
        description: 'Check hours and prepare payroll submission',
        recurrence: 'weekly',
        day_of_week: 5, // Friday
        link_target: '/admin?tab=payroll',
        sort_order: 5
      },
      {
        title: 'Monthly inventory check',
        description: 'Review product inventory levels and reorder if needed',
        recurrence: 'monthly',
        day_of_month: 1,
        link_target: '/admin?tab=products',
        sort_order: 6
      },
      {
        title: 'Review monthly analytics',
        description: 'Check business performance metrics and trends',
        recurrence: 'monthly',
        day_of_month: 1,
        link_target: '/admin?tab=analytics',
        sort_order: 7
      }
    ];

    for (const template of starterTemplates) {
      // Check if template already exists
      const existing = await db.getAsync(
        'SELECT id FROM admin_worklist_templates WHERE title = ?',
        [template.title]
      );
      
      if (!existing) {
        await db.runAsync(`
          INSERT INTO admin_worklist_templates (title, description, recurrence, day_of_week, day_of_month, link_target, sort_order, enabled)
          VALUES (?, ?, ?, ?, ?, ?, ?, 1)
        `, [
          template.title,
          template.description,
          template.recurrence,
          template.day_of_week || null,
          template.day_of_month || null,
          template.link_target,
          template.sort_order
        ]);
        console.log(`  ✅ Added template: ${template.title}`);
      } else {
        console.log(`  ⏭️ Template already exists: ${template.title}`);
      }
    }

    console.log('✅ Admin worklist tables and starter templates added successfully');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error adding admin worklist tables:', error);
    process.exit(1);
  }
};

addAdminWorklistTables();
