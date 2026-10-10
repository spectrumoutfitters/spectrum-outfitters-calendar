import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isValid, parseISO } from 'date-fns';

import { SOC_SEC_WAGE_BASE_2025, payPeriodsPerYear } from '../src/utils/payrollTaxUS.js';
import {
  anyPriorYtdFieldFilled,
  formatDeductionFields,
  parseOptionalTaxYear,
  sequentialW2DeductionsInRowOrder,
} from '../src/utils/payStubW2Sequence.js';

function parsePayDate(raw) {
  if (!raw) return new Date();
  const d = typeof raw === 'string' ? parseISO(raw) : raw;
  return isValid(d) ? d : new Date();
}

function paycheckGrossFromEntry(rawEntered, payFrequency, treatEnteredAmountAsMonthlyInstallment) {
  const g = Math.max(0, Number(rawEntered) || 0);
  const f = `${payFrequency || 'Monthly'}`.trim();
  if (!treatEnteredAmountAsMonthlyInstallment || f === 'Monthly' || !g) return g;
  const periods = payPeriodsPerYear(f);
  return (g * 12) / periods;
}

const deps = { parsePayDate, paycheckGrossFromEntry };

describe('chronological W-2 Social Security sequencing', () => {
  it('applies the wage base in period-end order and returns results in form-row order', () => {
    const rows = [
      { periodEnd: '2026-03-31', gross: '1000' },
      { periodEnd: '2026-01-31', gross: '1000' },
      { periodEnd: '2026-02-28', gross: '1000' },
    ];

    const seq = sequentialW2DeductionsInRowOrder(
      rows,
      'Weekly',
      'single',
      'TX',
      SOC_SEC_WAGE_BASE_2025 - 1500,
      false,
      deps,
    );

    assert.deepEqual(
      seq.map((row) => ({
        oasdiWagesNow: row.oasdiWagesNow,
        socialSecurity: row.socialSecurity,
        medicare: row.medicare,
        state: row.state,
      })),
      [
        { oasdiWagesNow: 0, socialSecurity: 0, medicare: 14.5, state: 0 },
        { oasdiWagesNow: 1000, socialSecurity: 62, medicare: 14.5, state: 0 },
        { oasdiWagesNow: 500, socialSecurity: 31, medicare: 14.5, state: 0 },
      ],
    );
  });

  it('does not let a zero-gross row or a negative prior seed consume the remaining base', () => {
    const rows = [
      { periodEnd: '2026-01-31', gross: '0' },
      { periodEnd: '2026-02-28', gross: '1000' },
    ];

    const seq = sequentialW2DeductionsInRowOrder(
      rows,
      'Weekly',
      'single',
      'TX',
      SOC_SEC_WAGE_BASE_2025 - 100,
      false,
      deps,
    );

    assert.equal(seq[0].oasdiWagesNow, 0);
    assert.equal(seq[0].socialSecurity, 0);
    assert.equal(seq[1].oasdiWagesNow, 100);
    assert.equal(seq[1].socialSecurity, 6.2);

    const negativeSeed = sequentialW2DeductionsInRowOrder(
      [{ periodEnd: '2026-01-31', gross: '1000' }],
      'Weekly',
      'single',
      'TX',
      -100,
      false,
      deps,
    );
    assert.equal(negativeSeed[0].oasdiWagesNow, 1000);
    assert.equal(negativeSeed[0].socialSecurity, 62);
  });

  it('keeps equal period ends in input order and forwards the monthly-spread flag', () => {
    const calls = [];
    const seq = sequentialW2DeductionsInRowOrder(
      [
        { periodEnd: '2026-04-30', gross: '80' },
        { periodEnd: '2026-04-30', gross: '40' },
      ],
      'Weekly',
      'single',
      'TX',
      SOC_SEC_WAGE_BASE_2025 - 50,
      true,
      {
        parsePayDate,
        paycheckGrossFromEntry(raw, frequency, spread) {
          calls.push({ raw, frequency, spread });
          return raw;
        },
      },
    );

    assert.deepEqual(calls, [
      { raw: 80, frequency: 'Weekly', spread: true },
      { raw: 40, frequency: 'Weekly', spread: true },
    ]);
    assert.equal(seq[0].oasdiWagesNow, 50);
    assert.equal(seq[1].oasdiWagesNow, 0);

    const spread = sequentialW2DeductionsInRowOrder(
      [{ periodEnd: '2026-01-31', gross: '5200' }],
      'Weekly',
      'single',
      'TX',
      0,
      true,
      deps,
    );
    assert.equal(spread[0].oasdiWagesNow, 1200);
    assert.equal(spread[0].socialSecurity, 74.4);
  });

  it('returns an empty list for no rows and treats a blank prior seed as zero', () => {
    assert.deepEqual(
      sequentialW2DeductionsInRowOrder([], 'Weekly', 'single', 'TX', 0, false, deps),
      [],
    );

    const seq = sequentialW2DeductionsInRowOrder(
      [{ periodEnd: '2026-01-31', gross: '100' }],
      'Monthly',
      'single',
      'TX',
      '',
      false,
      deps,
    );
    assert.equal(seq[0].oasdiWagesNow, 100);
    assert.equal(seq[0].socialSecurity, 6.2);
  });
});

describe('pay stub prior-YTD field gates', () => {
  it('accepts tax years on the inclusive 1970–2150 bounds and drops blanks', () => {
    assert.equal(parseOptionalTaxYear(''), undefined);
    assert.equal(parseOptionalTaxYear('   '), undefined);
    assert.equal(parseOptionalTaxYear(null), undefined);
    assert.equal(parseOptionalTaxYear('2026'), 2026);
    assert.equal(parseOptionalTaxYear(' 1970 '), 1970);
    assert.equal(parseOptionalTaxYear('2150'), 2150);
    assert.equal(parseOptionalTaxYear('1969'), undefined);
    assert.equal(parseOptionalTaxYear('2151'), undefined);
    assert.equal(parseOptionalTaxYear('2026abc'), undefined);
  });

  it('treats an explicit zero as a filled prior-YTD field and ignores whitespace', () => {
    assert.equal(anyPriorYtdFieldFilled({ gross: '', federal: '   ', state: null }), false);
    assert.equal(anyPriorYtdFieldFilled({ gross: '0', federal: '' }), true);
    assert.equal(anyPriorYtdFieldFilled({}), false);
  });

  it('formats withholding amounts for the form and blanks non-finite values', () => {
    assert.deepEqual(
      formatDeductionFields({
        federal: 10,
        socialSecurity: 6.2,
        medicare: 1.45,
        medicareBase: 1.45,
        medicareAdditional: 0,
        state: 0,
      }),
      {
        federal: '10.00',
        socialSecurity: '6.20',
        medicare: '1.45',
        medicareBase: '1.45',
        medicareAdditional: '0.00',
        state: '0.00',
      },
    );
    assert.equal(formatDeductionFields({
      federal: Number.NaN,
      socialSecurity: undefined,
      medicare: 0,
      medicareBase: 0,
      medicareAdditional: 0,
      state: 0,
    }).federal, '');
  });
});
