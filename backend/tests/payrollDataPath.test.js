import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';

import {
  findExistingPayrollDataDirectory,
  getPayrollDataDirectoryCandidates,
  getPayrollDataPath,
  readPayrollEmployeesFromAnyPath,
  readPayrollHistoryFromAnyPath,
  resolvePayrollHistoryJsonPathForWrite,
} from '../utils/payrollDataPath.js';

const HISTORY = 'payroll-history.json';
const EMPLOYEES = 'employees.json';

/**
 * Payroll routes read one directory from getPayrollDataPath. Finance and
 * payroll-history sync scan every candidate. APPDATA is pinned so the
 * Windows default cannot land in the real home directory.
 */
function withFixture(run) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'payroll-data-path-'));
  const backendDir = path.join(root, 'backend');
  const appData = path.join(root, 'appdata');
  fs.mkdirSync(backendDir);
  fs.mkdirSync(appData);
  const prevCwd = process.cwd();
  const prevPayroll = process.env.PAYROLL_DATA_PATH;
  const prevAppData = process.env.APPDATA;
  process.chdir(backendDir);
  delete process.env.PAYROLL_DATA_PATH;
  process.env.APPDATA = appData;
  const paths = {
    root,
    backendDir,
    parentPayroll: path.join(root, 'PayrollData'),
    cwdPayroll: path.join(backendDir, 'PayrollData'),
    siblingSystem: path.join(root, 'SpectrumOutfitters-Payroll-System', 'PayrollData'),
    appDataPayroll: path.join(appData, 'SpectrumOutfitters-Payroll-System', 'PayrollData'),
  };
  try {
    run(paths);
  } finally {
    process.chdir(prevCwd);
    if (prevPayroll === undefined) delete process.env.PAYROLL_DATA_PATH;
    else process.env.PAYROLL_DATA_PATH = prevPayroll;
    if (prevAppData === undefined) delete process.env.APPDATA;
    else process.env.APPDATA = prevAppData;
    fs.rmSync(root, { recursive: true, force: true });
  }
}

function writeJson(dir, name, value) {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, name), JSON.stringify(value));
}

describe('payroll data directory selection', { concurrency: false }, () => {
  it('orders candidates from the env override through the shop folders to APPDATA', () => {
    withFixture((paths) => {
      assert.deepEqual(getPayrollDataDirectoryCandidates(), [
        paths.parentPayroll,
        paths.cwdPayroll,
        paths.siblingSystem,
        paths.appDataPayroll,
      ]);

      process.env.PAYROLL_DATA_PATH = paths.parentPayroll;
      assert.deepEqual(getPayrollDataDirectoryCandidates(), [
        paths.parentPayroll,
        paths.cwdPayroll,
        paths.siblingSystem,
        paths.appDataPayroll,
      ]);

      process.env.PAYROLL_DATA_PATH = 'override';
      assert.equal(getPayrollDataDirectoryCandidates()[0], path.join(paths.backendDir, 'override'));
    });
  });

  it('treats either payroll file as proof a directory is in use, earlier candidates first', () => {
    withFixture((paths) => {
      assert.equal(findExistingPayrollDataDirectory(), null);

      writeJson(paths.siblingSystem, EMPLOYEES, [{ id: 'emp-1' }]);
      assert.equal(findExistingPayrollDataDirectory(), paths.siblingSystem);

      writeJson(paths.parentPayroll, HISTORY, []);
      writeJson(paths.cwdPayroll, EMPLOYEES, [{ id: 'emp-2' }]);
      assert.equal(findExistingPayrollDataDirectory(), paths.parentPayroll);
    });
  });

  it('keeps an explicit PAYROLL_DATA_PATH even when another folder already has history', () => {
    withFixture((paths) => {
      const override = path.join(paths.root, 'override');
      process.env.PAYROLL_DATA_PATH = override;
      writeJson(paths.parentPayroll, HISTORY, [{ id: 'pay-1' }]);

      assert.equal(getPayrollDataPath(), override);
      assert.equal(fs.existsSync(override), true);
      assert.equal(fs.existsSync(path.join(override, HISTORY)), false);
    });
  });

  it('uses the first existing directory, and creates only the APPDATA default when none exist', () => {
    withFixture((paths) => {
      writeJson(paths.cwdPayroll, EMPLOYEES, [{ id: 'emp-1' }]);
      assert.equal(getPayrollDataPath(), paths.cwdPayroll);
      assert.equal(fs.existsSync(paths.appDataPayroll), false);
    });

    withFixture((paths) => {
      assert.equal(getPayrollDataPath(), paths.appDataPayroll);
      assert.equal(fs.existsSync(paths.appDataPayroll), true);
      assert.equal(fs.existsSync(paths.parentPayroll), false);
      assert.equal(fs.existsSync(paths.cwdPayroll), false);
    });
  });

  it('skips a broken history file and unwraps records from the next candidate', () => {
    withFixture((paths) => {
      fs.mkdirSync(paths.parentPayroll, { recursive: true });
      fs.writeFileSync(path.join(paths.parentPayroll, HISTORY), '{');
      writeJson(paths.parentPayroll, EMPLOYEES, [{ id: 'emp-1', name: 'Riley' }]);
      writeJson(paths.cwdPayroll, HISTORY, { records: [{ id: 'pay-1' }] });

      const read = readPayrollHistoryFromAnyPath();
      assert.deepEqual(read.records, [{ id: 'pay-1' }]);
      assert.equal(read.pathUsed, path.join(paths.cwdPayroll, HISTORY));
    });
  });

  it('skips a broken employees file and does not read payroll history as the employee list', () => {
    withFixture((paths) => {
      fs.mkdirSync(paths.parentPayroll, { recursive: true });
      fs.writeFileSync(path.join(paths.parentPayroll, EMPLOYEES), '{');
      writeJson(paths.parentPayroll, HISTORY, [{ id: 'pay-1', employee: { id: 'emp-1' } }]);
      writeJson(paths.cwdPayroll, EMPLOYEES, { employees: [{ id: 'emp-9', name: 'Riley' }] });

      const read = readPayrollEmployeesFromAnyPath();
      assert.deepEqual(read.records, [{ id: 'emp-9', name: 'Riley' }]);
      assert.equal(read.pathUsed, path.join(paths.cwdPayroll, EMPLOYEES));
    });
  });

  it('writes history into the first real file, or the override directory when no file exists yet', () => {
    withFixture((paths) => {
      writeJson(paths.parentPayroll, EMPLOYEES, [{ id: 'emp-1' }]);
      writeJson(paths.cwdPayroll, HISTORY, [{ id: 'pay-1' }]);

      assert.equal(
        resolvePayrollHistoryJsonPathForWrite(),
        path.join(paths.cwdPayroll, HISTORY),
      );
      assert.equal(fs.existsSync(paths.appDataPayroll), false);
    });

    withFixture((paths) => {
      const override = path.join(paths.root, 'override');
      process.env.PAYROLL_DATA_PATH = override;

      assert.equal(
        resolvePayrollHistoryJsonPathForWrite(),
        path.join(override, HISTORY),
      );
      assert.equal(fs.existsSync(override), true);
    });

    withFixture((paths) => {
      assert.equal(
        resolvePayrollHistoryJsonPathForWrite(),
        path.join(paths.appDataPayroll, HISTORY),
      );
      assert.equal(fs.existsSync(paths.appDataPayroll), true);
    });
  });
});
