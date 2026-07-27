import { describe, it, before, after, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  getPayrollDataDirectoryCandidates,
  findExistingPayrollDataDirectory,
  normalizePayrollHistoryParsed,
  normalizePayrollEmployeesParsed,
  readPayrollHistoryFromAnyPath,
  readPayrollEmployeesFromAnyPath,
  resolvePayrollHistoryJsonPathForWrite,
} from '../utils/payrollDataPath.js';

describe('normalizePayrollHistoryParsed', () => {
  it('returns top-level arrays unchanged', () => {
    const rows = [{ id: 1 }, { id: 2 }];
    assert.deepEqual(normalizePayrollHistoryParsed(rows), rows);
  });

  it('unwraps common Payroll System object shapes', () => {
    const rows = [{ pay_date: '2026-01-15' }];
    for (const key of ['records', 'history', 'data', 'payrolls', 'items']) {
      assert.deepEqual(normalizePayrollHistoryParsed({ [key]: rows }), rows, key);
    }
  });

  it('returns [] for null, primitives, and objects without a list', () => {
    assert.deepEqual(normalizePayrollHistoryParsed(null), []);
    assert.deepEqual(normalizePayrollHistoryParsed('x'), []);
    assert.deepEqual(normalizePayrollHistoryParsed(42), []);
    assert.deepEqual(normalizePayrollHistoryParsed({ meta: true }), []);
  });
});

describe('normalizePayrollEmployeesParsed', () => {
  it('returns top-level arrays unchanged', () => {
    const rows = [{ full_name: 'Ada' }];
    assert.deepEqual(normalizePayrollEmployeesParsed(rows), rows);
  });

  it('unwraps common employee export wrappers', () => {
    const rows = [{ full_name: 'Grace' }];
    for (const key of ['employees', 'data', 'items', 'records']) {
      assert.deepEqual(normalizePayrollEmployeesParsed({ [key]: rows }), rows, key);
    }
  });

  it('returns [] for invalid payloads', () => {
    assert.deepEqual(normalizePayrollEmployeesParsed(undefined), []);
    assert.deepEqual(normalizePayrollEmployeesParsed({ name: 'solo' }), []);
  });
});

describe('getPayrollDataDirectoryCandidates', () => {
  const original = process.env.PAYROLL_DATA_PATH;

  afterEach(() => {
    if (original === undefined) delete process.env.PAYROLL_DATA_PATH;
    else process.env.PAYROLL_DATA_PATH = original;
  });

  it('puts PAYROLL_DATA_PATH first when set and dedupes', () => {
    const custom = path.join(os.tmpdir(), 'so-payroll-custom-path');
    process.env.PAYROLL_DATA_PATH = custom;
    const list = getPayrollDataDirectoryCandidates();
    assert.equal(list[0], path.resolve(custom));
    assert.equal(new Set(list).size, list.length);
    assert.ok(list.some((d) => d.endsWith(`${path.sep}PayrollData`)));
  });

  it('still returns relative PayrollData candidates when env unset', () => {
    delete process.env.PAYROLL_DATA_PATH;
    const list = getPayrollDataDirectoryCandidates();
    assert.ok(list.length >= 3);
    assert.ok(list.every((d) => path.isAbsolute(d)));
  });
});

describe('payroll data file discovery', () => {
  let tmpRoot;
  const original = process.env.PAYROLL_DATA_PATH;

  before(() => {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'so-payroll-data-'));
  });

  after(() => {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
    if (original === undefined) delete process.env.PAYROLL_DATA_PATH;
    else process.env.PAYROLL_DATA_PATH = original;
  });

  beforeEach(() => {
    process.env.PAYROLL_DATA_PATH = tmpRoot;
  });

  afterEach(() => {
    for (const name of ['payroll-history.json', 'employees.json']) {
      const p = path.join(tmpRoot, name);
      if (fs.existsSync(p)) fs.unlinkSync(p);
    }
  });

  it('findExistingPayrollDataDirectory detects history or employees files', () => {
    assert.equal(findExistingPayrollDataDirectory(), null);
    fs.writeFileSync(path.join(tmpRoot, 'employees.json'), JSON.stringify([{ id: 1 }]));
    assert.equal(findExistingPayrollDataDirectory(), path.resolve(tmpRoot));
  });

  it('readPayrollHistoryFromAnyPath unwraps wrapped JSON and reports pathUsed', () => {
    const file = path.join(tmpRoot, 'payroll-history.json');
    fs.writeFileSync(file, JSON.stringify({ records: [{ source_id: 'a' }] }));
    const { records, pathUsed } = readPayrollHistoryFromAnyPath();
    assert.equal(pathUsed, file);
    assert.deepEqual(records, [{ source_id: 'a' }]);
  });

  it('readPayrollHistoryFromAnyPath skips corrupt JSON and continues', () => {
    fs.writeFileSync(path.join(tmpRoot, 'payroll-history.json'), '{not-json');
    const { records, pathUsed } = readPayrollHistoryFromAnyPath();
    assert.equal(pathUsed, null);
    assert.deepEqual(records, []);
  });

  it('readPayrollEmployeesFromAnyPath unwraps employees wrapper', () => {
    const file = path.join(tmpRoot, 'employees.json');
    fs.writeFileSync(file, JSON.stringify({ employees: [{ full_name: 'Neel' }] }));
    const { records, pathUsed } = readPayrollEmployeesFromAnyPath();
    assert.equal(pathUsed, file);
    assert.deepEqual(records, [{ full_name: 'Neel' }]);
  });

  it('resolvePayrollHistoryJsonPathForWrite prefers an existing history file', () => {
    const file = path.join(tmpRoot, 'payroll-history.json');
    fs.writeFileSync(file, '[]');
    assert.equal(resolvePayrollHistoryJsonPathForWrite(), file);
  });
});
