import { computeW2Deductions } from './payrollTaxUS.js';

export function moneyFixed2(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return '';
  return x.toFixed(2);
}

/**
 * W-2 withholdings in input-row order, with the Social Security wage base
 * consumed in chronological period-end order.
 *
 * `deps.parsePayDate` and `deps.paycheckGrossFromEntry` are the pay-stub PDF
 * helpers so form estimates stay on the same gross the PDF uses.
 */
export function sequentialW2DeductionsInRowOrder(
  rows,
  payFrequency,
  filingStatus,
  workStateCode,
  priorSocSeed = 0,
  spreadMonthlyAcrossPaychecks = false,
  deps,
) {
  const { parsePayDate, paycheckGrossFromEntry } = deps;
  const tagged = rows.map((row, idx) => ({ row, idx }));
  tagged.sort((a, b) => +parsePayDate(a.row.periodEnd) - +parsePayDate(b.row.periodEnd));
  let priorSocSec = Number(priorSocSeed) || 0;
  const calcByIdx = {};
  tagged.forEach(({ row, idx }) => {
    const gross = paycheckGrossFromEntry(
      Math.max(0, Number(row.gross) || 0),
      payFrequency,
      spreadMonthlyAcrossPaychecks,
    );
    const calc = computeW2Deductions({
      gross,
      payFrequency,
      filingStatus,
      workStateCode,
      priorYtdSocSecWages: priorSocSec,
    });
    priorSocSec += calc.oasdiWagesNow ?? 0;
    calcByIdx[idx] = calc;
  });
  return rows.map((_, idx) => {
    const calc = calcByIdx[idx];
    return {
      federal: calc.federal,
      socialSecurity: calc.socialSecurity,
      medicare: calc.medicare,
      medicareBase: calc.medicareBase,
      medicareAdditional: calc.medicareAdditional,
      state: calc.state,
      oasdiWagesNow: calc.oasdiWagesNow ?? 0,
    };
  });
}

export function formatDeductionFields(d) {
  return {
    federal: moneyFixed2(d.federal),
    socialSecurity: moneyFixed2(d.socialSecurity),
    medicare: moneyFixed2(d.medicare),
    medicareBase: moneyFixed2(d.medicareBase),
    medicareAdditional: moneyFixed2(d.medicareAdditional),
    state: moneyFixed2(d.state),
  };
}

export function parseOptionalTaxYear(raw) {
  const t = `${raw ?? ''}`.trim();
  if (!t) return undefined;
  const y = Number(t);
  return Number.isFinite(y) && y >= 1970 && y <= 2150 ? y : undefined;
}

export function anyPriorYtdFieldFilled(fields) {
  return Object.values(fields).some((v) => `${v ?? ''}`.trim() !== '');
}
