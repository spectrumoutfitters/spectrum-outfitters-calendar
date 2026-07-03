import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createServer } from 'vite';

let vite;
let payStubPdf;
let adminNavRegistry;

before(async () => {
  vite = await createServer({
    appType: 'custom',
    logLevel: 'error',
    server: { middlewareMode: true },
  });
  payStubPdf = await vite.ssrLoadModule('/src/utils/payStubPdf.js');
  adminNavRegistry = await vite.ssrLoadModule('/src/config/adminNavRegistry.js');
});

after(async () => {
  await vite?.close();
});

test('manual prior YTD suppresses inferred calendar backfill', () => {
  const [page] = payStubPdf.buildPreparedPaystubPages(
    [{ periodEnd: '2026-06-30', gross: 5000, federal: 100 }],
    false,
    { gross: 25000, federal: 2500 },
    {
      calendarYtdBackfill: true,
      payFrequency: 'Monthly',
      spreadMonthlyAcrossPaychecks: false,
      filingStatus: 'single',
      workerState: 'TX',
    },
  );

  assert.equal(page.ytdGross, 30000);
  assert.equal(page.ytdFed, 2600);
});

test('weekly W-2 calendar backfill counts actual prior paychecks', () => {
  const [page] = payStubPdf.buildPreparedPaystubPages(
    [{ periodEnd: '2026-06-26', gross: 1000, federal: 100 }],
    false,
    {},
    {
      calendarYtdBackfill: true,
      payFrequency: 'Weekly',
      spreadMonthlyAcrossPaychecks: false,
      filingStatus: 'single',
      workerState: 'TX',
    },
  );

  assert.equal(page.ytdGross, 26000);
});

test('1099 weekly varying gross does not reuse first check as all-week YTD rate', () => {
  const pages = payStubPdf.buildPreparedPaystubPages(
    [
      { periodEnd: '2026-04-03', gross: 800 },
      { periodEnd: '2026-05-01', gross: 1000 },
      { periodEnd: '2026-06-05', gross: 1200 },
    ],
    true,
    {},
    {
      calendarYtdBackfill: true,
      payFrequency: 'Weekly',
      spreadMonthlyAcrossPaychecks: false,
    },
  );

  assert.equal(Math.round(pages[2].ytdGross), 13400);
  assert.notEqual(Math.round(pages[2].ytdGross), 18400);
});

test('annual salary helper returns literal gross per paycheck', () => {
  assert.equal(payStubPdf.grossPerPaycheckFromAnnualSalary(120000, 'Monthly'), 10000);
  assert.equal(
    Math.round(payStubPdf.grossPerPaycheckFromAnnualSalary(120000, 'Weekly') * 100) / 100,
    2307.69,
  );
  assert.equal(payStubPdf.paycheckGrossFromEntry(2000, 'Weekly', false), 2000);
});

test('legacy flat admin tabs resolve to nested admin navigation', () => {
  assert.deepEqual(adminNavRegistry.resolveLegacyAdminTab('payroll'), {
    main: 'finance',
    sub: 'payroll',
  });
  assert.deepEqual(adminNavRegistry.resolveLegacyAdminTab('inventory'), {
    main: 'inventory',
    sub: 'inventory',
  });
  assert.deepEqual(adminNavRegistry.resolveLegacyAdminTab('settings'), {
    main: 'settings',
    sub: 'general',
  });
  assert.equal(adminNavRegistry.resolveLegacyAdminTab('does-not-exist'), null);
});
