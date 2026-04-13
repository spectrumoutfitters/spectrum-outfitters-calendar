import path from 'path';
import fs from 'fs';
import os from 'os';

const HISTORY_FILE = 'payroll-history.json';

function windowsDefaultPayrollDir() {
  const appData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
  return path.join(appData, 'SpectrumOutfitters-Payroll-System', 'PayrollData');
}

/**
 * Directories to try for Payroll System data (when PAYROLL_DATA_PATH is unset).
 * Linux servers often run from /var/www/.../backend — data may live in ../PayrollData.
 */
export function getPayrollDataDirectoryCandidates() {
  const cwd = process.cwd();
  const list = [];
  if (process.env.PAYROLL_DATA_PATH) {
    list.push(path.resolve(process.env.PAYROLL_DATA_PATH));
  }
  list.push(path.resolve(cwd, '..', 'PayrollData'));
  list.push(path.resolve(cwd, 'PayrollData'));
  list.push(path.resolve(cwd, '..', 'SpectrumOutfitters-Payroll-System', 'PayrollData'));
  list.push(windowsDefaultPayrollDir());
  return [...new Set(list)];
}

/**
 * First candidate directory that already contains payroll data files (read-only probe).
 */
export function findExistingPayrollDataDirectory() {
  for (const dir of getPayrollDataDirectoryCandidates()) {
    const hist = path.join(dir, HISTORY_FILE);
    const emp = path.join(dir, 'employees.json');
    if (fs.existsSync(hist) || fs.existsSync(emp)) return dir;
  }
  return null;
}

/**
 * Payroll data directory (Payroll System files: employees.json, payroll-history.json).
 * Used by payroll routes and by finance for split-salary history.
 */
export function getPayrollDataPath() {
  if (process.env.PAYROLL_DATA_PATH) {
    const payrollPath = path.resolve(process.env.PAYROLL_DATA_PATH);
    if (!fs.existsSync(payrollPath)) {
      fs.mkdirSync(payrollPath, { recursive: true });
    }
    return payrollPath;
  }
  const found = findExistingPayrollDataDirectory();
  if (found) return found;
  const payrollPath = windowsDefaultPayrollDir();
  if (!fs.existsSync(payrollPath)) {
    fs.mkdirSync(payrollPath, { recursive: true });
  }
  return payrollPath;
}

/** Normalize Payroll System export: top-level array or wrapped `{ records: [...] }`, etc. */
export function normalizePayrollHistoryParsed(parsed) {
  if (Array.isArray(parsed)) return parsed;
  if (!parsed || typeof parsed !== 'object') return [];
  for (const key of ['records', 'history', 'data', 'payrolls', 'items']) {
    if (Array.isArray(parsed[key])) return parsed[key];
  }
  return [];
}

/**
 * Load payroll-history.json from the first candidate path that has the file.
 * @returns {{ records: object[], pathUsed: string | null }}
 */
export function readPayrollHistoryFromAnyPath() {
  const candidates = getPayrollDataDirectoryCandidates();
  for (const dir of candidates) {
    const file = path.join(dir, HISTORY_FILE);
    if (!fs.existsSync(file)) continue;
    try {
      const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
      const records = normalizePayrollHistoryParsed(raw);
      return { records, pathUsed: file };
    } catch (_) {
      continue;
    }
  }
  return { records: [], pathUsed: null };
}

/** Path to read/write payroll-history.json: first existing file among candidates, else default data dir (new file). */
export function resolvePayrollHistoryJsonPathForWrite() {
  for (const dir of getPayrollDataDirectoryCandidates()) {
    const file = path.join(dir, HISTORY_FILE);
    if (fs.existsSync(file)) return file;
  }
  return path.join(getPayrollDataPath(), HISTORY_FILE);
}
