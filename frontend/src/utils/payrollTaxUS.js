/**
 * Estimated U.S. employee payroll taxes for pay-stub previews (TX state default).
 * Not payroll or legal advice — W-4 withholding can differ materially from simplified liability projection.
 */

export const SOC_SEC_RATE = 0.062;
export const MEDICARE_RATE_BASE = 0.0145;
export const MEDICARE_RATE_ADDITIONAL = 0.009;

/** SSA OASDI wage base (verify annually — 2025). */
export const SOC_SEC_WAGE_BASE_2025 = 176100;

/** Standard deduction approximations TY2025. */
export const STANDARD_DEDUCTION = {
  single: 15000,
  mfj: 30000,
};

/** Taxable-income marginal brackets TY2025 (single, ordinary rates). */
const ANNUAL_TAXABLE_BRACKETS_SINGLE = [
  { upTo: 11925, rate: 0.1 },
  { upTo: 48475, rate: 0.12 },
  { upTo: 103350, rate: 0.22 },
  { upTo: 197300, rate: 0.24 },
  { upTo: 250525, rate: 0.32 },
  { upTo: 626350, rate: 0.35 },
  { upTo: Infinity, rate: 0.37 },
];

/** Married filing jointly TY2025. */
const ANNUAL_TAXABLE_BRACKETS_MFJ = [
  { upTo: 23850, rate: 0.1 },
  { upTo: 96950, rate: 0.12 },
  { upTo: 206700, rate: 0.22 },
  { upTo: 394600, rate: 0.24 },
  { upTo: 501050, rate: 0.32 },
  { upTo: 751600, rate: 0.35 },
  { upTo: Infinity, rate: 0.37 },
];

export function payPeriodsPerYear(payFrequency) {
  switch (payFrequency) {
    case 'Weekly':
      return 52;
    case 'Bi-weekly':
      return 26;
    case 'Semi-monthly':
      return 24;
    case 'Monthly':
      return 12;
    default:
      return 26;
  }
}

export function marginalFederalIncomeAnnual(taxableIncomeAnnual, filingStatus = 'single') {
  const brackets =
    filingStatus === 'mfj' ? ANNUAL_TAXABLE_BRACKETS_MFJ : ANNUAL_TAXABLE_BRACKETS_SINGLE;
  let tax = 0;
  let prior = 0;
  let remaining = Math.max(0, Number(taxableIncomeAnnual) || 0);

  for (const tier of brackets) {
    const width = Math.max(0, tier.upTo - prior);
    if (remaining <= 0) break;
    const slice = Math.min(remaining, width);
    tax += slice * tier.rate;
    remaining -= slice;
    prior = tier.upTo;
  }

  return tax;
}

function roundUsd2(n) {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}

function estimatedStateAnnual(workStateRaw, taxableIncomeAnnual, filingSingle) {
  const code = String(workStateRaw || 'TX').trim().toUpperCase().slice(0, 2);
  const roughNoWageIncomeTax = ['TX', 'WY', 'SD', 'FL', 'NV', 'NH', 'AK'];
  if (roughNoWageIncomeTax.includes(code)) return 0;
  const mult = filingSingle ? 1 : 0.88;
  return Math.max(0, Number(taxableIncomeAnnual)) * 0.045 * mult * 0.22;
}

/**
 * Employer-side withheld-style estimate per pay period for W-2 employees.
 */
export function computeW2Deductions({
  gross,
  payFrequency = 'Bi-weekly',
  filingStatus = 'single',
  workStateCode = 'TX',
  priorYtdSocSecWages = 0,
}) {
  const g = Math.max(0, Number(gross) || 0);
  const periods = payPeriodsPerYear(payFrequency);
  const projectedAnnual = g * periods;
  const filing = filingStatus === 'mfj' ? 'mfj' : 'single';
  const std = STANDARD_DEDUCTION[filing] ?? STANDARD_DEDUCTION.single;

  const taxableFed = Math.max(0, projectedAnnual - std);
  const fedAnnualEst = marginalFederalIncomeAnnual(taxableFed, filing);
  const federal = projectedAnnual <= 0 ? 0 : roundUsd2(fedAnnualEst / periods);

  const prior = Math.max(0, Number(priorYtdSocSecWages) || 0);
  const remBase = Math.max(0, SOC_SEC_WAGE_BASE_2025 - prior);
  const oasdiWagesNow = Math.min(g, remBase);
  const socialSecurity = roundUsd2(oasdiWagesNow * SOC_SEC_RATE);

  const medicareBaseAmount = roundUsd2(g * MEDICARE_RATE_BASE);
  const thresh = filing === 'mfj' ? 250000 : 200000;
  const medicareAdd = projectedAnnual > thresh ? roundUsd2(g * MEDICARE_RATE_ADDITIONAL) : 0;

  const stateAnnualHint = estimatedStateAnnual(workStateCode, taxableFed, filing === 'single');
  const state = projectedAnnual <= 0 ? 0 : roundUsd2(stateAnnualHint / periods);

  return {
    federal,
    socialSecurity,
    medicare: medicareBaseAmount + medicareAdd,
    medicareBase: medicareBaseAmount,
    medicareAdditional: medicareAdd,
    state,
    oasdiWagesNow,
    projectedAnnual,
    taxableForFederalAnnual: taxableFed,
  };
}

export function computeContractorDeductions() {
  return {
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
}
