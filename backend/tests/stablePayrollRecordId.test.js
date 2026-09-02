import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { stablePayrollRecordId } from '../utils/payrollRecordId.js';

describe('stablePayrollRecordId', () => {
  it('keeps an explicit id, including numeric 0 as "0"', () => {
    assert.equal(stablePayrollRecordId({ id: 'regular-pay-42' }), 'regular-pay-42');
    assert.equal(stablePayrollRecordId({ id: 0 }), '0');
    assert.equal(stablePayrollRecordId({ id: '0' }), '0');
  });

  it('synthesizes when id is missing, empty, or whitespace-only', () => {
    const rec = {
      employee: { id: 'e1' },
      processedDate: '2026-07-10',
      weekStart: '2026-07-06',
    };
    assert.equal(stablePayrollRecordId({ ...rec }), 'synth:e1:2026-07-10:2026-07-06');
    assert.equal(stablePayrollRecordId({ ...rec, id: '' }), 'synth:e1:2026-07-10:2026-07-06');
    assert.equal(stablePayrollRecordId({ ...rec, id: '   ' }), 'synth:e1:2026-07-10:2026-07-06');
    assert.equal(stablePayrollRecordId({ ...rec, id: null }), 'synth:e1:2026-07-10:2026-07-06');
  });

  it('falls back employee.id → employeeId → employee_id (|| so 0 is skipped)', () => {
    assert.equal(
      stablePayrollRecordId({ employeeId: 'eid', processedDate: 'd', weekStart: 'w' }),
      'synth:eid:d:w',
    );
    assert.equal(
      stablePayrollRecordId({ employee_id: 'legacy', processedDate: 'd', weekStart: 'w' }),
      'synth:legacy:d:w',
    );
    assert.equal(
      stablePayrollRecordId({
        employee: { id: 0 },
        employeeId: 'eid',
        processedDate: 'd',
        weekStart: 'w',
      }),
      'synth:eid:d:w',
    );
  });

  it('falls back processedDate → payDate → date and weekStart → weekEnd', () => {
    assert.equal(
      stablePayrollRecordId({ employee: { id: 'e' }, payDate: 'pay', weekEnd: 'end' }),
      'synth:e:pay:end',
    );
    assert.equal(
      stablePayrollRecordId({ employee: { id: 'e' }, date: 'dt' }),
      'synth:e:dt:',
    );
  });
});
