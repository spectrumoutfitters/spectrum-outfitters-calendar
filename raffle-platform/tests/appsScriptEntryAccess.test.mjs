import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { beforeEach, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

/**
 * Executes Apps Script entry export, magic-link reads, submit gates, and
 * manage-entry rewrites in place. Code.gs is not an ES module, and open
 * bugfix PRs already edit it. Sheet writes and bonus-proof parsing are stubbed.
 * Phone normalization, admin-key checks, draw-lock timing, and CSV quoting
 * are the real script helpers.
 */
const codePath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '../google-apps-script/Code.gs',
);
const source = fs.readFileSync(codePath, 'utf8');

function previousCodeChar(text, index) {
  for (let j = index - 1; j >= 0; j--) {
    const ch = text[j];
    if (ch !== ' ' && ch !== '\t' && ch !== '\n' && ch !== '\r') return ch;
  }
  return '';
}

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

function loadEntryAccess() {
  const body = [
    'var SHEET_ENTRIES = "Entries";',
    'var fixture = {',
    '  masterKey: "",',
    '  event: null,',
    '  lookups: 0,',
    '  rateOk: true,',
    '  rateChecks: [],',
    '  existingPhones: [],',
    '  phoneChecks: [],',
    '  proofError: null,',
    '  trimmedProof: {},',
    '  bonuses: [],',
    '  raffles: [],',
    '  rafflesAll: [],',
    '  entriesValues: [],',
    '  entryReads: 0,',
    '  deletedRows: [],',
    '  tokens: 0,',
    '  writes: [],',
    '  updateWrites: [],',
    '};',
    'function jsonResponse(obj, status) {',
    '  return { status: status || 200, body: obj };',
    '}',
    'function getAdminMasterKey_() { return fixture.masterKey || ""; }',
    'function findEventRow_(slug) {',
    '  fixture.lookups += 1;',
    '  var ev = fixture.event;',
    '  if (!ev || String(slug).trim() !== String(ev.slug).trim()) return null;',
    '  return { headers: ev.headers, record: ev.record };',
    '}',
    'function sheetFrom_(values) {',
    '  return {',
    '    getLastRow: function () { return values.length; },',
    '    getLastColumn: function () {',
    '      var max = 0;',
    '      for (var i = 0; i < values.length; i++) max = Math.max(max, values[i].length);',
    '      return max;',
    '    },',
    '    getRange: function (row, column, numRows, numColumns) {',
    '      var out = [];',
    '      for (var r = 0; r < numRows; r++) {',
    '        var src = values[row - 1 + r] || [];',
    '        var line = [];',
    '        for (var c = 0; c < numColumns; c++) {',
    '          var cell = src[column - 1 + c];',
    '          line.push(cell === undefined ? "" : cell);',
    '        }',
    '        out.push(line);',
    '      }',
    '      return { getValues: function () { return out; } };',
    '    },',
    '    deleteRow: function (n) { fixture.deletedRows.push(n); },',
    '  };',
    '}',
    'function getSpreadsheet_() {',
    '  return {',
    '    getSheetByName: function (name) {',
    '      if (name !== SHEET_ENTRIES) return null;',
    '      fixture.entryReads += 1;',
    '      if (!fixture.entriesValues) return null;',
    '      return sheetFrom_(fixture.entriesValues);',
    '    },',
    '  };',
    '}',
    'function getRafflesForSlug_() { return fixture.raffles || []; }',
    'function getRafflesAllForSlug_() { return fixture.rafflesAll || []; }',
    'function rateLimitOk_(ip) {',
    '  fixture.rateChecks.push(String(ip));',
    '  return fixture.rateOk !== false;',
    '}',
    'function phoneExistsForSlug_(slug, phoneNorm) {',
    '  fixture.phoneChecks.push({ slug: slug, phoneNorm: phoneNorm });',
    '  return fixture.existingPhones.indexOf(String(slug) + "|" + String(phoneNorm)) >= 0;',
    '}',
    'function parseBonusRulesFromRow_() { return fixture.bonuses || []; }',
    'function validateBonusProof_() { return fixture.proofError || null; }',
    'function trimBonusProofForSubmit_() { return fixture.trimmedProof || {}; }',
    'function generateEntryToken_() {',
    '  fixture.tokens += 1;',
    '  return "token-fixed";',
    '}',
    'function runEntryWritesAndMaybeEmail_() {',
    '  fixture.writes.push(Array.prototype.slice.call(arguments));',
    '  return jsonResponse({ ok: true, from: "submit-writer" });',
    '}',
    'function runEntryWritesAndMaybeEmailPreservingNewsletter_() {',
    '  fixture.updateWrites.push(Array.prototype.slice.call(arguments));',
    '  return jsonResponse({ ok: true, from: "update-writer" });',
    '}',
    sliceFunction('recordToObject_'),
    sliceFunction('normalizePhone_'),
    sliceFunction('parseEntryExtrasJson_'),
    sliceFunction('maskEmail_'),
    sliceFunction('getBaseTicketsPerEntry_'),
    sliceFunction('getNewsletterBonusTickets_'),
    sliceFunction('isNewsletterBonusEnabled_'),
    sliceFunction('computeTicketsFromBonuses_'),
    sliceFunction('validateAdminKey_'),
    sliceFunction('getEntriesExtrasColumnIndex_'),
    sliceFunction('readEntryRowsByToken_'),
    sliceFunction('readEntriesForSlug_'),
    sliceFunction('getRaffleDrawAtMsMapForSlug_'),
    sliceFunction('entryUpdateLockedForRaffleIds_'),
    sliceFunction('deleteEntrySheetRowsDescending_'),
    sliceFunction('handleExportEntries_'),
    sliceFunction('handleGetEntryByToken_'),
    sliceFunction('handleSubmitEntry_'),
    sliceFunction('handleUpdateEntryByToken_'),
    'return {',
    '  handleExportEntries: handleExportEntries_,',
    '  handleGetEntryByToken: handleGetEntryByToken_,',
    '  handleSubmitEntry: handleSubmitEntry_,',
    '  handleUpdateEntryByToken: handleUpdateEntryByToken_,',
    '  fixture: fixture,',
    '};',
  ].join('\n');
  return new Function(body)();
}

