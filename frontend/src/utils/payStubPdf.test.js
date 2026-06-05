import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { createServer } from 'vite';

let server;

async function loadPayStubPdf() {
  if (!server) {
    server = await createServer({
      root: new URL('../..', import.meta.url).pathname,
      logLevel: 'error',
      server: { middlewareMode: true },
    });
  }
  return server.ssrLoadModule('/src/utils/payStubPdf.js');
}

after(async () => {
  if (server) {
    await server.close();
  }
});

test('weekly 1099 calendar YTD counts discrete paychecks when no manual prior is supplied', async () => {
  const { buildPreparedPaystubPages } = await loadPayStubPdf();

  const [page] = buildPreparedPaystubPages(
    [{ periodEnd: '2026-04-03', gross: 1000 }],
    true,
    {},
    { calendarYtdBackfill: true, payFrequency: 'Weekly' },
  );

  assert.equal(page.ytdGross, 14000);
  assert.equal(page.netYtd, 14000);
});

test('weekly 1099 manual prior YTD is not combined with inferred phantom months', async () => {
  const { buildPreparedPaystubPages } = await loadPayStubPdf();

  const [page] = buildPreparedPaystubPages(
    [{ periodEnd: '2026-04-03', gross: 1000 }],
    true,
    { taxYear: 2026, gross: 12000 },
    { calendarYtdBackfill: true, payFrequency: 'Weekly' },
  );

  assert.equal(page.ytdGross, 13000);
  assert.equal(page.netYtd, 13000);
});
