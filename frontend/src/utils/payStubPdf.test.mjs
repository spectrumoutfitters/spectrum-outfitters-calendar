import test from 'node:test';
import assert from 'node:assert/strict';

import { buildPreparedPaystubPages } from './payStubPdf.js';

test('manual prior YTD prevents automatic calendar backfill double-counting', () => {
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

test('automatic calendar backfill still applies when manual prior YTD is blank', () => {
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
