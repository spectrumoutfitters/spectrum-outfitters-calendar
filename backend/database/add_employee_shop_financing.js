import db from './db.js';

const FINANCING_COLS = `
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id),
  external_party_name TEXT,
  external_party_company TEXT,
  item_description TEXT NOT NULL,
  total_amount REAL NOT NULL,
  balance_due REAL NOT NULL,
  weekly_payment REAL NOT NULL DEFAULT 0,
  deduct_from_payroll INTEGER NOT NULL DEFAULT 0,
  deduction_reason TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'paid_off', 'paused')),
  notes TEXT,
  start_date TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_by INTEGER REFERENCES users(id)
`;

async function migrateEmployeeShopFinancingExternalPayees() {
  const info = await db.allAsync('PRAGMA table_info(employee_shop_financing)');
  if (!info || info.length === 0) return;

  const has = (n) => info.some((c) => c.name === n);
  if (!has('external_party_name')) {
    await db.runAsync('ALTER TABLE employee_shop_financing ADD COLUMN external_party_name TEXT').catch(() => {});
    await db.runAsync('ALTER TABLE employee_shop_financing ADD COLUMN external_party_company TEXT').catch(() => {});
  }

  const info2 = await db.allAsync('PRAGMA table_info(employee_shop_financing)');
  const userCol = info2.find((c) => c.name === 'user_id');
  const needsRebuild = userCol && userCol.notnull === 1;
  if (!needsRebuild) return;

  await db.runAsync('PRAGMA foreign_keys = OFF');
  try {
    await db.runAsync(`CREATE TABLE employee_shop_financing__mnew (${FINANCING_COLS})`);

    await db.runAsync(`
      INSERT INTO employee_shop_financing__mnew (
        id, user_id, external_party_name, external_party_company,
        item_description, total_amount, balance_due, weekly_payment,
        deduct_from_payroll, deduction_reason, status, notes, start_date,
        created_at, updated_at, created_by
      )
      SELECT
        id, user_id,
        COALESCE(external_party_name, NULL),
        COALESCE(external_party_company, NULL),
        item_description, total_amount, balance_due, weekly_payment,
        deduct_from_payroll, deduction_reason, status, notes, start_date,
        created_at, updated_at, created_by
      FROM employee_shop_financing
    `);

    const dedExists = await db.getAsync(
      "SELECT 1 FROM sqlite_master WHERE type='table' AND name='employee_shop_financing_deductions'"
    );
    if (dedExists) {
      await db.runAsync(`CREATE TABLE employee_shop_financing_deductions__mtmp (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        financing_id INTEGER NOT NULL,
        week_ending_date TEXT NOT NULL,
        amount REAL NOT NULL,
        reason_note TEXT NOT NULL,
        applied_by INTEGER REFERENCES users(id),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(financing_id, week_ending_date)
      )`);
      await db.runAsync(
        `INSERT INTO employee_shop_financing_deductions__mtmp
         SELECT id, financing_id, week_ending_date, amount, reason_note, applied_by, created_at
         FROM employee_shop_financing_deductions`
      );
      await db.runAsync('DROP TABLE employee_shop_financing_deductions');
    }

    await db.runAsync('DROP TABLE employee_shop_financing');
    await db.runAsync('ALTER TABLE employee_shop_financing__mnew RENAME TO employee_shop_financing');

    await db.runAsync(`CREATE TABLE employee_shop_financing_deductions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      financing_id INTEGER NOT NULL REFERENCES employee_shop_financing(id) ON DELETE CASCADE,
      week_ending_date TEXT NOT NULL,
      amount REAL NOT NULL,
      reason_note TEXT NOT NULL,
      applied_by INTEGER REFERENCES users(id),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(financing_id, week_ending_date)
    )`);

    if (dedExists) {
      await db.runAsync(
        `INSERT INTO employee_shop_financing_deductions
         SELECT id, financing_id, week_ending_date, amount, reason_note, applied_by, created_at
         FROM employee_shop_financing_deductions__mtmp`
      );
      await db.runAsync('DROP TABLE employee_shop_financing_deductions__mtmp');
    }
  } finally {
    await db.runAsync('PRAGMA foreign_keys = ON');
  }
}

/**
 * Employee shop financing (weekly pay plans) + payroll deduction ledger.
 * Supports Spectrum users OR external payers (other businesses) via external_party_name.
 */
export async function addEmployeeShopFinancingTables() {
  const exists = await db.getAsync(
    "SELECT 1 FROM sqlite_master WHERE type='table' AND name='employee_shop_financing'"
  );

  if (!exists) {
    await db.runAsync(`CREATE TABLE employee_shop_financing (${FINANCING_COLS})`).catch(() => {});
  } else {
    await migrateEmployeeShopFinancingExternalPayees();
  }

  await db.runAsync(`
    CREATE TABLE IF NOT EXISTS employee_shop_financing_deductions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      financing_id INTEGER NOT NULL REFERENCES employee_shop_financing(id) ON DELETE CASCADE,
      week_ending_date TEXT NOT NULL,
      amount REAL NOT NULL,
      reason_note TEXT NOT NULL,
      applied_by INTEGER REFERENCES users(id),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(financing_id, week_ending_date)
    )
  `).catch(() => {});

  await db.runAsync(
    'CREATE INDEX IF NOT EXISTS idx_employee_shop_financing_user ON employee_shop_financing(user_id)'
  ).catch(() => {});
  await db.runAsync(
    'CREATE INDEX IF NOT EXISTS idx_employee_shop_financing_status ON employee_shop_financing(status)'
  ).catch(() => {});
  await db.runAsync(
    'CREATE INDEX IF NOT EXISTS idx_shop_financing_deductions_week ON employee_shop_financing_deductions(week_ending_date)'
  ).catch(() => {});
}
