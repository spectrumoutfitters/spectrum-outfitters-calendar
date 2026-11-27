import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

/**
 * Loads handleRefundPaidPurchase_ from Code.gs. This is the step that zeros
 * ticket counts after a Stripe refund. A missed row leaves refunded tickets in
 * the draw; a wide match zeros the wrong purchase. Code.gs is not an ES module,
 * and open PRs already edit it, so the test runs the function in place.
 */
const codePath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '../google-apps-script/Code.gs',
);
const source = fs.readFileSync(codePath, 'utf8');
const REFUNDED_AT = '2026-11-27T05:02:33.000Z';

function endOfFunction(text, openBrace) {
  let depth = 0;
  let state = 'code';
  for (let i = openBrace; i < text.length; i++) {
    const c = text[i];
    const next = text[i + 1];
    if (state === 'line') {
      if (c === '\n') state = 'code';
      continue;
    }
    if (state === 'block') {
      if (c === '*' && next === '/') {
        state = 'code';
        i += 1;
      }
      continue;
    }
    if (state === 'sq' || state === 'dq') {
      if (c === '\\') {
        i += 1;
        continue;
      }
      if ((state === 'sq' && c === "'") || (state === 'dq' && c === '"')) state = 'code';
      continue;
    }
    if (c === '/' && next === '/') {
      state = 'line';
      i += 1;
      continue;
    }
    if (c === '/' && next === '*') {
      state = 'block';
      i += 1;
      continue;
    }
    if (c === "'") {
      state = 'sq';
      continue;
    }
    if (c === '"') {
      state = 'dq';
      continue;
    }
    if (c === '{') depth += 1;
    else if (c === '}') {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  throw new Error('unterminated function body');
}

function sliceFunction(name) {
  const marker = `function ${name}(`;
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, `Code.gs is missing ${name}`);
  assert.equal(source.indexOf(marker, start + marker.length), -1, `Code.gs defines ${name} twice`);
  const open = source.indexOf('{', start);
  const end = endOfFunction(source, open);
  const slice = source.slice(start, end + 1);
  assert.match(slice, new RegExp(`function ${name}\\(`));
  return slice;
}

const refundSlice = sliceFunction('handleRefundPaidPurchase_');
assert.match(refundSlice, /__refunded === true/);
assert.match(refundSlice, /setValue\(0\)/);
assert.match(refundSlice, /ticketsRefunded/);

const loaded = new Function(
  'fixedNow',
  [
    'var SHEET_ENTRIES = "Entries";',
    'var currentSpreadsheet = null;',
    'var adminOk = true;',
    'var stats = { reads: 0, adminCalls: [] };',
    'function Date() {',
    '  return { toISOString: function () { return fixedNow; } };',
    '}',
    'function jsonResponse(obj, status) {',
    '  return { body: obj, status: status || 200 };',
    '}',
    'function getSpreadsheet_() {',
    '  stats.reads += 1;',
    '  return currentSpreadsheet;',
    '}',
    'function validateAdminKey_(slug, adminKey) {',
    '  stats.adminCalls.push({ slug: slug, adminKey: adminKey });',
    '  return adminOk;',
    '}',
    sliceFunction('getEntriesExtrasColumnIndex_'),
    sliceFunction('parseEntryExtrasJson_'),
    refundSlice,
    'return {',
    '  refund: handleRefundPaidPurchase_,',
    '  useSpreadsheet: function (ss) { currentSpreadsheet = ss; },',
    '  setAdminOk: function (ok) { adminOk = ok; },',
    '  stats: stats,',
    '  reset: function () {',
    '    adminOk = true;',
    '    stats.reads = 0;',
    '    stats.adminCalls.length = 0;',
    '    currentSpreadsheet = null;',
    '  },',
    '};',
  ].join('\n'),
)(REFUNDED_AT);

const { refund, useSpreadsheet, setAdminOk, stats, reset } = loaded;

const HEADERS = [
  'timestamp',
  'slug',
  'name',
  'phone',
  'email',
  'raffleId',
  'bonusInstagram',
  'bonusReview',
  'bonusReferral',
  'totalEntries',
  'isTest',
  'ip',
  'userAgent',
  'extrasJson',
];

function entryRow({
  slug = 'spring',
  pool = 'grand',
  tickets = 4,
  sessionId = 'cs_1',
  cents = 2500,
  currency = 'usd',
  refunded = false,
  broken = false,
}) {
  const extras = {
    __stripeSessionId: sessionId,
    __paidAmountCents: cents,
    __paidCurrency: currency,
    __entryToken: 'tok',
  };
  if (refunded) {
    extras.__refunded = true;
    extras.__refundedAt = '2026-01-01T00:00:00.000Z';
    extras.__refundId = 're_old';
  }
  return [
    '2026-08-01T15:00:00.000Z',
    slug,
    'Ada Lovelace',
    '5551234567',
    'ada@example.com',
    pool,
    'FALSE',
    'FALSE',
    'FALSE',
    tickets,
    'FALSE',
    '203.0.113.8',
    'stripe-webhook',
    broken ? '{' : JSON.stringify(extras),
  ];
}

function entriesSheet(rows, { lastRow } = {}) {
  const writes = [];
  const sheet = {
    getLastRow() {
      return lastRow ?? (rows.length > 0 ? rows.length + 1 : 1);
    },
    getLastColumn() {
      return HEADERS.length;
    },
    getRange(row, col) {
      return {
        getValues() {
          if (row === 1) return [HEADERS];
          return rows;
        },
        setValue(value) {
          writes.push({ row, col, value });
        },
      };
    },
  };
  useSpreadsheet({
    getSheetByName() {
      return sheet;
    },
  });
  return writes;
}

function refundRequest(overrides = {}) {
  return {
    slug: 'spring',
    adminKey: 'secret',
    stripeSessionId: 'cs_1',
    refundId: 're_123',
    actor: 'admin_panel',
    ...overrides,
  };
}

describe('handleRefundPaidPurchase_', { concurrency: 1 }, () => {
  it('rejects a missing event or session before checking the admin key', () => {
    reset();
    for (const data of [
      {},
      { slug: '   ', stripeSessionId: 'cs_1', adminKey: 'secret' },
      { slug: 'spring', stripeSessionId: '   ', adminKey: 'secret' },
    ]) {
      reset();
      const result = refund(data);
      assert.equal(result.status, 400);
      assert.deepEqual(result.body, { ok: false, error: 'missing_fields' });
      assert.deepEqual(stats.adminCalls, []);
      assert.equal(stats.reads, 0);
    }
  });

  it('does not read entries when the admin key is rejected', () => {
    reset();
    setAdminOk(false);
    entriesSheet([entryRow({})]);
    const result = refund(refundRequest());
    assert.equal(result.status, 401);
    assert.deepEqual(result.body, { ok: false, error: 'unauthorized' });
    assert.deepEqual(stats.adminCalls, [{ slug: 'spring', adminKey: 'secret' }]);
    assert.equal(stats.reads, 0);
  });

  it('reports no entries when the sheet is missing or has no data rows', () => {
    reset();
    useSpreadsheet({
      getSheetByName() {
        return null;
      },
    });
    const missing = refund(refundRequest());
    assert.equal(missing.status, 404);
    assert.deepEqual(missing.body, { ok: false, error: 'no_entries' });

    reset();
    const writes = entriesSheet([], { lastRow: 1 });
    const empty = refund(refundRequest());
    assert.equal(empty.status, 404);
    assert.deepEqual(empty.body, { ok: false, error: 'no_entries' });
    assert.deepEqual(writes, []);
  });

  it('zeros only the paid rows for that session and sums floored amounts', () => {
    reset();
    const rows = [
      entryRow({ pool: 'grand', tickets: 4, cents: 2500.9, currency: 'usd' }),
      entryRow({ slug: 'other-event', pool: 'daily', tickets: 9, cents: 100, currency: 'eur' }),
      entryRow({ pool: 'night', tickets: 3, sessionId: 'cs_other', cents: 500, currency: 'usd' }),
      entryRow({ pool: 'daily', tickets: 2, cents: 0, currency: 'gbp' }),
      entryRow({ broken: true, pool: 'bad', tickets: 8, cents: 900 }),
      entryRow({ slug: '  spring  ', pool: 'night', tickets: 1, cents: 1500, currency: 'usd' }),
    ];
    const writes = entriesSheet(rows);
    const result = refund(refundRequest({ slug: '  spring  ' }));

    assert.equal(result.status, 200);
    assert.deepEqual(result.body, {
      ok: true,
      rowsChanged: 3,
      ticketsRefunded: 7,
      amountCents: 4000,
      currency: 'usd',
      poolsAffected: ['grand', 'daily', 'night'],
      alreadyRefunded: false,
    });
    assert.deepEqual(
      writes.map((write) => ({
        row: write.row,
        col: write.col,
        value: write.col === 10 ? write.value : JSON.parse(write.value),
      })),
      [
        { row: 2, col: 10, value: 0 },
        {
          row: 2,
          col: 14,
          value: {
            __stripeSessionId: 'cs_1',
            __paidAmountCents: 2500.9,
            __paidCurrency: 'usd',
            __entryToken: 'tok',
            __refunded: true,
            __refundedAt: REFUNDED_AT,
            __refundId: 're_123',
            __refundedBy: 'admin_panel',
          },
        },
        { row: 5, col: 10, value: 0 },
        {
          row: 5,
          col: 14,
          value: {
            __stripeSessionId: 'cs_1',
            __paidAmountCents: 0,
            __paidCurrency: 'gbp',
            __entryToken: 'tok',
            __refunded: true,
            __refundedAt: REFUNDED_AT,
            __refundId: 're_123',
            __refundedBy: 'admin_panel',
          },
        },
        { row: 7, col: 10, value: 0 },
        {
          row: 7,
          col: 14,
          value: {
            __stripeSessionId: 'cs_1',
            __paidAmountCents: 1500,
            __paidCurrency: 'usd',
            __entryToken: 'tok',
            __refunded: true,
            __refundedAt: REFUNDED_AT,
            __refundId: 're_123',
            __refundedBy: 'admin_panel',
          },
        },
      ],
    );
  });

  it('skips rows already marked refunded and still zeros a sibling from the same checkout', () => {
    reset();
    const writes = entriesSheet([
      entryRow({ pool: 'grand', tickets: 5, cents: 2000, refunded: true }),
      entryRow({ pool: 'daily', tickets: 2, cents: 800, currency: 'eur' }),
    ]);
    const result = refund(refundRequest());
    assert.equal(result.status, 200);
    assert.deepEqual(result.body, {
      ok: true,
      rowsChanged: 1,
      ticketsRefunded: 2,
      amountCents: 800,
      currency: 'eur',
      poolsAffected: ['daily'],
      alreadyRefunded: false,
    });
    assert.deepEqual(writes.map((write) => write.row), [3, 3]);
    assert.equal(writes[0].value, 0);

    reset();
    const again = entriesSheet([
      entryRow({ refunded: true, tickets: 5, cents: 2000 }),
      entryRow({ pool: 'daily', refunded: true, tickets: 2, cents: 800 }),
    ]);
    const second = refund(refundRequest());
    assert.deepEqual(second.body, {
      ok: true,
      rowsChanged: 0,
      ticketsRefunded: 0,
      amountCents: 0,
      currency: '',
      poolsAffected: [],
      alreadyRefunded: true,
    });
    assert.deepEqual(again, []);
  });

  it('omits a blank Stripe refund id and records the default actor', () => {
    reset();
    const writes = entriesSheet([entryRow({ cents: 1000 })]);
    const result = refund(refundRequest({ refundId: '', actor: undefined }));
    assert.equal(result.body.rowsChanged, 1);
    const extras = JSON.parse(writes[1].value);
    assert.equal(extras.__refunded, true);
    assert.equal(extras.__refundedAt, REFUNDED_AT);
    assert.equal(Object.hasOwn(extras, '__refundId'), false);
    assert.equal(extras.__refundedBy, 'admin');
  });

  it('does not zero unrelated rows when the session is not on the sheet', () => {
    reset();
    const writes = entriesSheet([
      entryRow({ sessionId: 'cs_other', tickets: 6, cents: 3000 }),
      entryRow({ slug: 'other-event', sessionId: 'cs_1', tickets: 6, cents: 3000 }),
    ]);
    const result = refund(refundRequest());
    assert.equal(result.status, 200);
    assert.equal(result.body.ok, true);
    assert.equal(result.body.rowsChanged, 0);
    assert.equal(result.body.ticketsRefunded, 0);
    assert.equal(result.body.amountCents, 0);
    assert.deepEqual(result.body.poolsAffected, []);
    assert.deepEqual(writes, []);
  });
});
