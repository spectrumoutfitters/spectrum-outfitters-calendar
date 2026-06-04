import assert from 'node:assert/strict';
import test from 'node:test';

import { buildPreparedPaystubPages, paycheckGrossFromEntry } from './payStubPdf.js';
import { grossPerPaycheckFromAnnualSalary } from './payrollTaxUS.js';

test('weekly pay stubs treat entered gross as one paycheck unless monthly spread is explicit', () => {
  const [stub] = buildPreparedPaystubPages(
    [{ periodEnd: '2026-06-05', gross: 2000 }],
    false,
    {},
    { payFrequency: 'Weekly', spreadMonthlyAcrossPaychecks: false },
  );

  assert.equal(stub.gross, 2000);
  assert.equal(stub.netCurr, 2000);
});

test('explicit monthly spread converts monthly gross into one weekly paycheck', () => {
  const gross = paycheckGrossFromEntry(10000, 'Weekly', true);

  assert.equal(gross, 10000 * 12 / 52);
});

test('annual salary helper fills gross for the selected pay schedule', () => {
  assert.equal(grossPerPaycheckFromAnnualSalary(120000, 'Monthly'), 10000);
  assert.equal(grossPerPaycheckFromAnnualSalary(120000, 'Weekly'), 120000 / 52);
  assert.equal(grossPerPaycheckFromAnnualSalary(120000, 'Bi-weekly'), 120000 / 26);
});
