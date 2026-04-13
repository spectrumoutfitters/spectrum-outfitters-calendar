/**
 * Payroll System pay history: persisted in SQLite so production servers work
 * without PAYROLL_DATA_PATH / local payroll-history.json (file lives on Windows with the Payroll app).
 * Merges with on-disk JSON when present (dev / same host).
 */
import path from 'path';
import fs from 'fs';
import db from '../database/db.js';
import { readPayrollHistoryFromAnyPath, resolvePayrollHistoryJsonPathForWrite } from './payrollDataPath.js';

/** Stable row id for INSERT OR REPLACE (matches import dedupe semantics). */
export function stablePayrollRecordId(rec) {
  if (rec && rec.id != null && String(rec.id).trim() !== '') return String(rec.id);
  const e = rec.employee || {};
  const empId = e.id || rec.employeeId || rec.employee_id || '';
  const proc = rec.processedDate || rec.payDate || rec.date || '';
  const week = rec.weekStart || rec.weekEnd || '';
  return `synth:${empId}:${proc}:${week}`;
}

export async function countPayrollHistoryInDb() {
  try {
    const row = await db.getAsync('SELECT COUNT(*) AS c FROM payroll_system_pay_history');
    return row?.c ?? 0;
  } catch {
    return 0;
  }
}

export async function loadAllPayrollHistoryFromDb() {
  try {
    const rows = await db.allAsync('SELECT payload_json FROM payroll_system_pay_history');
    return rows
      .map((r) => {
        try {
          return JSON.parse(r.payload_json);
        } catch {
          return null;
        }
      })
      .filter(Boolean);
  } catch {
    return [];
  }
}

/**
 * Replace all DB rows with the given records (full mirror of merged file state after import).
 */
export async function replaceAllPayrollHistoryInDb(records) {
  await db.runAsync('BEGIN TRANSACTION');
  try {
    await db.runAsync('DELETE FROM payroll_system_pay_history');
    const stmt = 'INSERT INTO payroll_system_pay_history (id, payload_json, updated_at) VALUES (?, ?, datetime(\'now\'))';
    for (const rec of records) {
      const id = stablePayrollRecordId(rec);
      await db.runAsync(stmt, [id, JSON.stringify(rec)]);
    }
    await db.runAsync('COMMIT');
  } catch (e) {
    await db.runAsync('ROLLBACK').catch(() => {});
    throw e;
  }
}

/**
 * Merge file-backed history with DB. Database wins on duplicate ids (server imports are authoritative).
 */
export async function loadMergedPayrollHistory() {
  const { records: fileRecords, pathUsed } = readPayrollHistoryFromAnyPath();
  const dbRecords = await loadAllPayrollHistoryFromDb();
  const byId = new Map();
  for (const rec of fileRecords) {
    byId.set(stablePayrollRecordId(rec), rec);
  }
  for (const rec of dbRecords) {
    byId.set(stablePayrollRecordId(rec), rec);
  }
  return {
    records: [...byId.values()],
    pathUsed,
    dbCount: dbRecords.length,
    fileCount: fileRecords.length,
  };
}

/**
 * Merge incoming records into existing file state, write JSON file, mirror full merged list to DB.
 * @returns {{ imported: number, total: number }}
 */
export async function mergeImportPayrollHistory(records) {
  if (!Array.isArray(records) || records.length === 0) {
    return { imported: 0, total: 0 };
  }

  const historyPath = resolvePayrollHistoryJsonPathForWrite();
  const { records: fileRecords } = readPayrollHistoryFromAnyPath();
  const dbRecords = await loadAllPayrollHistoryFromDb();
  const seed = new Map();
  for (const rec of fileRecords) seed.set(stablePayrollRecordId(rec), rec);
  for (const rec of dbRecords) seed.set(stablePayrollRecordId(rec), rec);
  let existing = [...seed.values()];

  const existingIds = new Set(existing.map((r) => r.id).filter(Boolean));
  const key = (r) => `${r.processedDate || ''}-${(r.employee && r.employee.id) || r.employeeId || ''}`;
  const existingKeys = new Set(existing.map(key));
  let imported = 0;
  for (const rec of records) {
    const id = rec.id;
    const k = key(rec);
    if (id && existingIds.has(id)) continue;
    if (existingKeys.has(k)) continue;
    existingIds.add(id);
    existingKeys.add(k);
    existing.push(rec);
    imported++;
  }
  existing.sort((a, b) => new Date(a.processedDate || 0) - new Date(b.processedDate || 0));

  await replaceAllPayrollHistoryInDb(existing);

  const dir = path.dirname(historyPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(historyPath, JSON.stringify(existing, null, 2), 'utf8');

  return { imported, total: existing.length };
}

/** One-time: copy file-backed history into DB when DB is empty (local dev / legacy installs). */
export async function runPayrollHistoryBackfillFromFile() {
  const n = await countPayrollHistoryInDb();
  if (n > 0) return { skipped: true, count: 0 };
  const { records } = readPayrollHistoryFromAnyPath();
  if (records.length === 0) return { skipped: true, count: 0 };
  await replaceAllPayrollHistoryInDb(records);
  return { skipped: false, count: records.length };
}