const {
  handleExportEntries,
  handleGetEntryByToken,
  handleSubmitEntry,
  handleUpdateEntryByToken,
  fixture,
} = loadEntryAccess();

const HEADER = [
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

function useEvent(fields) {
  const headers = Object.keys(fields);
  fixture.event = {
    slug: fields.slug,
    headers,
    record: headers.map((header) => fields[header]),
  };
}

function sheetRow(overrides = {}) {
  const extras = overrides.extras || {};
  return [
    overrides.timestamp ?? '',
    overrides.slug ?? 'grand-opening',
    overrides.name ?? 'Pat Lee',
    overrides.phone ?? '5551234567',
    overrides.email ?? 'pat.lee@example.com',
    overrides.raffleId ?? 'wheels',
    'FALSE',
    'FALSE',
    'FALSE',
    overrides.tickets ?? 2,
    'FALSE',
    '1.2.3.4',
    overrides.userAgent ?? 'agent',
    JSON.stringify(extras),
  ];
}

function futureDraw() {
  return '2099-01-01T00:00:00.000Z';
}

function resetPools() {
  fixture.raffles = [{ id: 'wheels', title: 'Wheels', drawAt: futureDraw() }];
  fixture.rafflesAll = [{ id: 'wheels', raffleId: 'wheels', title: 'Wheels', drawAt: futureDraw() }];
}

beforeEach(() => {
  fixture.masterKey = '';
  fixture.lookups = 0;
  fixture.rateOk = true;
  fixture.rateChecks = [];
  fixture.existingPhones = [];
  fixture.phoneChecks = [];
  fixture.proofError = null;
  fixture.trimmedProof = { reviewUrl: 'https://example.com/review' };
  fixture.bonuses = [];
  fixture.entriesValues = [HEADER];
  fixture.entryReads = 0;
  fixture.deletedRows = [];
  fixture.tokens = 0;
  fixture.writes = [];
  fixture.updateWrites = [];
  resetPools();
  useEvent({
    slug: 'grand-opening',
    adminKey: 'event-secret',
    name: 'Grand Opening',
    active: 'TRUE',
    baseTicketsPerEntry: 2,
    newsletterBonusEnabled: 'TRUE',
    newsletterBonusTickets: 5,
    defaultTestMode: 'FALSE',
    blockTestWrite: 'FALSE',
  });
});

function exportEntries(data = {}) {
  return handleExportEntries({
    slug: 'grand-opening',
    adminKey: 'event-secret',
    ...data,
  });
}

function readEntry(payload = {}) {
  return handleGetEntryByToken({
    payload: {
      slug: 'grand-opening',
      token: 'tok-1',
      clientIp: '203.0.113.8',
      ...payload,
    },
  });
}

function submit(payload = {}) {
  return handleSubmitEntry({
    payload: {
      slug: 'grand-opening',
      name: 'Pat Lee',
      email: 'pat.lee@example.com',
      phone: '(555) 123-4567',
      raffleId: 'wheels',
      ticketMode: 'single',
      termsAccepted: true,
      clientIp: '203.0.113.8',
      userAgent: 'TestAgent',
      ...payload,
    },
  });
}

function updateEntry(payload = {}) {
  return handleUpdateEntryByToken({
    payload: {
      slug: 'grand-opening',
      token: 'tok-1',
      name: 'Pat Lee',
      email: 'pat.lee@example.com',
      phone: '5551234567',
      raffleId: 'wheels',
      ticketMode: 'single',
      termsAccepted: true,
      clientIp: '203.0.113.8',
      userAgent: 'TestAgent',
      ...payload,
    },
  });
}

describe('handleExportEntries_ CSV', () => {
  it('rejects a blank slug and a wrong key without reading the sheet or returning rows', () => {
    fixture.entriesValues.push(sheetRow({ phone: '5551112222', extras: { __entryToken: 'secret' } }));

    const blank = exportEntries({ slug: '' });
    assert.equal(blank.status, 401);
    assert.deepEqual(blank.body, { ok: false, error: 'unauthorized' });
    assert.equal(fixture.lookups, 0);
    assert.equal(fixture.entryReads, 0);

    const wrong = exportEntries({ adminKey: 'nope' });
    assert.equal(wrong.status, 401);
    assert.equal(Object.hasOwn(wrong.body, 'csv'), false);
    assert.equal(JSON.stringify(wrong.body).includes('5551112222'), false);
    assert.equal(fixture.entryReads, 0);
  });

  it('quotes commas and quotes, skips other events, and formats Date stamps as ISO', () => {
    fixture.entriesValues.push(
      sheetRow({
        timestamp: new Date('2026-04-01T18:00:00.000Z'),
        name: 'Doe, Jane',
        phone: '5551112222',
        email: 'pat.lee@example.com',
        tickets: 4,
        userAgent: 'agent "x"',
        extras: { review: true },
      }),
      sheetRow({
        timestamp: 'not-a-date',
        slug: 'other-event',
        name: 'Hidden',
        phone: '9998887777',
        email: 'hidden@example.com',
      }),
    );

    const result = exportEntries({ adminKey: '  event-secret  ' });
    assert.equal(result.status, 200);
    assert.equal(
      result.body.csv,
      [
        HEADER.join(','),
        '2026-04-01T18:00:00.000Z,grand-opening,"Doe, Jane",5551112222,pat.lee@example.com,wheels,FALSE,FALSE,FALSE,4,FALSE,1.2.3.4,"agent ""x""","{""review"":true}"',
      ].join('\r\n'),
    );
    assert.equal(result.body.csv.includes('Hidden'), false);
    assert.equal(result.body.csv.includes('9998887777'), false);
    assert.equal(result.body.csv.includes('not-a-date'), false);
  });
});

describe('handleGetEntryByToken_ magic link', () => {
  it('stops missing fields before the rate limiter, and rate limits before the event lookup', () => {
    const missing = readEntry({ slug: '  ', token: '' });
    assert.equal(missing.status, 400);
    assert.deepEqual(missing.body, { ok: false, error: 'missing_fields', code: 'fields' });
    assert.deepEqual(fixture.rateChecks, []);
    assert.equal(fixture.lookups, 0);

    fixture.rateOk = false;
    const limited = readEntry();
    assert.equal(limited.status, 429);
    assert.equal(limited.body.code, 'rate_limited');
    assert.deepEqual(fixture.rateChecks, ['203.0.113.8']);
    assert.equal(fixture.lookups, 0);
    assert.equal(fixture.entryReads, 0);
  });

  it('hides the sheet when the event is missing or inactive, and rejects an unknown token', () => {
    fixture.event = null;
    const missing = readEntry();
    assert.equal(missing.status, 404);
    assert.deepEqual(missing.body, { ok: false, error: 'event_not_found' });
    assert.equal(fixture.entryReads, 0);

    useEvent({
      slug: 'grand-opening',
      active: 'FALSE',
      newsletterBonusTickets: 5,
    });
    const inactive = readEntry();
    assert.equal(inactive.status, 403);
    assert.equal(inactive.body.error, 'event_inactive');
    assert.equal(fixture.entryReads, 0);

    useEvent({
      slug: 'grand-opening',
      active: 'TRUE',
      name: 'Grand Opening',
      newsletterBonusTickets: 5,
    });
    fixture.entriesValues.push(sheetRow({ extras: { __entryToken: 'other-token' } }));
    const unknown = readEntry();
    assert.equal(unknown.status, 404);
    assert.deepEqual(unknown.body, { ok: false, error: 'entry_not_found', code: 'token' });
  });

  it('masks contact details, sums only this token, and locks from this entry\'s pools', () => {
    fixture.bonuses = [{ id: 'review', tickets: 4, label: 'Review' }];
    fixture.raffles = [{ id: 'wheels', title: 'Wheels', drawAt: futureDraw() }];
    fixture.rafflesAll = [
      { id: 'wheels', raffleId: 'wheels', title: 'Wheels', drawAt: new Date(Date.now() + 11 * 60 * 1000).toISOString() },
      { id: 'grand', raffleId: 'grand', title: 'Grand', drawAt: new Date(Date.now() + 60 * 1000).toISOString() },
    ];
    fixture.entriesValues.push(
      sheetRow({
        phone: '(555) 123-4567',
        email: 'pat.lee@example.com',
        tickets: 2,
        extras: {
          review: true,
          note: 'visible-string',
          __paid: true,
          __entryToken: 'tok-1',
          __split: true,
          __splitRaffleIds: ['wheels', 'grand'],
          __bonusProof: { reviewUrl: 'https://example.com/review' },
        },
      }),
      sheetRow({
        slug: 'other-event',
        phone: '5550009999',
        email: 'other@example.com',
        tickets: 50,
        extras: { __entryToken: 'tok-1', referral: true },
      }),
      sheetRow({
        raffleId: 'secret',
        tickets: 3,
        extras: { __entryToken: 'tok-1', __newsletterOptIn: true, referral: true },
      }),
    );

    const open = readEntry({ slug: ' grand-opening ', token: '  tok-1  ' });
    assert.equal(open.status, 200);
    const entry = open.body.entry;
    assert.equal(entry.emailMasked, 'pa***@example.com');
    assert.equal(entry.phoneLast4, '4567');
    assert.equal(Object.hasOwn(entry, 'email'), false);
    assert.equal(Object.hasOwn(entry, 'phone'), false);
    assert.equal(JSON.stringify(entry).includes('pat.lee@example.com'), false);
    assert.equal(JSON.stringify(entry).includes('5551234567'), false);
    assert.equal(JSON.stringify(entry).includes('5550009999'), false);
    assert.equal(entry.totalTickets, 5);
    assert.equal(entry.ticketMode, 'split');
    assert.deepEqual(entry.splitRaffleIds, ['wheels', 'grand']);
    assert.equal(entry.singleRaffleId, '');
    assert.deepEqual(entry.bonusById, { review: true });
    assert.deepEqual(entry.bonusProof, { reviewUrl: 'https://example.com/review' });
    assert.equal(entry.newsletterOptIn, true);
    assert.equal(entry.newsletterConfirmed, true);
    assert.equal(entry.newsletterBonusTickets, 5);
    assert.deepEqual(entry.bonuses, fixture.bonuses);
    assert.equal(entry.editLocked, false);
    assert.deepEqual(
      entry.pools.map((pool) => ({ raffleId: pool.raffleId, title: pool.title, tickets: pool.tickets })),
      [
        { raffleId: 'wheels', title: 'Wheels', tickets: 2 },
        { raffleId: 'secret', title: 'secret', tickets: 3 },
      ],
    );

    fixture.rafflesAll = [
      { id: 'wheels', raffleId: 'wheels', drawAt: new Date(Date.now() + 9 * 60 * 1000).toISOString() },
      { id: 'secret', raffleId: 'secret', drawAt: futureDraw() },
    ];
    const locked = readEntry();
    assert.equal(locked.body.entry.editLocked, true);

    fixture.rafflesAll = [
      { id: 'wheels', raffleId: 'wheels', drawAt: 'not-a-date' },
      { id: 'secret', raffleId: 'secret', drawAt: '' },
    ];
    assert.equal(readEntry().body.entry.editLocked, false);
  });
});

describe('handleSubmitEntry_ gates', () => {
  it('drops a honeypot before any lookup, and rejects the other gates without writing', () => {
    const bot = submit({ company: 'acme', slug: '' });
    assert.equal(bot.status, 200);
    assert.deepEqual(bot.body, { ok: true, totalEntries: 0, message: 'received' });
    assert.equal(fixture.lookups, 0);
    assert.equal(fixture.writes.length, 0);
    assert.equal(fixture.tokens, 0);

    assert.deepEqual(submit({ company: '', slug: '' }).body, { ok: false, error: 'missing_slug', code: 'slug' });
    assert.equal(fixture.lookups, 0);

    fixture.event = null;
    assert.equal(submit().status, 404);
    assert.equal(submit().body.error, 'event_not_found');

    useEvent({
      slug: 'grand-opening',
      active: 'FALSE',
      baseTicketsPerEntry: 2,
      newsletterBonusEnabled: 'TRUE',
      newsletterBonusTickets: 5,
      defaultTestMode: 'FALSE',
      blockTestWrite: 'FALSE',
    });
    assert.equal(submit().status, 403);
    assert.equal(submit().body.error, 'event_inactive');

    useEvent({
      slug: 'grand-opening',
      active: 'TRUE',
      baseTicketsPerEntry: 2,
      newsletterBonusEnabled: 'TRUE',
      newsletterBonusTickets: 5,
      defaultTestMode: 'FALSE',
      blockTestWrite: 'FALSE',
    });
    fixture.rateOk = false;
    assert.equal(submit().status, 429);
    assert.equal(submit().body.code, 'rate_limited');
    fixture.rateOk = true;

    assert.equal(submit({ name: '  ', email: '', phone: '' }).body.code, 'fields');
    assert.equal(submit({ termsAccepted: false }).body.code, 'terms');
    assert.equal(submit({ termsAccepted: 0 }).body.code, 'terms');
    assert.equal(submit({ raffleId: '' }).body.code, 'fields');
    assert.equal(submit({ raffleId: 'missing' }).body.code, 'raffle');
    assert.equal(submit({ ticketMode: 'split', splitRaffleIds: ['wheels'] }).body.code, 'split_pools');
    assert.equal(submit({ ticketMode: 'split', splitRaffleIds: ['wheels', 'missing'] }).body.code, 'raffle');
    assert.equal(submit({ ticketMode: 'split', splitRaffleIds: [] }).body.code, 'split_pools');

    fixture.raffles = [
      { id: 'wheels', title: 'Wheels' },
      { id: 'grand', title: 'Grand' },
    ];
    assert.equal(submit({ phone: '555-12' }).body.code, 'phone');
    assert.equal(fixture.phoneChecks.length, 0);

    fixture.existingPhones = ['grand-opening|5551234567'];
    const duplicate = submit();
    assert.equal(duplicate.status, 409);
    assert.equal(duplicate.body.code, 'duplicate_phone');
    assert.deepEqual(fixture.phoneChecks.at(-1), { slug: 'grand-opening', phoneNorm: '5551234567' });

    fixture.existingPhones = [];
    fixture.proofError = 'Please fill in the review link';
    assert.equal(submit().body.code, 'bonus_proof');

    assert.equal(fixture.writes.length, 0);
    assert.equal(fixture.tokens, 0);
    assert.equal(fixture.deletedRows.length, 0);
  });

  it('skips storage when default test mode is combined with blockTestWrite, and still reports the ticket total', () => {
    fixture.bonuses = [{ id: 'review', tickets: 3 }];
    useEvent({
      slug: 'grand-opening',
      active: 'TRUE',
      baseTicketsPerEntry: 2,
      newsletterBonusEnabled: 'TRUE',
      newsletterBonusTickets: 5,
      defaultTestMode: 'TRUE',
      blockTestWrite: 'TRUE',
    });

    const blocked = submit({ bonusReview: 1, newsletterOptIn: true, testMode: false });
    assert.equal(blocked.status, 200);
    assert.equal(blocked.body.ok, true);
    assert.equal(blocked.body.testMode, true);
    assert.equal(blocked.body.totalEntries, 10);
    assert.match(blocked.body.message, /blockTestWrite/);
    assert.equal(fixture.tokens, 0);
    assert.equal(fixture.writes.length, 0);
  });

  it('stores a real entry with a normalized phone and base, bonus, and newsletter tickets', () => {
    fixture.bonuses = [{ id: 'review', tickets: 3 }];
    fixture.raffles = [
      { id: 'wheels', title: 'Wheels' },
      { id: 'grand', title: 'Grand' },
    ];
    useEvent({
      slug: 'grand-opening',
      active: 'TRUE',
      name: 'Grand Opening',
      baseTicketsPerEntry: 2,
      newsletterBonusEnabled: 'FALSE',
      newsletterBonusTickets: 5,
      defaultTestMode: 'FALSE',
      blockTestWrite: 'TRUE',
    });

    const disabledNewsletter = submit({
      bonusById: { review: true },
      newsletterOptIn: true,
      ticketMode: 'split',
      splitRaffleIds: ['wheels', 'grand', 'wheels'],
      raffleId: '',
    });
    assert.equal(disabledNewsletter.status, 200);
    assert.equal(disabledNewsletter.body.from, 'submit-writer');
    assert.equal(fixture.tokens, 1);
    const wrote = fixture.writes[0];
    assert.equal(wrote[0], 'grand-opening');
    assert.equal(wrote[1], 'Pat Lee');
    assert.equal(wrote[2], '5551234567');
    assert.equal(wrote[3], 'pat.lee@example.com');
    assert.equal(wrote[9], 5);
    assert.equal(wrote[10], 'split');
    assert.equal(wrote[13], false);
    assert.equal(wrote[14], '203.0.113.8');
    assert.equal(wrote[15], 'TestAgent');
    assert.equal(wrote[16], 'token-fixed');
    assert.equal(wrote[17], true);
    assert.equal(wrote[18], false);
    assert.equal(wrote[19], 0);
    assert.deepEqual(wrote[7], { review: true });
  });
});

describe('handleUpdateEntryByToken_ rewrite', () => {
  function freeAndPaidSheet() {
    fixture.entriesValues = [
      HEADER,
      sheetRow({
        phone: '(555) 123-4567',
        email: 'pat.lee@example.com ',
        extras: { review: true, __entryToken: 'tok-1', __newsletterOptIn: true },
      }),
      sheetRow({
        raffleId: 'grand',
        tickets: 9,
        extras: { __paid: true, __entryToken: 'tok-1', __stripeSessionId: 'sess_1' },
      }),
      sheetRow({
        tickets: 1,
        extras: { __entryToken: 'tok-1' },
      }),
      sheetRow({
        tickets: 3,
        extras: { __newsletterBonus: true, __entryToken: 'tok-1' },
      }),
    ];
  }

  it('rejects access, lock, identity, terms, and pool errors without deleting rows', () => {
    freeAndPaidSheet();

    assert.equal(updateEntry({ token: '' }).status, 400);
    assert.deepEqual(fixture.rateChecks, []);

    fixture.rateOk = false;
    assert.equal(updateEntry().status, 429);
    assert.equal(fixture.lookups, 0);
    assert.equal(fixture.entryReads, 0);
    fixture.rateOk = true;

    fixture.event = null;
    assert.equal(updateEntry().body.error, 'event_not_found');
    assert.equal(fixture.entryReads, 0);
    useEvent({
      slug: 'grand-opening',
      active: 'FALSE',
      baseTicketsPerEntry: 2,
      newsletterBonusEnabled: 'TRUE',
      newsletterBonusTickets: 5,
      defaultTestMode: 'FALSE',
      blockTestWrite: 'FALSE',
    });
    assert.equal(updateEntry().status, 403);
    assert.equal(fixture.entryReads, 0);

    useEvent({
      slug: 'grand-opening',
      active: 'TRUE',
      baseTicketsPerEntry: 2,
      newsletterBonusEnabled: 'TRUE',
      newsletterBonusTickets: 5,
      defaultTestMode: 'FALSE',
      blockTestWrite: 'FALSE',
    });
    fixture.rafflesAll = [{ id: 'wheels', raffleId: 'wheels', drawAt: '2000-01-01T00:00:00.000Z' }];
    const locked = updateEntry();
    assert.equal(locked.status, 409);
    assert.equal(locked.body.code, 'locked');
    resetPools();

    fixture.entriesValues = [HEADER, sheetRow({ extras: { __entryToken: 'tok-1' } })];
    assert.equal(updateEntry({ email: 'someone-else@example.com' }).body.code, 'identity');
    assert.equal(updateEntry({ phone: '5559999999' }).body.code, 'identity');
    assert.equal(updateEntry({ termsAccepted: false }).body.code, 'terms');
    assert.equal(updateEntry({ raffleId: 'missing' }).body.code, 'raffle');
    assert.equal(updateEntry({ ticketMode: 'split', splitRaffleIds: ['wheels'] }).body.code, 'split_pools');

    fixture.proofError = 'Please fill in the review link';
    assert.equal(updateEntry().body.code, 'bonus_proof');
    fixture.proofError = null;

    fixture.entriesValues = [
      HEADER,
      sheetRow({ extras: { __paid: true, __entryToken: 'tok-1' } }),
      sheetRow({ extras: { __newsletterBonus: true, __entryToken: 'tok-1' } }),
    ];
    const paidOnly = updateEntry();
    assert.equal(paidOnly.status, 400);
    assert.equal(paidOnly.body.code, 'editable');

    assert.deepEqual(fixture.deletedRows, []);
    assert.equal(fixture.updateWrites.length, 0);
  });

  it('does not delete rows when default test mode is blocked', () => {
    freeAndPaidSheet();
    useEvent({
      slug: 'grand-opening',
      active: 'TRUE',
      baseTicketsPerEntry: 2,
      newsletterBonusEnabled: 'TRUE',
      newsletterBonusTickets: 5,
      defaultTestMode: 'TRUE',
      blockTestWrite: 'TRUE',
    });

    const blocked = updateEntry({ testMode: false });
    assert.equal(blocked.status, 200);
    assert.equal(blocked.body.testMode, true);
    assert.equal(blocked.body.totalEntries, 7);
    assert.match(blocked.body.message, /blockTestWrite/);
    assert.deepEqual(fixture.deletedRows, []);
    assert.equal(fixture.updateWrites.length, 0);
  });

  it('deletes only free rows from the bottom and preserves an omitted newsletter opt-in', () => {
    freeAndPaidSheet();

    const saved = updateEntry({ phone: '5551234567' });
    assert.equal(saved.status, 200);
    assert.equal(saved.body.from, 'update-writer');
    assert.deepEqual(fixture.deletedRows, [4, 2]);
    assert.equal(fixture.updateWrites.length, 1);
    const wrote = fixture.updateWrites[0];
    assert.equal(wrote[2], '5551234567');
    assert.equal(wrote[3], 'pat.lee@example.com');
    assert.equal(wrote[9], 7);
    assert.equal(wrote[10], 'single');
    assert.equal(wrote[11], 'wheels');
    assert.equal(wrote[13], false);
    assert.equal(wrote[16], 'tok-1');
    assert.equal(wrote[17], true);
    assert.equal(wrote[18], 5);
  });

  it('clears newsletter tickets when the checkbox is explicitly off', () => {
    fixture.entriesValues = [
      HEADER,
      sheetRow({ extras: { __entryToken: 'tok-1', __newsletterOptIn: true } }),
    ];

    const cleared = updateEntry({ newsletterOptIn: false });
    assert.equal(cleared.body.from, 'update-writer');
    assert.deepEqual(fixture.deletedRows, [2]);
    const wrote = fixture.updateWrites[0];
    assert.equal(wrote[9], 2);
    assert.equal(wrote[17], false);
    assert.equal(wrote[18], 0);
  });
});
