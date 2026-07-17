import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import express from 'express';
import jwt from 'jsonwebtoken';

const fixtureDir = mkdtempSync(join(tmpdir(), 'finance-reimbursements-name-ownership-'));
process.env.DATABASE_PATH = join(fixtureDir, 'test.sqlite');
process.env.PAYROLL_DATA_PATH = fixtureDir;
process.env.JWT_SECRET = 'finance-reimbursements-name-ownership-secret';

const [{ default: db }, { default: financeRouter }] = await Promise.all([
  import('../database/db.js'),
  import('../routes/finance.js'),
]);

for (const sql of [
  `CREATE TABLE users (
    id INTEGER PRIMARY KEY,
    username TEXT,
    full_name TEXT,
    email TEXT,
    role TEXT,
    payroll_access INTEGER DEFAULT 0,
    is_master_admin INTEGER DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    weekly_salary REAL DEFAULT 0,
    show_clock_in_header INTEGER DEFAULT 1,
    last_login TEXT,
    split_reimbursable_amount REAL DEFAULT 0,
    split_reimbursable_notes TEXT,
    split_reimbursable_period TEXT DEFAULT 'weekly'
  )`,
  `CREATE TABLE payroll_people (
    id INTEGER PRIMARY KEY,
    full_name TEXT NOT NULL,
    weekly_salary REAL DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    split_reimbursable_amount REAL DEFAULT 0,
    split_reimbursable_notes TEXT,
    split_reimbursable_period TEXT DEFAULT 'weekly'
  )`,
  `CREATE TABLE payroll_reimbursements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_type TEXT NOT NULL,
    source_id INTEGER NOT NULL,
    received_date TEXT NOT NULL,
    amount REAL NOT NULL,
    notes TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE payroll_split_pay_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_type TEXT NOT NULL,
    source_id INTEGER NOT NULL,
    week_ending_date TEXT NOT NULL,
    amount REAL NOT NULL,
    source_label TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(source_type, source_id, week_ending_date)
  )`,
  `CREATE TABLE payroll_system_pay_history (
    id TEXT PRIMARY KEY,
    payload_json TEXT NOT NULL,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE app_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT UNIQUE NOT NULL,
    value TEXT,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`,
]) {
  await db.runAsync(sql);
}

await db.runAsync(
  `INSERT INTO users
   (id, username, full_name, role, payroll_access, is_master_admin, is_active)
   VALUES (1, 'test-admin', 'Test Admin', 'admin', 1, 1, 1)`
);

const app = express();
app.use('/api/finance', financeRouter);
const server = await new Promise((resolve) => {
  const listening = app.listen(0, '127.0.0.1', () => resolve(listening));
});
const { port } = server.address();
const token = jwt.sign({ id: 1 }, process.env.JWT_SECRET);

