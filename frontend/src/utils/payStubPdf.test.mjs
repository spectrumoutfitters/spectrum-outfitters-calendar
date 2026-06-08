import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';

async function loadFrontendModule(path) {
  const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
  try {
    return await server.ssrLoadModule(path);
  } finally {
    await server.close();
  }
}

test('non-monthly pay stubs default to literal per-check gross amounts', async () => {
  const [{ DEFAULT_SPREAD_MONTHLY_ACROSS_PAYCHECKS }, { buildPreparedPaystubPages }] =
    await Promise.all([
      loadFrontendModule('/src/components/Admin/PayStubMaker.jsx'),
      loadFrontendModule('/src/utils/payStubPdf.js'),
    ]);

  assert.equal(DEFAULT_SPREAD_MONTHLY_ACROSS_PAYCHECKS, false);

  const [page] = buildPreparedPaystubPages(
    [{ periodEnd: '2026-06-05', gross: 1000 }],
    true,
    {},
    {
      payFrequency: 'Weekly',
      calendarYtdBackfill: false,
      spreadMonthlyAcrossPaychecks: DEFAULT_SPREAD_MONTHLY_ACROSS_PAYCHECKS,
    },
  );

  assert.equal(page.gross, 1000);
  assert.equal(page.netCurr, 1000);
  assert.equal(page.ytdGross, 1000);
});

test('monthly gross split remains available by explicit opt-in', async () => {
  const { buildPreparedPaystubPages } = await loadFrontendModule('/src/utils/payStubPdf.js');

  const [page] = buildPreparedPaystubPages(
    [{ periodEnd: '2026-06-05', gross: 1000 }],
    true,
    {},
    {
      payFrequency: 'Weekly',
      calendarYtdBackfill: false,
      spreadMonthlyAcrossPaychecks: true,
    },
  );

  assert.equal(page.gross, (1000 * 12) / 52);
  assert.equal(page.netCurr, (1000 * 12) / 52);
  assert.equal(page.ytdGross, (1000 * 12) / 52);
});
