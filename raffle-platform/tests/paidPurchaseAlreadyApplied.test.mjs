import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

/**
 * Loads paidPurchaseAlreadyApplied_ from Code.gs. The webhook treats a true
 * result as "this Stripe checkout was already written," so a bad match skips
 * tickets and a missed match writes them again. Code.gs is not an ES module,
 * and open PRs already edit it, so the test runs the function in place.
 */
const codePath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '../google-apps-script/Code.gs',
);
const source = fs.readFileSync(codePath, 'utf8');

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
  return source.slice(start, end + 1);
}

const loaded = new Function(`
  var SHEET_ENTRIES = 'Entries';
  var currentSpreadsheet = null;
  function getSpreadsheet_() { return currentSpreadsheet; }
  ${sliceFunction('getEntriesExtrasColumnIndex_')}
  ${sliceFunction('parseEntryExtrasJson_')}
  ${sliceFunction('paidPurchaseAlreadyApplied_')}
  return {
    paidPurchaseAlreadyApplied: paidPurchaseAlreadyApplied_,
    useSpreadsheet: function (ss) { currentSpreadsheet = ss; },
  };
`)();

const { paidPurchaseAlreadyApplied, useSpreadsheet } = loaded;

const STANDARD_HEADERS = [
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

function entryRow(slug, extras, extraCells = []) {
  return [
    '2026-08-01T15:00:00.000Z',
    slug,
    'Ada Lovelace',
    '5551234567',
    'ada@example.com',
    'grand-prize',
    'FALSE',
    'FALSE',
    'FALSE',
    4,
    'FALSE',
    '203.0.113.8',
    'stripe-webhook',
    typeof extras === 'string' ? extras : JSON.stringify(extras),
    ...extraCells,
  ];
}

function entriesSheet({ headers = STANDARD_HEADERS, rows = [], lastRow } = {}) {
  const sheet = {
    names: [],
    getLastRow() {
      return lastRow ?? (rows.length > 0 ? rows.length + 1 : 1);
    },
    getLastColumn() {
      return headers.length;
    },
    getRange(row) {
      return {
        getValues() {
          if (row === 1) return [headers];
          return rows;
        },
      };
    },
  };
  useSpreadsheet({
    getSheetByName(name) {
      sheet.names.push(name);
      return sheet;
    },
  });
  return sheet;
}

describe('paidPurchaseAlreadyApplied_', () => {
  it('does not treat a blank checkout as already applied when the row has no session', () => {
    entriesSheet({
      rows: [entryRow('spring', { __paid: true, __paidTickets: 4 })],
    });
    assert.equal(paidPurchaseAlreadyApplied('spring', ''), false);
  });

  it('returns false when Entries is missing or has no data rows', () => {
    useSpreadsheet({
      getSheetByName() {
        return null;
      },
    });
    assert.equal(paidPurchaseAlreadyApplied('spring', 'cs_live_123'), false);

    entriesSheet({ rows: [], lastRow: 1 });
    assert.equal(paidPurchaseAlreadyApplied('spring', 'cs_live_123'), false);
  });

  it('matches the trimmed event slug and keeps scanning past other sessions', () => {
    const sheet = entriesSheet({
      rows: [
        entryRow('spring', { __stripeSessionId: 'cs_other' }),
        entryRow('other-event', { __stripeSessionId: 'cs_live_123' }),
        entryRow('  spring  ', { __stripeSessionId: 'cs_live_123', __paidTickets: 4 }),
      ],
    });

    assert.equal(paidPurchaseAlreadyApplied('spring', 'cs_live_123'), true);
    assert.ok(sheet.names.length > 0);
    assert.ok(sheet.names.every((name) => name === 'Entries'));
    assert.equal(paidPurchaseAlreadyApplied('  spring  ', 'cs_live_123'), true);
    assert.equal(paidPurchaseAlreadyApplied('spring', 'cs_other'), true);
    assert.equal(paidPurchaseAlreadyApplied('other-event', 'cs_live_123'), true);
    assert.equal(paidPurchaseAlreadyApplied('spring', 'cs_missing'), false);
    assert.equal(paidPurchaseAlreadyApplied('Spring', 'cs_live_123'), false);
  });

  it('reads __stripeSessionId from the extrasJson column, not a fixed index', () => {
    const headers = STANDARD_HEADERS.slice(0, -1).concat(['decoy', 'extrasJson']);
    const decoy = JSON.stringify({ __stripeSessionId: 'cs_decoy' });
    const real = JSON.stringify({ __stripeSessionId: 'cs_live_123', __paid: true, __paidTickets: 4 });
    const row = entryRow('spring', '{}');
    row[13] = decoy;
    row[14] = real;
    entriesSheet({ headers, rows: [row] });

    assert.equal(paidPurchaseAlreadyApplied('spring', 'cs_live_123'), true);
    assert.equal(paidPurchaseAlreadyApplied('spring', 'cs_decoy'), false);
  });

  it('still counts a refunded checkout so the same session cannot be granted again', () => {
    entriesSheet({
      rows: [
        entryRow('spring', {
          __stripeSessionId: 'cs_live_refunded',
          __paidTickets: 4,
          __refunded: true,
          __refundId: 're_123',
        }),
      ],
    });
    assert.equal(paidPurchaseAlreadyApplied('spring', 'cs_live_refunded'), true);
  });

  it('skips a broken extras cell and still finds a later session', () => {
    entriesSheet({
      rows: [
        entryRow('spring', '{'),
        entryRow('spring', { __stripeSessionId: 'cs_live_123' }),
      ],
    });
    assert.equal(paidPurchaseAlreadyApplied('spring', 'cs_live_123'), true);

    entriesSheet({ rows: [entryRow('spring', '{')] });
    assert.equal(paidPurchaseAlreadyApplied('spring', 'cs_live_123'), false);
  });
});
