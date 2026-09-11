import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { payrollHistoryImportRecords } from '../utils/payrollHistoryImportBody.js';

describe('payrollHistoryImportRecords', () => {
  it('accepts a non-empty records wrapper', () => {
    const recs = [{ id: 'a' }];
    assert.equal(payrollHistoryImportRecords({ records: recs }), recs);
  });

  it('accepts a raw array body', () => {
    const recs = [{ id: 'b' }, { id: 'c' }];
    assert.equal(payrollHistoryImportRecords(recs), recs);
  });

  it('rejects empty arrays and missing/non-array records', () => {
    assert.equal(payrollHistoryImportRecords({ records: [] }), null);
    assert.equal(payrollHistoryImportRecords([]), null);
    assert.equal(payrollHistoryImportRecords({ records: null }), null);
    assert.equal(payrollHistoryImportRecords({}), null);
    assert.equal(payrollHistoryImportRecords(null), null);
    assert.equal(payrollHistoryImportRecords(undefined), null);
  });

  it('does not unwrap file-style history/employees wrappers', () => {
    assert.equal(payrollHistoryImportRecords({ history: [{ id: 'x' }] }), null);
    assert.equal(payrollHistoryImportRecords({ employees: [{ id: 'y' }] }), null);
  });

  it('prefers body.records over a raw array when both could apply', () => {
    const wrapped = [{ id: 'from-records' }];
    assert.equal(payrollHistoryImportRecords(Object.assign([], { records: wrapped })), wrapped);
  });
});
