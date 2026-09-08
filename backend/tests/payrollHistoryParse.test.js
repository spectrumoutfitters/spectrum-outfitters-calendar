import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizePayrollEmployeesParsed,
  normalizePayrollHistoryParsed,
} from '../utils/payrollDataPath.js';

describe('normalizePayrollHistoryParsed', () => {
  it('accepts a top-level array and common wrapped keys', () => {
    const rows = [{ id: 1 }];
    assert.deepEqual(normalizePayrollHistoryParsed(rows), rows);
    assert.deepEqual(normalizePayrollHistoryParsed({ records: rows }), rows);
    assert.deepEqual(normalizePayrollHistoryParsed({ history: rows }), rows);
    assert.deepEqual(normalizePayrollHistoryParsed({ data: rows }), rows);
    assert.deepEqual(normalizePayrollHistoryParsed({ payrolls: rows }), rows);
    assert.deepEqual(normalizePayrollHistoryParsed({ items: rows }), rows);
  });

  it('returns [] for null, primitives, empty objects, and non-array wrappers', () => {
    assert.deepEqual(normalizePayrollHistoryParsed(null), []);
    assert.deepEqual(normalizePayrollHistoryParsed('records'), []);
    assert.deepEqual(normalizePayrollHistoryParsed({ records: { id: 1 } }), []);
    assert.deepEqual(normalizePayrollHistoryParsed({ employees: [{ id: 1 }] }), []);
    assert.deepEqual(normalizePayrollHistoryParsed({}), []);
  });

  it('prefers records over later keys when several arrays are present', () => {
    assert.deepEqual(
      normalizePayrollHistoryParsed({ records: [{ a: 1 }], data: [{ b: 2 }] }),
      [{ a: 1 }]
    );
  });
});

describe('normalizePayrollEmployeesParsed', () => {
  it('accepts a top-level array and employees/data/items/records wrappers', () => {
    const rows = [{ name: 'Pat' }];
    assert.deepEqual(normalizePayrollEmployeesParsed(rows), rows);
    assert.deepEqual(normalizePayrollEmployeesParsed({ employees: rows }), rows);
    assert.deepEqual(normalizePayrollEmployeesParsed({ data: rows }), rows);
    assert.deepEqual(normalizePayrollEmployeesParsed({ items: rows }), rows);
    assert.deepEqual(normalizePayrollEmployeesParsed({ records: rows }), rows);
  });

  it('returns [] for history-only wrappers and non-arrays', () => {
    assert.deepEqual(normalizePayrollEmployeesParsed({ history: [{ id: 1 }] }), []);
    assert.deepEqual(normalizePayrollEmployeesParsed({ payrolls: [{ id: 1 }] }), []);
    assert.deepEqual(normalizePayrollEmployeesParsed(undefined), []);
  });
});
