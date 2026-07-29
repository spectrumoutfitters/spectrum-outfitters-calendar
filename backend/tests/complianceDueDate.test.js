import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  addMonthsWithDay,
  calculateComplianceDueDate,
} from '../utils/complianceDueDate.js';

describe('addMonthsWithDay', () => {
  it('does not overflow Jan 31 into March when targeting day 15', () => {
    assert.equal(addMonthsWithDay('2026-01-31', 1, 15), '2026-02-15');
  });

  it('does not overflow Jan 31 into March when targeting day 20 (TX sales tax)', () => {
    assert.equal(addMonthsWithDay('2026-01-31', 1, 20), '2026-02-20');
  });

  it('does not overflow Aug 31 into October', () => {
    assert.equal(addMonthsWithDay('2026-08-31', 1, 15), '2026-09-15');
  });

  it('clamps day 31 to last day of February', () => {
    assert.equal(addMonthsWithDay('2026-01-31', 1, 31), '2026-02-28');
  });

  it('handles Dec 31 → following January', () => {
    assert.equal(addMonthsWithDay('2025-12-31', 1, 15), '2026-01-15');
  });

  it('leaves short-month ends unchanged when day exists', () => {
    assert.equal(addMonthsWithDay('2026-02-28', 1, 15), '2026-03-15');
  });
});

describe('calculateComplianceDueDate monthly', () => {
  const federalPayroll = {
    frequency: 'monthly',
    due_day: 15,
    due_rule_json: JSON.stringify({
      offset_months: 1,
      day_of_month: 15,
    }),
  };

  const texasSalesTax = {
    frequency: 'monthly',
    due_day: 20,
    due_rule_json: JSON.stringify({
      offset_months: 1,
      day_of_month: 20,
    }),
  };

  it('federal payroll deposit: January → February 15 (not March)', () => {
    assert.equal(
      calculateComplianceDueDate(federalPayroll, '2026-01-01', '2026-01-31'),
      '2026-02-15'
    );
  });

  it('texas sales tax: January → February 20 (not March)', () => {
    assert.equal(
      calculateComplianceDueDate(texasSalesTax, '2026-01-01', '2026-01-31'),
      '2026-02-20'
    );
  });

  it('federal payroll deposit: August → September 15 (not October)', () => {
    assert.equal(
      calculateComplianceDueDate(federalPayroll, '2026-08-01', '2026-08-31'),
      '2026-09-15'
    );
  });

  it('federal payroll deposit: May → June 15 (not July)', () => {
    assert.equal(
      calculateComplianceDueDate(federalPayroll, '2026-05-01', '2026-05-31'),
      '2026-06-15'
    );
  });
});

describe('calculateComplianceDueDate quarterly/annual', () => {
  it('uses quarter-specific due dates for Form 941', () => {
    const form941 = {
      frequency: 'quarterly',
      due_rule_json: JSON.stringify({
        quarters: {
          Q1: { due: '04-30' },
          Q2: { due: '07-31' },
          Q3: { due: '10-31' },
          Q4: { due: '01-31' },
        },
      }),
    };
    assert.equal(
      calculateComplianceDueDate(form941, '2026-01-01', '2026-03-31'),
      '2026-04-30'
    );
    assert.equal(
      calculateComplianceDueDate(form941, '2026-10-01', '2026-12-31'),
      '2027-01-31'
    );
  });

  it('annual Form 940 due Jan 31 of following year', () => {
    const form940 = {
      frequency: 'annual',
      due_day: 31,
      due_rule_json: JSON.stringify({ due_month: 1, due_day: 31 }),
    };
    assert.equal(
      calculateComplianceDueDate(form940, '2025-01-01', '2025-12-31'),
      '2026-01-31'
    );
  });

  it('quarterly fallback clamps to last day of following month', () => {
    const custom = { frequency: 'quarterly', due_rule_json: '{}' };
    assert.equal(
      calculateComplianceDueDate(custom, '2026-01-01', '2026-03-31'),
      '2026-04-30'
    );
  });
});
