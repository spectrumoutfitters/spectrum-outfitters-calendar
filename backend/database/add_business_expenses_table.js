import db from './db.js';

const addBusinessExpensesTable = async () => {
  try {
    // Create business_expenses table
    await db.runAsync(`
      CREATE TABLE IF NOT EXISTS business_expenses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        expense_name TEXT NOT NULL,
        category TEXT NOT NULL CHECK(category IN ('rent', 'utilities', 'insurance', 'supplies', 'other')),
        amount DECIMAL(10,2) NOT NULL,
        frequency TEXT CHECK(frequency IN ('one_time', 'weekly', 'monthly')) DEFAULT 'one_time',
        expense_date DATE, -- For one-time expenses
        week_ending_date DATE, -- For weekly expenses (which week it applies to)
        month_year TEXT, -- For monthly expenses (e.g., '2024-01')
        is_recurring INTEGER DEFAULT 0,
        notes TEXT,
        created_by INTEGER REFERENCES users(id),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Created business_expenses table');

    // Create indexes for better performance
    await db.runAsync(`
      CREATE INDEX IF NOT EXISTS idx_expenses_date 
      ON business_expenses(expense_date)
    `);
    await db.runAsync(`
      CREATE INDEX IF NOT EXISTS idx_expenses_week 
      ON business_expenses(week_ending_date)
    `);
    await db.runAsync(`
      CREATE INDEX IF NOT EXISTS idx_expenses_month 
      ON business_expenses(month_year)
    `);
    await db.runAsync(`
      CREATE INDEX IF NOT EXISTS idx_expenses_recurring 
      ON business_expenses(is_recurring, frequency)
    `);
    console.log('✅ Created indexes');

    console.log('\n✅ Business expenses table created successfully!');
  } catch (error) {
    console.error('❌ Error creating business_expenses table:', error);
    throw error;
  }
};

addBusinessExpensesTable()
  .then(() => {
    console.log('Migration completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
  });
