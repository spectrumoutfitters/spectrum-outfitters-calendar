import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import express from 'express';
import jwt from 'jsonwebtoken';

const fixtureDir = mkdtempSync(join(tmpdir(), 'finance-reimbursements-history-ownership-'));
process.env.DATABASE_PATH = join(fixtureDir, 'test.sqlite');
process.env.PAYROLL_DATA_PATH = fixtureDir;
process.env.JWT_SECRET = 'finance-reimbursements-history-ownership-secret';

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
  await db.runAsync('DELETE FROM payroll_system_pay_history');
  await db.runAsync('DELETE FROM payroll_people');
  await db.runAsync('DELETE FROM users WHERE id <> 1');
}

async function insertHistory(id, payload) {
  await db.runAsync(
    'INSERT INTO payroll_system_pay_history (id, payload_json) VALUES (?, ?)',
    [id, JSON.stringify(payload)]
  );
}

function summarizeSources(result) {
  return result.sources
    .map((source) => ({
      sourceType: source.source_type,
      sourceId: source.source_id,
      payDates: (source.pay_records || []).map((row) => row.pay_date).sort(),
      payCount: (source.pay_records || []).length,
      amountOwed: source.amount_owed_estimate,
    }))
    .sort((a, b) => `${a.sourceType}:${a.sourceId}`.localeCompare(`${b.sourceType}:${b.sourceId}`));
}

after(async () => {
  await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  await new Promise((resolve, reject) => db.close((error) => (error ? reject(error) : resolve())));
  rmSync(fixtureDir, { recursive: true, force: true });
});

test('ambiguous same-name payroll people do not each receive name-only payroll history', async () => {
  await clearScenario();
  await db.runAsync(
    `INSERT INTO payroll_people
     (id, full_name, is_active, split_reimbursable_amount, split_reimbursable_period)
     VALUES
       (101, 'Taylor Lee', 1, 400, 'weekly'),
       (102, '  taylor   lee  ', 1, 400, 'weekly')`
  );
  await insertHistory('hist-taylor-1', {
    id: 'hist-taylor-1',
    payDate: '2026-07-10',
    grossPay: 2000,
    employee: { name: 'Taylor Lee' },
  });

  const result = await getReimbursements();
  assert.deepEqual(summarizeSources(result), [
    {
      sourceType: 'payroll_person',
      sourceId: 101,
      payDates: [],
      payCount: 0,
      amountOwed: 0,
    },
    {
      sourceType: 'payroll_person',
      sourceId: 102,
      payDates: [],
      payCount: 0,
      amountOwed: 0,
    },
  ]);
});

test('unique payroll person still receives name-matched payroll history', async () => {
  await clearScenario();
  await db.runAsync(
    `INSERT INTO payroll_people
     (id, full_name, is_active, split_reimbursable_amount, split_reimbursable_period)
     VALUES (201, 'Morgan Lane', 1, 250, 'weekly')`
  );
  await insertHistory('hist-morgan-1', {
    id: 'hist-morgan-1',
    payDate: '2026-07-10',
    grossPay: 1800,
    employee: { name: 'Morgan Lane' },
  });

  const result = await getReimbursements();
  assert.deepEqual(summarizeSources(result), [
    {
      sourceType: 'payroll_person',
      sourceId: 201,
      payDates: ['2026-07-10'],
      payCount: 1,
      amountOwed: 250,
    },
  ]);
});

test('user with linked employee id still matches history when another same-name user exists', async () => {
  await clearScenario();
  await db.runAsync(
    `INSERT INTO users
     (id, username, full_name, email, role, is_active, split_reimbursable_amount, split_reimbursable_period)
     VALUES
       (301, 'casey-a', 'Casey Reed', 'casey.a@example.com', 'employee', 1, 300, 'weekly'),
       (302, 'casey-b', '  casey   reed ', 'casey.b@example.com', 'employee', 1, 300, 'weekly')`
  );
  await insertHistory('hist-casey-1', {
    id: 'hist-casey-1',
    payDate: '2026-07-17',
    grossPay: 1900,
    employee: { id: 301, name: 'Casey Reed' },
  });

  const result = await getReimbursements();
  assert.deepEqual(summarizeSources(result), [
    {
      sourceType: 'user',
      sourceId: 301,
      payDates: ['2026-07-17'],
      payCount: 1,
      amountOwed: 300,
    },
    {
      sourceType: 'user',
      sourceId: 302,
      payDates: [],
      payCount: 0,
      amountOwed: 0,
    },
  ]);
});

test('unambiguous user + payroll_person pair can still name-match shared history', async () => {
  await clearScenario();
  await db.runAsync(
    `INSERT INTO users
     (id, username, full_name, role, is_active, split_reimbursable_amount, split_reimbursable_period)
     VALUES (401, 'jamie-user', 'Jamie Fox', 'employee', 1, 100, 'weekly')`
  );
  await db.runAsync(
    `INSERT INTO payroll_people
     (id, full_name, is_active, split_reimbursable_amount, split_reimbursable_period)
     VALUES (402, ' jamie  fox ', 1, 100, 'weekly')`
  );
  await insertHistory('hist-jamie-1', {
    id: 'hist-jamie-1',
    payDate: '2026-07-24',
    grossPay: 1500,
    employee: { name: 'Jamie Fox' },
  });

  const result = await getReimbursements();
  // Pair merges into the user card; history should appear once on the merged source.
  assert.deepEqual(summarizeSources(result), [
    {
      sourceType: 'user',
      sourceId: 401,
      payDates: ['2026-07-24'],
      payCount: 1,
      amountOwed: 100,
    },
  ]);
});
