import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'payroll-history-records-'));
const payrollDataPath = path.join(tempRoot, 'PayrollData');
fs.mkdirSync(payrollDataPath);

process.env.DATABASE_PATH = path.join(tempRoot, 'history.sqlite');
process.env.PAYROLL_DATA_PATH = payrollDataPath;

const { default: db } = await import('../database/db.js');
const {
  loadAllPayrollHistoryFromDb,
  mergeImportPayrollHistory,
  mergeUniquePayrollHistoryRecords,
} = await import('../utils/payrollHistoryRecords.js');

await db.runAsync(`
  CREATE TABLE payroll_system_pay_history (
    id TEXT PRIMARY KEY NOT NULL,
    payload_json TEXT NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

after(async () => {
  await new Promise((resolve, reject) => {
    db.close((error) => (error ? reject(error) : resolve()));
  });
  fs.rmSync(tempRoot, { recursive: true, force: true });
});

test('persists distinct same-day payroll records identified by source ID', async () => {
  const records = [
    {
      id: 'regular-pay-42',
      employee: { id: 'employee-42' },
      processedDate: '2026-07-10',
      grossPay: 1000,
    },
    {
      id: 'bonus-pay-42',
      employee: { id: 'employee-42' },
      processedDate: '2026-07-10',
      grossPay: 250,
    },
  ];

  const firstImport = await mergeImportPayrollHistory(records);
  assert.deepEqual(firstImport, { imported: 2, total: 2 });

  const dbRecords = await loadAllPayrollHistoryFromDb();
  assert.deepEqual(
    dbRecords.map((record) => record.id).sort(),
    ['bonus-pay-42', 'regular-pay-42'],
  );

  const fileRecords = JSON.parse(
    fs.readFileSync(path.join(payrollDataPath, 'payroll-history.json'), 'utf8'),
  );
  assert.deepEqual(
    fileRecords.map((record) => record.id).sort(),
    ['bonus-pay-42', 'regular-pay-42'],
  );

  const repeatedImport = await mergeImportPayrollHistory(records);
  assert.deepEqual(repeatedImport, { imported: 0, total: 2 });
});

test('continues deduping legacy ID-less records by employee and processed date', () => {
  const first = {
    employee: { id: 'employee-42' },
    processedDate: '2026-07-10',
    grossPay: 1000,
  };
  const duplicate = { ...first, grossPay: 250 };

  const result = mergeUniquePayrollHistoryRecords([], [first, duplicate]);

  assert.equal(result.imported, 1);
  assert.deepEqual(result.records, [first]);
});
