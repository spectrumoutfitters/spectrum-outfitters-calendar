import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  SOC_SEC_WAGE_BASE_2025,
  computeContractorDeductions,
  computeW2Deductions,
  marginalFederalIncomeAnnual,
  payPeriodsPerYear,
} from '../src/utils/payrollTaxUS.js';

describe('payroll tax estimates', () => {
  it('uses the correct annual paycheck count for each supported frequency', () => {
    assert.deepEqual(
      Object.fromEntries(
        ['Weekly', 'Bi-weekly', 'Semi-monthly', 'Monthly', 'Other'].map((frequency) => [
          frequency,
          payPeriodsPerYear(frequency),
        ]),
      ),
      {
        Weekly: 52,
        'Bi-weekly': 26,
        'Semi-monthly': 24,
        Monthly: 12,
        Other: 26,
      },
    );
  });

  it('applies filing-status bracket boundaries progressively', () => {
    assert.equal(marginalFederalIncomeAnnual(11_925, 'single'), 1_192.5);
    assert.equal(marginalFederalIncomeAnnual(12_025, 'single'), 1_204.5);
    assert.equal(marginalFederalIncomeAnnual(23_850, 'mfj'), 2_385);
    assert.equal(marginalFederalIncomeAnnual(-1_000, 'single'), 0);
  });

  it('caps Social Security wages and preserves state-specific withholding', () => {
    const common = {
      gross: 1_000,
      payFrequency: 'Weekly',
      filingStatus: 'single',
      priorYtdSocSecWages: SOC_SEC_WAGE_BASE_2025 - 100,
    };

    const texas = computeW2Deductions({ ...common, workStateCode: 'TX' });
    const california = computeW2Deductions({ ...common, workStateCode: 'CA' });

    assert.deepEqual(
      {
        projectedAnnual: texas.projectedAnnual,
        taxableForFederalAnnual: texas.taxableForFederalAnnual,
        federal: texas.federal,
        socialSecurity: texas.socialSecurity,
        oasdiWagesNow: texas.oasdiWagesNow,
        medicareBase: texas.medicareBase,
        state: texas.state,
      },
      {
        projectedAnnual: 52_000,
        taxableForFederalAnnual: 37_000,
        federal: 80.8,
        socialSecurity: 6.2,
        oasdiWagesNow: 100,
        medicareBase: 14.5,
        state: 0,
      },
    );
    assert.equal(california.state, 7.04);
  });

  it('returns zero deductions for contractors and non-positive employee gross', () => {
    const expectedZeros = {
      federal: 0,
      socialSecurity: 0,
      medicare: 0,
      medicareBase: 0,
      medicareAdditional: 0,
      state: 0,
      oasdiWagesNow: 0,
      projectedAnnual: 0,
      taxableForFederalAnnual: 0,
    };

    assert.deepEqual(computeContractorDeductions(), expectedZeros);
    assert.deepEqual(computeW2Deductions({ gross: -500 }), expectedZeros);
  });
});
