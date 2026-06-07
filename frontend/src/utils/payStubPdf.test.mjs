import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';

async function loadPayStubModule() {
  const server = await createServer({
    server: { middlewareMode: true },
    appType: 'custom',
    logLevel: 'error',
  });
  try {
    return await server.ssrLoadModule('/src/utils/payStubPdf.js');
  } finally {
    await server.close();
  }
}

test('manual prior YTD prevents automatic calendar backfill double-counting', async () => {
  const { buildPreparedPaystubPages } = await loadPayStubModule();
  const [stub] = buildPreparedPaystubPages(
    [
      {
        periodEnd: '2026-04-30',
        gross: 1000,
      },
    ],
    true,
    {
      taxYear: 2026,
      gross: 3000,
    },
    {
      calendarYtdBackfill: true,
      payFrequency: 'Monthly',
    },
  );

  assert.equal(stub.ytdGross, 4000);
  assert.equal(stub.netYtd, 4000);
});

test('automatic calendar backfill still applies when manual prior YTD is blank', async () => {
  const { buildPreparedPaystubPages } = await loadPayStubModule();
  const [stub] = buildPreparedPaystubPages(
    [
      {
        periodEnd: '2026-04-30',
        gross: 1000,
      },
    ],
    true,
    undefined,
    {
      calendarYtdBackfill: true,
      payFrequency: 'Monthly',
    },
  );

  assert.equal(stub.ytdGross, 4000);
  assert.equal(stub.netYtd, 4000);
});