async function getReimbursements() {
  const response = await fetch(`http://127.0.0.1:${port}/api/finance/reimbursements`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  assert.equal(response.status, 200);
  return response.json();
}

async function clearScenario() {
  await db.runAsync('DELETE FROM payroll_reimbursements');
  await db.runAsync('DELETE FROM payroll_split_pay_runs');
  await db.runAsync('DELETE FROM payroll_people');
  await db.runAsync('DELETE FROM users WHERE id <> 1');
}

function summarizeSources(result) {
  return result.sources
    .map((source) => ({
      sourceType: source.source_type,
      sourceId: source.source_id,
      recordedAmounts: source.recorded_reimbursements.map((row) => row.amount).sort((a, b) => a - b),
      totalReceived: result.total_received_by_source[`${source.source_type}:${source.source_id}`],
      amountOwed: source.amount_owed_estimate,
    }))
    .sort((a, b) => a.sourceId - b.sourceId);
}

after(async () => {
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  await new Promise((resolve, reject) => db.close((error) => error ? reject(error) : resolve()));
  rmSync(fixtureDir, { recursive: true, force: true });
});

test('reimbursement name ownership prevents ambiguous merges and preserves unique inactive history', async () => {
  await clearScenario();
  await db.runAsync(
    `INSERT INTO payroll_people
     (id, full_name, is_active, split_reimbursable_amount, split_reimbursable_period)
     VALUES
       (101, 'Taylor Lee', 1, 100, 'weekly'),
       (102, '  taylor   lee  ', 1, 100, 'weekly'),
       (199, 'TAYLOR LEE', 0, 0, 'weekly')`
  );
  await db.runAsync(
    `INSERT INTO payroll_split_pay_runs
     (source_type, source_id, week_ending_date, amount)
     VALUES
       ('payroll_person', 101, '2026-07-10', 500),
       ('payroll_person', 102, '2026-07-10', 600)`
  );
  await db.runAsync(
    `INSERT INTO payroll_reimbursements
     (source_type, source_id, received_date, amount)
     VALUES
       ('payroll_person', 101, '2026-07-11', 25),
       ('payroll_person', 102, '2026-07-12', 40),
       ('payroll_person', 199, '2026-07-13', 10)`
  );

  const ambiguousPayrollPeople = await getReimbursements();
  assert.deepEqual(summarizeSources(ambiguousPayrollPeople), [
    {
      sourceType: 'payroll_person',
      sourceId: 101,
      recordedAmounts: [25],
      totalReceived: 25,
      amountOwed: 75,
    },
    {
      sourceType: 'payroll_person',
      sourceId: 102,
      recordedAmounts: [40],
      totalReceived: 40,
      amountOwed: 60,
    },
  ]);

  await clearScenario();
  await db.runAsync(
    `INSERT INTO users
     (id, username, full_name, role, is_active, split_reimbursable_amount, split_reimbursable_period)
     VALUES (301, 'casey-user', 'Casey Reed', 'employee', 1, 100, 'weekly')`
  );
  await db.runAsync(
    `INSERT INTO payroll_people
     (id, full_name, is_active, split_reimbursable_amount, split_reimbursable_period)
     VALUES
       (302, ' casey  reed ', 1, 100, 'weekly'),
       (303, 'CASEY REED', 1, 100, 'weekly'),
       (399, 'Casey Reed', 0, 0, 'weekly')`
  );
  await db.runAsync(
    `INSERT INTO payroll_split_pay_runs
     (source_type, source_id, week_ending_date, amount)
     VALUES
       ('user', 301, '2026-07-10', 500),
       ('payroll_person', 302, '2026-07-10', 600),
       ('payroll_person', 303, '2026-07-10', 700)`
  );
  await db.runAsync(
    `INSERT INTO payroll_reimbursements
     (source_type, source_id, received_date, amount)
     VALUES
       ('user', 301, '2026-07-11', 11),
       ('payroll_person', 302, '2026-07-12', 22),
       ('payroll_person', 303, '2026-07-13', 33),
       ('payroll_person', 399, '2026-07-14', 44)`
  );

  const ambiguousUserPayrollPeople = await getReimbursements();
  assert.deepEqual(summarizeSources(ambiguousUserPayrollPeople), [
    {
      sourceType: 'user',
      sourceId: 301,
      recordedAmounts: [11],
      totalReceived: 11,
      amountOwed: 89,
    },
    {
      sourceType: 'payroll_person',
      sourceId: 302,
      recordedAmounts: [22],
      totalReceived: 22,
      amountOwed: 78,
    },
    {
      sourceType: 'payroll_person',
      sourceId: 303,
      recordedAmounts: [33],
      totalReceived: 33,
      amountOwed: 67,
    },
  ]);

  await clearScenario();
  await db.runAsync(
    `INSERT INTO payroll_people
     (id, full_name, is_active, split_reimbursable_amount, split_reimbursable_period)
     VALUES
       (201, 'Morgan Lane', 1, 100, 'weekly'),
       (299, '  MORGAN   LANE ', 0, 0, 'weekly')`
  );
  await db.runAsync(
    `INSERT INTO payroll_split_pay_runs
     (source_type, source_id, week_ending_date, amount)
     VALUES ('payroll_person', 201, '2026-07-10', 700)`
  );
  await db.runAsync(
    `INSERT INTO payroll_reimbursements
     (source_type, source_id, received_date, amount)
     VALUES
       ('payroll_person', 201, '2026-07-11', 20),
       ('payroll_person', 299, '2026-07-12', 15)`
  );

  const uniquePayrollPerson = await getReimbursements();
  assert.deepEqual(summarizeSources(uniquePayrollPerson), [
    {
      sourceType: 'payroll_person',
      sourceId: 201,
      recordedAmounts: [15, 20],
      totalReceived: 35,
      amountOwed: 65,
    },
  ]);

  await clearScenario();
  await db.runAsync(
    `INSERT INTO users
     (id, username, full_name, role, is_active, split_reimbursable_amount, split_reimbursable_period)
     VALUES (401, 'jamie-user', 'Jamie Fox', 'employee', 1, 100, 'weekly')`
  );
  await db.runAsync(
    `INSERT INTO payroll_people
     (id, full_name, is_active, split_reimbursable_amount, split_reimbursable_period)
     VALUES
       (402, ' jamie  fox ', 1, 100, 'weekly'),
       (499, 'JAMIE FOX', 0, 0, 'weekly')`
  );
  await db.runAsync(
    `INSERT INTO payroll_split_pay_runs
     (source_type, source_id, week_ending_date, amount)
     VALUES
       ('user', 401, '2026-07-10', 500),
       ('payroll_person', 402, '2026-07-10', 500)`
  );
  await db.runAsync(
    `INSERT INTO payroll_reimbursements
     (source_type, source_id, received_date, amount)
     VALUES
       ('user', 401, '2026-07-11', 10),
       ('payroll_person', 402, '2026-07-12', 20),
       ('payroll_person', 499, '2026-07-13', 15)`
  );

  const uniqueUserPayrollPersonPair = await getReimbursements();
  assert.deepEqual(summarizeSources(uniqueUserPayrollPersonPair), [
    {
      sourceType: 'user',
      sourceId: 401,
      recordedAmounts: [10, 15, 20],
      totalReceived: 45,
      amountOwed: 55,
    },
  ]);
});
