import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

/**
 * Entry readers in Code.gs address phone, pool, ticket count, and test-mode by
 * fixed column numbers, and paid/refund metadata by getEntriesExtrasColumnIndex_.
 * The workbook seed in CreateSpreadsheet.gs is the column contract for a new
 * sheet. These tests load both sources without editing them.
 */
const here = path.dirname(fileURLToPath(import.meta.url));
const codeSource = fs.readFileSync(path.join(here, '../google-apps-script/Code.gs'), 'utf8');
const sheetSource = fs.readFileSync(
  path.join(here, '../google-apps-script/CreateSpreadsheet.gs'),
  'utf8',
);

function endOfDelimited(text, openIndex, openCh, closeCh) {
  let depth = 0;
  let state = 'code';
  for (let i = openIndex; i < text.length; i++) {
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
    if (c === openCh) depth += 1;
    else if (c === closeCh) {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  throw new Error(`unterminated ${openCh}`);
}

function sliceOnce(source, marker, label) {
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, `${label} is missing ${marker}`);
  assert.equal(source.indexOf(marker, start + marker.length), -1, `${label} defines ${marker} twice`);
  return start;
}

function sliceFunction(source, name, label) {
  const start = sliceOnce(source, `function ${name}(`, label);
  const open = source.indexOf('{', start);
  const end = endOfDelimited(source, open, '{', '}');
  return source.slice(start, end + 1);
}

function sliceAssignment(source, name, label) {
  const marker = `var ${name} = `;
  const start = sliceOnce(source, marker, label);
  let i = start + marker.length;
  while (i < source.length && source[i] !== '[' && source[i] !== "'" && source[i] !== '"') i += 1;
  const open = source[i];
  const end = open === '['
    ? endOfDelimited(source, i, '[', ']')
    : (() => {
      const quote = open;
      let j = i + 1;
      while (j < source.length) {
        if (source[j] === '\\') {
          j += 2;
          continue;
        }
        if (source[j] === quote) return j;
        j += 1;
      }
      throw new Error(`unterminated string for ${name}`);
    })();
  let semi = end + 1;
  while (semi < source.length && /\s/.test(source[semi])) semi += 1;
  assert.equal(source[semi], ';', `${name} assignment is missing a semicolon`);
  return source.slice(start, semi + 1);
}

function loadWorkbookSeed(SpreadsheetApp) {
  const body = [
    sliceAssignment(sheetSource, 'EVENT_HEADERS', 'CreateSpreadsheet.gs'),
    sliceAssignment(sheetSource, 'RAFFLE_HEADERS', 'CreateSpreadsheet.gs'),
    sliceAssignment(sheetSource, 'ENTRY_HEADERS', 'CreateSpreadsheet.gs'),
    sliceAssignment(sheetSource, 'WINNER_HEADERS', 'CreateSpreadsheet.gs'),
    sliceFunction(sheetSource, 'clearSheetContent_', 'CreateSpreadsheet.gs'),
    sliceFunction(sheetSource, 'columnIndexToLetter1_', 'CreateSpreadsheet.gs'),
    sliceFunction(sheetSource, 'setValuesBlock_', 'CreateSpreadsheet.gs'),
    sliceFunction(sheetSource, 'formatHeaderRow_', 'CreateSpreadsheet.gs'),
    sliceFunction(sheetSource, 'writeHeadersAndSamples_', 'CreateSpreadsheet.gs'),
    sliceFunction(sheetSource, 'installRaffleStructureInActiveSpreadsheet', 'CreateSpreadsheet.gs'),
    'return { writeHeadersAndSamples: writeHeadersAndSamples_, install: installRaffleStructureInActiveSpreadsheet };',
  ].join('\n');
  return new Function('SpreadsheetApp', body)(SpreadsheetApp);
}

const loadExtrasLookup = new Function(
  'getSpreadsheet_',
  [
    sliceAssignment(codeSource, 'SHEET_ENTRIES', 'Code.gs'),
    sliceFunction(codeSource, 'getEntriesExtrasColumnIndex_', 'Code.gs'),
    'return getEntriesExtrasColumnIndex_;',
  ].join('\n'),
);

function makeSheet(name, { lastRow = 0, lastColumn = 0, a2 = '' } = {}) {
  const sheet = {
    name,
    ops: [],
    frozen: null,
    getLastRow() {
      return lastRow;
    },
    getLastColumn() {
      return lastColumn;
    },
    setName(next) {
      sheet.name = next;
    },
    setFrozenRows(count) {
      sheet.frozen = count;
    },
    getRange(...args) {
      const op = { args };
      sheet.ops.push(op);
      return {
        clearContent() {
          op.kind = 'clear';
        },
        setValues(rows) {
          op.kind = 'values';
          op.rows = rows;
        },
        setFontWeight() {},
        setBackground() {},
        setFontColor() {},
        getValue() {
          return args[0] === 'A2' ? a2 : '';
        },
      };
    },
  };
  return sheet;
}

function freshWorkbook() {
  const sheets = {
    Events: makeSheet('Events'),
    Raffles: makeSheet('Raffles'),
    Entries: makeSheet('Entries'),
    Winners: makeSheet('Winners'),
  };
  return {
    sheets,
    getSheetByName(name) {
      return sheets[name];
    },
  };
}

function valueBlocks(sheet) {
  return sheet.ops.filter((op) => op.kind === 'values').map((op) => op.rows);
}

function rowObject(headers, row) {
  const out = {};
  headers.forEach((header, index) => {
    out[header] = row[index];
  });
  return out;
}

function lookupExtras(sheet) {
  const names = [];
  const getSpreadsheet_ = () => ({
    getSheetByName(name) {
      names.push(name);
      return sheet;
    },
  });
  const index = loadExtrasLookup(getSpreadsheet_)();
  return { index, names };
}

function headerSheet(headers) {
  const calls = [];
  return {
    calls,
    getLastColumn() {
      return headers.length;
    },
    getRange(row, col, numRows, numCols) {
      calls.push({ row, col, numRows, numCols });
      return {
        getValues() {
          return [headers];
        },
      };
    },
  };
}

describe('raffle workbook seed column contract', () => {
  const { writeHeadersAndSamples } = loadWorkbookSeed(undefined);
  const workbook = freshWorkbook();
  writeHeadersAndSamples(workbook);
  const entryHeaders = valueBlocks(workbook.sheets.Entries)[0][0];
  const eventHeaders = valueBlocks(workbook.sheets.Events)[0][0];
  const eventSample = valueBlocks(workbook.sheets.Events)[1][0];
  const event = rowObject(eventHeaders, eventSample);
  const raffleHeaders = valueBlocks(workbook.sheets.Raffles)[0][0];
  const raffleRows = valueBlocks(workbook.sheets.Raffles)[1];
  const winnerHeaders = valueBlocks(workbook.sheets.Winners)[0][0];

  it('keeps the entry columns that draw, stats, and paid-ticket readers index directly', () => {
    assert.deepEqual(valueBlocks(workbook.sheets.Entries), [[entryHeaders]]);
    assert.equal(entryHeaders[1], 'slug');
    assert.equal(entryHeaders[2], 'name');
    assert.equal(entryHeaders[3], 'phone');
    assert.equal(entryHeaders[4], 'email');
    assert.equal(entryHeaders[5], 'raffleId');
    assert.equal(entryHeaders[9], 'totalEntries');
    assert.equal(entryHeaders[10], 'isTest');
    assert.equal(entryHeaders.indexOf('extrasJson'), 13);
    assert.equal(entryHeaders.length, 14);
    assert.equal(workbook.sheets.Entries.frozen, 1);
  });

  it('seeds paid-ticket and newsletter defaults the public event read understands', () => {
    assert.equal(event.slug, 'grand-opening');
    assert.equal(event.theme, 'dark');
    assert.equal(event.active, true);
    assert.equal(event.defaultTestMode, false);
    assert.equal(event.blockTestWrite, false);
    assert.equal(event.bonusRulesJson, '');
    assert.equal(event.adminKey, 'CHANGE_THIS_SECRET_KEY');
    assert.equal(event.paidTicketsEnabled, false);
    assert.equal(event.ticketPriceCents, 500);
    assert.equal(event.ticketCurrency, 'usd');
    assert.equal(event.paidTicketsMaxPerPurchase, 100);
    assert.equal(event.baseTicketsPerEntry, 2);
    assert.equal(event.newsletterBonusEnabled, true);
    assert.equal(event.newsletterBonusTickets, 2);
    assert.equal(eventHeaders.length, eventSample.length);
    assert.equal(workbook.sheets.Events.frozen, 1);
  });

  it('seeds three active grand-opening pools with no draw time', () => {
    const pools = raffleRows.map((row) => rowObject(raffleHeaders, row));
    assert.deepEqual(pools.map((pool) => pool.raffleId), ['grand-prize', 'runner-up', 'door-prize']);
    assert.deepEqual(pools.map((pool) => pool.sortOrder), [1, 2, 3]);
    assert.deepEqual(pools.map((pool) => pool.slug), ['grand-opening', 'grand-opening', 'grand-opening']);
    assert.deepEqual(pools.map((pool) => pool.active), [true, true, true]);
    assert.deepEqual(pools.map((pool) => pool.drawAt), ['', '', '']);
    assert.ok(pools.every((pool) => pool.title && pool.valueLabel));
    assert.equal(workbook.sheets.Raffles.frozen, 1);
  });

  it('names the winner columns the public feed reads when the header row is present', () => {
    assert.deepEqual(winnerHeaders, [
      'drawId',
      'timestamp',
      'slug',
      'raffleId',
      'winnerName',
      'winnerPhone',
      'winnerEmail',
      'ticketsInPool',
      'isTest',
    ]);
    assert.equal(workbook.sheets.Winners.frozen, 1);
  });
});

describe('getEntriesExtrasColumnIndex_', () => {
  const { writeHeadersAndSamples } = loadWorkbookSeed(undefined);
  const workbook = freshWorkbook();
  writeHeadersAndSamples(workbook);
  const seededHeaders = valueBlocks(workbook.sheets.Entries)[0][0];

  it('uses the Entries tab and treats a missing tab as the seeded extras column', () => {
    const missing = lookupExtras(null);
    assert.deepEqual(missing.names, ['Entries']);
    assert.equal(missing.index, seededHeaders.indexOf('extrasJson'));
    assert.equal(missing.index, 13);
  });

  it('returns the extrasJson column even when it is not the last header', () => {
    const headers = seededHeaders.concat(['note']);
    const sheet = headerSheet(headers);
    const found = lookupExtras(sheet);
    assert.equal(found.index, 13);
    assert.deepEqual(sheet.calls, [{ row: 1, col: 1, numRows: 1, numCols: headers.length }]);
  });

  it('trims the header, keeps the first match, and falls back to the last column otherwise', () => {
    assert.equal(lookupExtras(headerSheet([' extrasJson ', 'later'])).index, 0);
    assert.equal(lookupExtras(headerSheet(['slug', 'extrasJson', 'extrasJson'])).index, 1);
    assert.equal(lookupExtras(headerSheet(['ExtrasJson', 'note'])).index, 1);
    assert.equal(lookupExtras(headerSheet(['timestamp', 'slug', null])).index, 2);
    assert.equal(lookupExtras(headerSheet([])).index, 0);
  });
});

describe('installRaffleStructureInActiveSpreadsheet', () => {
  function installOn(events) {
    const sheets = { Events: events };
    const inserted = [];
    const alerts = [];
    const ss = {
      getSheetByName(name) {
        return sheets[name] || null;
      },
      getSheets() {
        return [sheets.Events];
      },
      insertSheet(name) {
        inserted.push(name);
        sheets[name] = makeSheet(name);
        return sheets[name];
      },
    };
    const SpreadsheetApp = {
      getActiveSpreadsheet() {
        return ss;
      },
      getUi() {
        return {
          alert(message) {
            alerts.push(String(message));
          },
        };
      },
    };
    loadWorkbookSeed(SpreadsheetApp).install();
    return { inserted, alerts, sheets };
  }

  it('refuses to replace a sheet that already has a slug, including surrounding spaces', () => {
    const events = makeSheet('Events', { lastRow: 2, lastColumn: 4, a2: ' grand-opening ' });
    const { inserted, alerts, sheets } = installOn(events);
    assert.deepEqual(inserted, []);
    assert.equal(alerts.length, 1);
    assert.match(alerts[0], /^Aborted: Events already has a slug/);
    assert.equal(sheets.Events.ops.some((op) => op.kind === 'values'), false);
  });

  it('treats a whitespace slug as empty and still creates the other tabs', () => {
    const events = makeSheet('Events', { lastRow: 2, lastColumn: 0, a2: '   ' });
    const { inserted, alerts, sheets } = installOn(events);
    assert.deepEqual(inserted, ['Raffles', 'Entries', 'Winners']);
    assert.equal(valueBlocks(sheets.Entries)[0][0].indexOf('extrasJson'), 13);
    assert.equal(alerts.length, 1);
    assert.match(alerts[0], /^Raffle structure installed/);
    assert.equal(alerts.some((message) => message.startsWith('Aborted:')), false);
  });
});
