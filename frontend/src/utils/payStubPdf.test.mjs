import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildPreparedPaystubPages,
  paycheckGrossFromEntry,
} from './payStubPdf.js';

function money(n) {
  return Math.round(Number(n) * 100) / 100;
}

test('non-monthly gross entries remain per-paycheck unless monthly splitting is explicit', () => {
  assert.equal(paycheckGrossFromEntry(2000, 'Bi-weekly', false), 2000);
  assert.equal(money(paycheckGrossFromEntry(2000, 'Bi-weekly', true)), 923.08);

  const [stub] = buildPreparedPaystubPages(
    [{ periodEnd: '2026-03-13', gross: 2000 }],
    false,
    {},
    {
      payFrequency: 'Bi-weekly',
      calendarYtdBackfill: false,
      spreadMonthlyAcrossPaychecks: false,
    },
  );

  assert.equal(stub.gross, 2000);
  assert.equal(stub.ytdGross, 2000);
});

test('calendar YTD backfill is disabled unless explicitly requested', () => {
  const [defaultStub] = buildPreparedPaystubPages(
    [{ periodEnd: '2026-03-06', gross: 2000 }],
    false,
    {},
    { payFrequency: 'Weekly' },
  );
  const [backfilledStub] = buildPreparedPaystubPages(
    [{ periodEnd: '2026-03-06', gross: 2000 }],
    false,
    {},
    { payFrequency: 'Weekly', calendarYtdBackfill: true },
  );

  assert.equal(defaultStub.ytdGross, 2000);
  assert.ok(backfilledStub.ytdGross > defaultStub.ytdGross);
});

test('weekly 1099 calendar YTD extrapolates only uniform gross amounts', () => {
  const uniform = buildPreparedPaystubPages(
    [
      { periodEnd: '2026-01-16', gross: 1000 },
      { periodEnd: '2026-01-23', gross: 1000 },
    ],
    true,
    {},
    { payFrequency: 'Weekly', calendarYtdBackfill: true },
  );
  const varying = buildPreparedPaystubPages(
    [
      { periodEnd: '2026-03-06', gross: 1000 },
      { periodEnd: '2026-03-13', gross: 2000 },
    ],
    true,
    {},
    { payFrequency: 'Weekly', calendarYtdBackfill: true },
  );

  assert.equal(uniform[0].ytdGross, 3000);
  assert.equal(uniform[1].ytdGross, 4000);
  assert.equal(varying[0].ytdGross, 1000);
  assert.equal(varying[1].ytdGross, 3000);
});
