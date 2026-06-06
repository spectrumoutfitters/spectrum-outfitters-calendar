import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { createServer } from 'vite';

let server;
let payStubPdf;
let payStubMaker;

before(async () => {
  server = await createServer({
    configFile: false,
    root: new URL('..', import.meta.url).pathname,
    logLevel: 'silent',
    plugins: [(await import('@vitejs/plugin-react')).default()],
  });

  payStubPdf = await server.ssrLoadModule('/src/utils/payStubPdf.js');
  payStubMaker = await server.ssrLoadModule('/src/components/Admin/PayStubMaker.jsx');
});

after(async () => {
  await server?.close();
});

describe('pay stub gross defaults', () => {
  it('keeps entered non-monthly gross as per-check pay unless monthly spread is explicit', () => {
    assert.equal(payStubMaker.DEFAULT_SPREAD_MONTHLY_ACROSS_PAYCHECKS, false);

    const [literalWeekly] = payStubPdf.buildPreparedPaystubPages(
      [{ periodEnd: '2026-06-05', gross: 1000 }],
      true,
      {},
      {
        calendarYtdBackfill: false,
        payFrequency: 'Weekly',
        spreadMonthlyAcrossPaychecks: payStubMaker.DEFAULT_SPREAD_MONTHLY_ACROSS_PAYCHECKS,
      },
    );

    assert.equal(literalWeekly.gross, 1000);

    const [monthlySpreadWeekly] = payStubPdf.buildPreparedPaystubPages(
      [{ periodEnd: '2026-06-05', gross: 1000 }],
      true,
      {},
      {
        calendarYtdBackfill: false,
        payFrequency: 'Weekly',
        spreadMonthlyAcrossPaychecks: true,
      },
    );

    assert.equal(monthlySpreadWeekly.gross, 230.76923076923077);
  });

  it('turns annual salary into per-check gross for the selected pay frequency', () => {
    assert.equal(payStubMaker.grossPerPaycheckFromAnnualSalary('120,000', 'Weekly'), '2307.69');
    assert.equal(payStubMaker.grossPerPaycheckFromAnnualSalary('120000', 'Monthly'), '10000.00');
  });
});
