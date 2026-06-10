import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

let vite;
let payStubPdf;

test.before(async () => {
  vite = await createServer({
    root: fileURLToPath(new URL('../../', import.meta.url)),
    server: { middlewareMode: true },
    appType: 'custom',
    logLevel: 'error',
  });
  payStubPdf = await vite.ssrLoadModule('/src/utils/payStubPdf.js');
});

test.after(async () => {
  await vite?.close();
});

test('automatic W-2 deductions seed Social Security with calendar backfill wages', () => {
  const {
    calendarBackfillSocSecWagesByYear,
    computeW2DeductionsInRowOrder,
  } = payStubPdf;
  const rows = [
    { periodEnd: '2025-07-04', gross: 6700 },
    { periodEnd: '2025-07-11', gross: 6700 },
  ];
  const opts = {
    calendarYtdBackfill: true,
    monthlyJanBackfill: true,
    payFrequency: 'Weekly',
    filingStatus: 'single',
    workerState: 'TX',
    spreadMonthlyAcrossPaychecks: false,
  };

  const priorSocSecWagesByYear = calendarBackfillSocSecWagesByYear(rows, opts);
  const deductions = computeW2DeductionsInRowOrder(rows, {
    payFrequency: opts.payFrequency,
    filingStatus: opts.filingStatus,
    workStateCode: opts.workerState,
    priorSocSecWagesByYear,
    spreadMonthlyAcrossPaychecks: opts.spreadMonthlyAcrossPaychecks,
  });

  assert.ok(priorSocSecWagesByYear[2025] > 170000);
  assert.ok(
    deductions[0].socialSecurity < 200,
    `expected first exported check to be near the OASDI cap, got ${deductions[0].socialSecurity}`,
  );
  assert.equal(deductions[1].socialSecurity, 0);
});

test('calendar YTD backfill applies independently to each year in a multi-year PDF', () => {
  const { buildPreparedPaystubPages } = payStubPdf;
  const prepared = buildPreparedPaystubPages(
    [
      { periodEnd: '2025-11-30', gross: 5000 },
      { periodEnd: '2025-12-31', gross: 5000 },
      { periodEnd: '2026-01-31', gross: 5000 },
    ],
    false,
    {},
    {
      calendarYtdBackfill: true,
      monthlyJanBackfill: true,
      payFrequency: 'Monthly',
      filingStatus: 'single',
      workerState: 'TX',
    },
  );

  const nov2025 = prepared.find((p) => p.periodEnd === '2025-11-30');
  const dec2025 = prepared.find((p) => p.periodEnd === '2025-12-31');
  const jan2026 = prepared.find((p) => p.periodEnd === '2026-01-31');

  assert.equal(nov2025.ytdGross, 55000);
  assert.equal(dec2025.ytdGross, 60000);
  assert.equal(jan2026.ytdGross, 5000);
});

test('variable weekly 1099 gross YTD includes actual exported checks', () => {
  const { buildPreparedPaystubPages } = payStubPdf;
  const prepared = buildPreparedPaystubPages(
    [
      { periodEnd: '2025-01-03', gross: 1000 },
      { periodEnd: '2025-01-10', gross: 2000 },
      { periodEnd: '2025-01-17', gross: 3000 },
    ],
    true,
    {},
    {
      calendarYtdBackfill: true,
      monthlyJanBackfill: true,
      payFrequency: 'Weekly',
    },
  );

  assert.equal(prepared[0].ytdGross, 1000);
  assert.equal(prepared[1].ytdGross, 3000);
  assert.equal(prepared[2].ytdGross, 6000);
});
