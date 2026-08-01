import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  enrichFinancingRow,
  parsePayee,
  roundMoney,
  validateDeductionReason
} from '../utils/employeeFinancingMath.js';

describe('roundMoney', () => {
  it('rounds to cents', () => {
    assert.equal(roundMoney(10.005), 10.01);
    assert.equal(roundMoney(10.004), 10);
  });

  it('treats invalid values as zero', () => {
    assert.equal(roundMoney(undefined), 0);
    assert.equal(roundMoney('abc'), 0);
  });
});

describe('validateDeductionReason', () => {
  it('allows empty reason when not deducting from payroll', () => {
    assert.equal(validateDeductionReason(false, ''), true);
    assert.equal(validateDeductionReason(0, null), true);
  });

  it('requires non-empty trimmed reason when deducting', () => {
    assert.equal(validateDeductionReason(true, '  Tire financing  '), true);
    assert.equal(validateDeductionReason(1, '   '), false);
    assert.equal(validateDeductionReason(true, null), false);
  });
});

describe('parsePayee', () => {
  it('prefers Spectrum employee id and clears external fields', () => {
    assert.deepEqual(
      parsePayee({
        user_id: '12',
        external_party_name: 'Other Co',
        external_party_company: 'Acme'
      }),
      {
        kind: 'employee',
        user_id: 12,
        external_party_name: null,
        external_party_company: null
      }
    );
  });

  it('accepts external payer when user_id is absent', () => {
    assert.deepEqual(
      parsePayee({
        user_id: '',
        external_party_name: '  Vendor LLC  ',
        external_party_company: '  Parts Co  '
      }),
      {
        kind: 'external',
        user_id: null,
        external_party_name: 'Vendor LLC',
        external_party_company: 'Parts Co'
      }
    );
  });

  it('rejects missing employee and missing external name', () => {
    assert.deepEqual(parsePayee({ user_id: 0, external_party_name: '  ' }), {
      kind: 'invalid'
    });
    assert.deepEqual(parsePayee({}), { kind: 'invalid' });
  });
});

describe('enrichFinancingRow', () => {
  it('uses employee name for Spectrum payees', () => {
    const row = enrichFinancingRow({
      user_id: 7,
      employee_name: 'Alex Tech',
      employee_username: 'alex'
    });
    assert.equal(row.payer_display, 'Alex Tech');
  });

  it('formats external payer with optional company', () => {
    const withCo = enrichFinancingRow({
      user_id: null,
      external_party_name: 'Jordan',
      external_party_company: 'Mobile Detailing'
    });
    assert.equal(withCo.payer_display, 'Jordan (Mobile Detailing)');

    const bare = enrichFinancingRow({
      user_id: null,
      external_party_name: null,
      external_party_company: null
    });
    assert.equal(bare.payer_display, 'External payer');
  });
});
