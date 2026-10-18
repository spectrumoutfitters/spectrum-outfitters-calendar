import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

/**
 * Executes the raffle sheet writers from Code.gs. The script is not edited:
 * open bugfix PRs already change it. Save-config tests stub these writers, so
 * a bad replace or cell update would not fail those tests.
 */
const codePath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '../google-apps-script/Code.gs',
);
const source = fs.readFileSync(codePath, 'utf8');

const REAL_FUNCTIONS = [
  'findEventRow_',
  'buildRaffleRowArray_',
  'ensureValueLabelColumn_',
  'ensureDrawAtColumn_',
  'replaceRafflesForSlug_',
  'ensurePaidTicketColumns_',
  'updateEventCellsForSlug_',
];

function previousCodeChar(text, index) {
  for (let j = index - 1; j >= 0; j -= 1) {
    const ch = text[j];
    if (ch !== ' ' && ch !== '\t' && ch !== '\n' && ch !== '\r') return ch;
  }
  return '';
}

function endOfFunction(text, openBrace) {
  let depth = 0;
  let state = 'code';
  for (let i = openBrace; i < text.length; i += 1) {
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
    if (state === 'regex' || state === 'regexClass') {
      if (c === '\\') {
        i += 1;
        continue;
      }
      if (state === 'regex' && c === '[') {
        state = 'regexClass';
        continue;
      }
      if (state === 'regexClass' && c === ']') {
        state = 'regex';
        continue;
      }
      if (state === 'regex' && c === '/') state = 'code';
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
    if (c === '/' && '([{=,:;!&|?+-~*%<>^'.includes(previousCodeChar(text, i))) {
      state = 'regex';
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
  const nextTop = source.indexOf('\nfunction ', start);
  assert.ok(nextTop === -1 || nextTop > end, `scanner swallowed the function after ${name}`);
  return source.slice(start, end + 1);
}

function loadWriters() {
  const store = { events: null, raffles: null };
  const body = [
    'var SHEET_EVENTS = "Events";',
    'var SHEET_RAFFLES = "Raffles";',
    'function makeSheet(bag) {',
    '  function setCell(row1, col1, value) {',
    '    while (bag.rows.length < row1) bag.rows.push([]);',
    '    var row = bag.rows[row1 - 1];',
    '    while (row.length < col1 - 1) row.push("");',
    '    row[col1 - 1] = value;',
    '    if (col1 > bag.width) bag.width = col1;',
    '  }',
    '  function getCell(row1, col1) {',
    '    var row = bag.rows[row1 - 1];',
    '    if (!row || col1 < 1 || col1 - 1 >= row.length) return "";',
    '    var value = row[col1 - 1];',
    '    return value == null ? "" : value;',
    '  }',
    '  return {',
    '    getLastColumn: function () { return bag.width; },',
    '    getLastRow: function () { return bag.rows.length; },',
    '    getDataRange: function () {',
    '      return {',
    '        getValues: function () {',
    '          var out = [];',
    '          for (var r = 0; r < bag.rows.length; r++) {',
    '            var line = bag.rows[r].slice();',
    '            while (line.length < bag.width) line.push("");',
    '            out.push(line);',
    '          }',
    '          return out;',
    '        },',
    '      };',
    '    },',
    '    getRange: function (row1, col1, numRows, numCols) {',
    '      if (numRows == null) {',
    '        return { setValue: function (value) { setCell(row1, col1, value); } };',
    '      }',
    '      return {',
    '        getValues: function () {',
    '          var out = [];',
    '          for (var r = 0; r < numRows; r++) {',
    '            var line = [];',
    '            for (var c = 0; c < numCols; c++) line.push(getCell(row1 + r, col1 + c));',
    '            out.push(line);',
    '          }',
    '          return out;',
    '        },',
    '      };',
    '    },',
    '    insertColumnAfter: function (afterPos) {',
    '      for (var r = 0; r < bag.rows.length; r++) {',
    '        var row = bag.rows[r];',
    '        while (row.length < afterPos) row.push("");',
    '        row.splice(afterPos, 0, "");',
    '      }',
    '      bag.width += 1;',
    '    },',
    '    deleteRow: function (row1) {',
    '      bag.deletes.push(row1);',
    '      bag.rows.splice(row1 - 1, 1);',
    '    },',
    '    appendRow: function (row) {',
    '      var copy = row.slice();',
    '      bag.appends.push(copy);',
    '      bag.rows.push(copy);',
    '      if (copy.length > bag.width) bag.width = copy.length;',
    '    },',
    '  };',
    '}',
    'function getSpreadsheet_() {',
    '  return {',
    '    getSheetByName: function (name) {',
    '      if (name === "Events") return store.events ? makeSheet(store.events) : null;',
    '      if (name === "Raffles") return store.raffles ? makeSheet(store.raffles) : null;',
    '      return null;',
    '    },',
    '  };',
    '}',
    ...REAL_FUNCTIONS.map((name) => sliceFunction(name)),
    'return {',
    '  store: store,',
    '  buildRaffleRowArray_: buildRaffleRowArray_,',
    '  replaceRafflesForSlug_: replaceRafflesForSlug_,',
    '  updateEventCellsForSlug_: updateEventCellsForSlug_,',
    '};',
  ].join('\n');
  return new Function('store', body)(store);
}

function sheet(rows) {
  const copied = rows.map((row) => row.slice());
  const width = copied.reduce((max, row) => Math.max(max, row.length), 0);
  return { rows: copied, width, deletes: [], appends: [] };
}

function pad(row, width) {
  const line = row.slice();
  while (line.length < width) line.push('');
  return line;
}

const api = loadWriters();

describe('buildRaffleRowArray_', () => {
  it('maps known columns and blanks anything else', () => {
    const headers = [
      'slug',
      'raffleId',
      'title',
      'subtitle',
      'imageUrl',
      'valueLabel',
      'sortOrder',
      'active',
      'drawAt',
      'notes',
    ];
    const row = api.buildRaffleRowArray_(headers, ' grand-opening ', {
      id: 'from-id',
      title: '  New Prize  ',
      subtitle: '  spaced  ',
      imageUrl: ' https://cdn.example/p.png ',
      valueLabel: 'V'.repeat(161),
      sortOrder: -3,
      active: 'false',
      drawAt: 'D'.repeat(51),
      notes: 'ignored',
    });
    assert.deepEqual(row, [
      ' grand-opening ',
      'from-id',
      'New Prize',
      '  spaced  ',
      'https://cdn.example/p.png',
      'V'.repeat(160),
      0,
      'FALSE',
      'D'.repeat(50),
      '',
    ]);
  });

  it('keeps a zero sort order and treats a missing active flag as active', () => {
    const row = api.buildRaffleRowArray_(
      ['raffleId', 'sortOrder', 'active'],
      'grand-opening',
      { raffleId: '  pool  ', sortOrder: 0 },
    );
    assert.deepEqual(row, ['pool', 0, 'TRUE']);
  });
});

describe('replaceRafflesForSlug_', () => {
  it('deletes only the matching event, from the bottom, and appends the new prize row', () => {
    api.store.raffles = sheet([
      ['slug', 'raffleId', 'title', 'subtitle', 'imageUrl', 'sortOrder', 'active'],
      ['other-show', 'keep', 'Keep', 'sub', 'https://example.com/a.png', 7, 'TRUE'],
      [' grand-opening ', 'old-a', 'Old A', '', '', 1, 'TRUE'],
      ['grand-opening', 'old-b', 'Old B', '', '', 2, 'FALSE'],
    ]);

    api.replaceRafflesForSlug_('grand-opening', [
      {
        id: 'new-pool',
        title: '  New Prize  ',
        subtitle: '  spaced  ',
        imageUrl: ' https://cdn.example/p.png ',
        valueLabel: 'V'.repeat(161),
        sortOrder: -3,
        active: false,
        drawAt: 'D'.repeat(51),
      },
    ]);

    const bag = api.store.raffles;
    assert.deepEqual(bag.deletes, [4, 3]);
    assert.deepEqual(bag.rows[0], [
      'slug',
      'raffleId',
      'title',
      'subtitle',
      'imageUrl',
      'valueLabel',
      'sortOrder',
      'active',
      'drawAt',
    ]);
    assert.deepEqual(pad(bag.rows[1], bag.width), [
      'other-show',
      'keep',
      'Keep',
      'sub',
      'https://example.com/a.png',
      '',
      7,
      'TRUE',
      '',
    ]);
    assert.deepEqual(bag.rows[2], [
      'grand-opening',
      'new-pool',
      'New Prize',
      '  spaced  ',
      'https://cdn.example/p.png',
      'V'.repeat(160),
      0,
      'FALSE',
      'D'.repeat(50),
    ]);
    assert.equal(bag.rows.length, 3);
  });

  it('appends valueLabel and drawAt when imageUrl is absent and keeps a fractional sort order', () => {
    api.store.raffles = sheet([
      ['slug', 'raffleId', 'title', 'sortOrder', 'active'],
      ['other-show', 'keep', 'Keep', 4, 'TRUE'],
    ]);

    api.replaceRafflesForSlug_(' grand-opening ', [
      { raffleId: 'pool', title: 'Prize', sortOrder: 2.5, active: 'FALSE' },
    ]);

    const bag = api.store.raffles;
    assert.deepEqual(bag.deletes, []);
    assert.deepEqual(bag.rows[0], [
      'slug',
      'raffleId',
      'title',
      'sortOrder',
      'active',
      'valueLabel',
      'drawAt',
    ]);
    assert.deepEqual(pad(bag.rows[1], bag.width), ['other-show', 'keep', 'Keep', 4, 'TRUE', '', '']);
    assert.deepEqual(bag.rows[2], [' grand-opening ', 'pool', 'Prize', 2.5, 'FALSE', '', '']);
  });

  it('removes every row for the slug when the replacement list is empty', () => {
    api.store.raffles = sheet([
      ['slug', 'raffleId', 'title', 'valueLabel', 'drawAt'],
      ['other-show', 'keep', 'Keep', 'gold', '2026-01-01'],
      ['grand-opening', 'old', 'Old', '', ''],
    ]);

    api.replaceRafflesForSlug_('grand-opening', []);

    const bag = api.store.raffles;
    assert.deepEqual(bag.deletes, [3]);
    assert.equal(bag.appends.length, 0);
    assert.equal(bag.rows.length, 2);
    assert.equal(bag.rows[1][0], 'other-show');
    assert.deepEqual(bag.rows[0], ['slug', 'raffleId', 'title', 'valueLabel', 'drawAt']);
  });

  it('throws before writing when the raffle sheet or slug column is missing', () => {
    api.store.raffles = null;
    assert.throws(() => api.replaceRafflesForSlug_('grand-opening', []), /Missing sheet: Raffles/);

    api.store.raffles = sheet([]);
    assert.throws(() => api.replaceRafflesForSlug_('grand-opening', [{ title: 'Prize' }]), /Raffles sheet is empty/);
    assert.deepEqual(api.store.raffles.rows, []);

    api.store.raffles = sheet([
      ['raffleId', 'title'],
      ['keep', 'Keep'],
    ]);
    assert.throws(
      () => api.replaceRafflesForSlug_('grand-opening', [{ raffleId: 'pool', title: 'Prize' }]),
      /Raffles sheet needs slug column/,
    );
    assert.deepEqual(api.store.raffles.deletes, []);
    assert.deepEqual(api.store.raffles.appends, []);
    assert.deepEqual(api.store.raffles.rows[0], ['raffleId', 'title', 'valueLabel', 'drawAt']);
    assert.deepEqual(pad(api.store.raffles.rows[1], api.store.raffles.width), ['keep', 'Keep', '', '']);
  });
});

describe('updateEventCellsForSlug_', () => {
  it('writes clamped event cells, ignores identity fields, and adds paid columns once', () => {
    api.store.events = sheet([
      ['slug', 'name', 'adminKey', 'description', 'active', 'theme'],
      [' grand-opening ', 'Old', 'secret', 'Desc', 'TRUE', 'dark'],
      ['other-show', 'Other', 'other-secret', 'Keep', 'TRUE', 'light'],
    ]);

    api.updateEventCellsForSlug_('grand-opening', {
      adminKey: 'hacked',
      slug: 'stolen',
      name: 'New Name',
      description: null,
      active: ' FALSE ',
      defaultTestMode: true,
      blockTestWrite: 'TRUE',
      paidTicketsEnabled: 'yes',
      newsletterBonusEnabled: false,
      bonusRulesJson: '{',
      ticketPriceCents: -4,
      paidTicketsMaxPerPurchase: 2.9,
      baseTicketsPerEntry: -5,
      newsletterBonusTickets: '',
      ticketCurrency: ' USDOLLARX ',
      theme: 'blue',
      notAField: 'x',
    });

    const bag = api.store.events;
    assert.deepEqual(bag.rows[0], [
      'slug',
      'name',
      'adminKey',
      'description',
      'active',
      'theme',
      'paidTicketsEnabled',
      'ticketPriceCents',
      'ticketCurrency',
      'paidTicketsMaxPerPurchase',
      'baseTicketsPerEntry',
      'newsletterBonusEnabled',
      'newsletterBonusTickets',
    ]);
    assert.deepEqual(pad(bag.rows[1], bag.width), [
      ' grand-opening ',
      'New Name',
      'secret',
      '',
      'FALSE',
      'blue',
      'FALSE',
      0,
      ' usdolla',
      2,
      1,
      'FALSE',
      0,
    ]);
    assert.deepEqual(pad(bag.rows[2], bag.width), [
      'other-show',
      'Other',
      'other-secret',
      'Keep',
      'TRUE',
      'light',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
    ]);

    const widthAfterFirstSave = bag.width;
    api.updateEventCellsForSlug_('grand-opening', {
      ticketPriceCents: 12.9,
      paidTicketsMaxPerPurchase: 0,
      baseTicketsPerEntry: 0,
      newsletterBonusTickets: -2,
      ticketCurrency: '',
      paidTicketsEnabled: true,
      newsletterBonusEnabled: 'TRUE',
    });
    assert.equal(bag.width, widthAfterFirstSave);
    assert.equal(bag.rows[0].length, widthAfterFirstSave);
    const headers = bag.rows[0];
    const updated = pad(bag.rows[1], bag.width);
    assert.equal(updated[headers.indexOf('ticketPriceCents')], 12);
    assert.equal(updated[headers.indexOf('paidTicketsMaxPerPurchase')], 0);
    assert.equal(updated[headers.indexOf('baseTicketsPerEntry')], 2);
    assert.equal(updated[headers.indexOf('newsletterBonusTickets')], 0);
    assert.equal(updated[headers.indexOf('ticketCurrency')], 'usd');
    assert.equal(updated[headers.indexOf('paidTicketsEnabled')], 'TRUE');
    assert.equal(updated[headers.indexOf('newsletterBonusEnabled')], 'TRUE');
    assert.equal(updated[headers.indexOf('adminKey')], 'secret');
    assert.equal(bag.rows[2][headers.indexOf('name')], 'Other');
  });

  it('stores a fractional base ticket count as its floor and does not invent a name column', () => {
    api.store.events = sheet([
      ['slug', 'ticketPriceCents', 'baseTicketsPerEntry'],
      ['grand-opening', 4, 2],
    ]);

    api.updateEventCellsForSlug_('grand-opening', {
      name: 'Should not create a column',
      baseTicketsPerEntry: 1.9,
      ticketPriceCents: '8',
    });

    assert.deepEqual(api.store.events.rows[0].slice(0, 3), [
      'slug',
      'ticketPriceCents',
      'baseTicketsPerEntry',
    ]);
    assert.equal(api.store.events.rows[0].includes('name'), false);
    assert.equal(api.store.events.rows[1][1], 8);
    assert.equal(api.store.events.rows[1][2], 1);
  });

  it('throws for a missing event or sheet before adding columns', () => {
    api.store.events = sheet([
      ['slug', 'name'],
      ['other-show', 'Other'],
    ]);
    assert.throws(() => api.updateEventCellsForSlug_('grand-opening', { name: 'Nope' }), /event_not_found/);
    assert.deepEqual(api.store.events.rows, [
      ['slug', 'name'],
      ['other-show', 'Other'],
    ]);

    api.store.events = null;
    assert.throws(() => api.updateEventCellsForSlug_('grand-opening', { name: 'Nope' }), /Missing sheet: Events/);
  });
});
