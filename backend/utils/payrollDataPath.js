import path from 'path';
import fs from 'fs';
import os from 'os';

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
  const appData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
  const payrollPath = path.join(appData, 'SpectrumOutfitters-Payroll-System', 'PayrollData');
  if (!fs.existsSync(payrollPath)) {
    fs.mkdirSync(payrollPath, { recursive: true });
  }
  return payrollPath;
}
