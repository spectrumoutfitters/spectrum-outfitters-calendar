import db from './db.js';

export async function addPlaidTables() {
  try {
    await db.runAsync(`
      CREATE TABLE IF NOT EXISTS plaid_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL REFERENCES users(id),
        item_id TEXT NOT NULL UNIQUE,
        institution_name TEXT,
        access_token_encrypted TEXT NOT NULL,
        next_cursor TEXT DEFAULT '',
        last_sync_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await db.runAsync(`
      CREATE TABLE IF NOT EXISTS bank_transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        plaid_item_id INTEGER NOT NULL REFERENCES plaid_items(id) ON DELETE CASCADE,
        plaid_transaction_id TEXT NOT NULL,
        date TEXT NOT NULL,
        amount DECIMAL(10,2) NOT NULL,
        name TEXT,
        merchant_name TEXT,
        category TEXT,
        pending INTEGER DEFAULT 0,
        iso_currency_code TEXT DEFAULT 'USD',
        is_business_expense INTEGER DEFAULT 0,
        expense_category TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(plaid_item_id, plaid_transaction_id)
      )
    `);

    await db.runAsync(
      'CREATE INDEX IF NOT EXISTS idx_bank_transactions_date ON bank_transactions(date)'
    ).catch(() => {});

    await db.runAsync(
      'CREATE INDEX IF NOT EXISTS idx_bank_transactions_item ON bank_transactions(plaid_item_id)'
    ).catch(() => {});

    console.log('✅ Plaid tables created (plaid_items, bank_transactions)');
  } catch (error) {
    console.error('Error creating Plaid tables:', error);
  }
}
