import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { beforeEach, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

/**
 * Executes the public event read, the admin config read, POST action routing,
 * and the entry sheet writer from Code.gs. The script is not edited: open
 * bugfix PRs already change it. Sheet I/O, bonus-rule parsing, and the public
 * winners feed are stubbed around the real read and write helpers.
 */
const codePath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '../google-apps-script/Code.gs',
);
const source = fs.readFileSync(codePath, 'utf8');

const EVENT_HEADERS = [
  'slug',
  'name',
  'eventName',
  'description',
  'logoUrl',
  'primaryColor',
  'secondaryColor',
  'theme',
  'active',
  'defaultTestMode',
  'blockTestWrite',
  'bonusRulesJson',
  'adminKey',
  'paidTicketsEnabled',
  'ticketPriceCents',
  'ticketCurrency',
  'paidTicketsMaxPerPurchase',
  'baseTicketsPerEntry',
  'newsletterBonusEnabled',
  'newsletterBonusTickets',
];

const RAFFLE_HEADERS = [
  'slug',
  'raffleId',
  'title',
  'subtitle',
  'imageUrl',
  'valueLabel',
  'sortOrder',
  'active',
  'drawAt',
];

const POST_ACTIONS = [
  ['submitEntry', 'handleSubmitEntry_'],
  ['getEntryByToken', 'handleGetEntryByToken_'],
  ['updateEntryByToken', 'handleUpdateEntryByToken_'],
  ['applyPaidTickets', 'handleApplyPaidTickets_'],
  ['getAdminStats', 'handleAdminStats_'],
  ['getAdminInsights', 'handleAdminInsights_'],
  ['refundPaidPurchase', 'handleRefundPaidPurchase_'],
  ['drawWinner', 'handleDrawWinner_'],
  ['exportEntries', 'handleExportEntries_'],
  ['getAdminEventConfig', 'handleGetAdminEventConfig_'],
  ['saveEventConfig', 'handleSaveEventConfig_'],
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

function eventRow(partial) {
  const values = {
    slug: 'grand-opening',
    name: '',
    eventName: '',
    description: '',
    logoUrl: '',
    primaryColor: '',
    secondaryColor: '',
    theme: '',
    active: 'TRUE',
    defaultTestMode: '',
    blockTestWrite: '',
    bonusRulesJson: '',
    adminKey: 'event-secret',
    paidTicketsEnabled: '',
    ticketPriceCents: '',
    ticketCurrency: '',
    paidTicketsMaxPerPurchase: '',
    baseTicketsPerEntry: '',
    newsletterBonusEnabled: '',
    newsletterBonusTickets: '',
    ...partial,
  };
  return EVENT_HEADERS.map((header) => values[header]);
}

function raffleRow(partial) {
  const values = {
    slug: 'grand-opening',
    raffleId: 'pool',
    title: 'Pool',
    subtitle: '',
    imageUrl: '',
    valueLabel: '',
    sortOrder: 1,
    active: 'TRUE',
    drawAt: '',
    ...partial,
  };
  return RAFFLE_HEADERS.map((header) => values[header]);
}

function loadApi(realNames) {
  const real = new Set(realNames);
  const stubs = [];
  if (!real.has('jsonResponse')) {
    stubs.push(
      'function jsonResponse(obj, status) { return { status: status || 200, body: obj }; }',
    );
  }
  if (!real.has('parseBonusRulesFromRow_')) {
    stubs.push(
      'function parseBonusRulesFromRow_(row) {',
      '  state.parses.push(row);',
      '  return state.bonuses;',
      '}',
    );
  }
  if (!real.has('handleGetPublicWinnersFeedGet_')) {
    stubs.push(
      'function handleGetPublicWinnersFeedGet_(slug) {',
      '  state.winners.push(slug);',
      '  return jsonResponse({ ok: true, via: "winners", slug: slug });',
      '}',
    );
  }
  if (!real.has('appendEntry_')) {
    stubs.push(
      'function appendEntry_(row) {',
      '  if (state.appendThrows) throw new Error(state.appendThrows);',
      '  state.appends.push(row.slice());',
      '}',
    );
  }
  for (const [action, fn] of POST_ACTIONS) {
    if (real.has(fn)) continue;
    stubs.push(
      `function ${fn}(data) {`,
      `  state.posts.push(${JSON.stringify(action)} + ":" + String(data && data.slug));`,
      `  if (state.throwOn === ${JSON.stringify(action)}) throw new Error("boom");`,
      `  return jsonResponse({ ok: true, via: ${JSON.stringify(action)} });`,
      '}',
    );
  }

  const body = [
    'var SHEET_EVENTS = "Events";',
    'var SHEET_RAFFLES = "Raffles";',
    'var SHEET_ENTRIES = "Entries";',
    'var SHEET_WINNERS = "Winners";',
    'var state = {',
    '  events: [],',
    '  raffles: [],',
    '  dropEventsAfterRead: false,',
    '  sheets: [],',
    '  appends: [],',
    '  mutations: [],',
    '  emails: [],',
    '  winners: [],',
    '  posts: [],',
    '  parses: [],',
    '  bonuses: [],',
    '  masterKey: "",',
    '  entryBaseUrl: "",',
    '  mailThrows: false,',
    '  appendThrows: "",',
    '  throwOn: "",',
    '};',
    'function copyRows_(rows) {',
    '  var out = [];',
    '  for (var i = 0; i < rows.length; i++) out.push(rows[i].slice());',
    '  return out;',
    '}',
    'function sheetFrom_(kind, rows) {',
    '  return {',
    '    getDataRange: function () {',
    '      var snapshot = copyRows_(rows);',
    '      if (kind === "events" && state.dropEventsAfterRead) {',
    '        state.dropEventsAfterRead = false;',
    '        state.events = rows.length ? [rows[0].slice()] : [];',
    '      }',
    '      return { getValues: function () { return snapshot; } };',
    '    },',
    '    appendRow: function (row) { state.mutations.push("appendRow"); },',
    '    setValue: function () { state.mutations.push("setValue"); },',
    '    deleteRow: function () { state.mutations.push("deleteRow"); },',
    '    getRange: function () {',
    '      state.mutations.push("getRange");',
    '      return { setValue: function () { state.mutations.push("setValue"); } };',
    '    },',
    '  };',
    '}',
    'function getSpreadsheet_() {',
    '  return {',
    '    getSheetByName: function (name) {',
    '      state.sheets.push(name);',
    '      if (name === "Events") return state.events ? sheetFrom_("events", state.events) : null;',
    '      if (name === "Raffles") return state.raffles ? sheetFrom_("raffles", state.raffles) : null;',
    '      return null;',
    '    },',
    '  };',
    '}',
    'var PropertiesService = {',
    '  getScriptProperties: function () {',
    '    return {',
    '      getProperty: function (key) {',
    '        if (key === "ADMIN_MASTER_KEY") return state.masterKey;',
    '        if (key === "ENTRY_BASE_URL") return state.entryBaseUrl;',
    '        return "";',
    '      },',
    '    };',
    '  },',
    '};',
    'var MailApp = {',
    '  sendEmail: function (message) {',
    '    if (state.mailThrows) throw new Error("smtp down");',
    '    state.emails.push(message);',
    '  },',
    '};',
    ...stubs,
    ...realNames.map((name) => sliceFunction(name)),
    'return {',
    '  state: state,',
    '  doGet: typeof doGet === "function" ? doGet : null,',
    '  doPost: typeof doPost === "function" ? doPost : null,',
    '  handleGetAdminEventConfig_: typeof handleGetAdminEventConfig_ === "function" ? handleGetAdminEventConfig_ : null,',
    '  runEntryWritesAndMaybeEmail_: typeof runEntryWritesAndMaybeEmail_ === "function" ? runEntryWritesAndMaybeEmail_ : null,',
    '  trySendManageEntryEmail_: typeof trySendManageEntryEmail_ === "function" ? trySendManageEntryEmail_ : null,',
    '};',
  ].join('\n');

  return new Function(body)();
}

function reset(state) {
  state.events = [EVENT_HEADERS.slice(), eventRow()];
  state.raffles = [RAFFLE_HEADERS.slice()];
  state.dropEventsAfterRead = false;
  state.sheets = [];
  state.appends = [];
  state.mutations = [];
  state.emails = [];
  state.winners = [];
  state.posts = [];
  state.parses = [];
  state.bonuses = [{ id: 'stub-bonus', tickets: 4 }];
  state.masterKey = '';
  state.entryBaseUrl = '';
  state.mailThrows = false;
  state.appendThrows = '';
  state.throwOn = '';
}

const publicApi = loadApi([
  'doGet',
  'findEventRow_',
  'recordToObject_',
  'getRafflesForSlug_',
  'getBaseTicketsPerEntry_',
  'getNewsletterBonusTickets_',
  'isNewsletterBonusEnabled_',
]);

const adminApi = loadApi([
  'handleGetAdminEventConfig_',
  'validateAdminKey_',
  'findEventRow_',
  'recordToObject_',
  'getRafflesAllForSlug_',
  'getAdminMasterKey_',
  'getBaseTicketsPerEntry_',
  'getNewsletterBonusTickets_',
  'isNewsletterBonusEnabled_',
]);

const postApi = loadApi(['doPost']);

const writeApi = loadApi([
  'runEntryWritesAndMaybeEmail_',
  'trySendManageEntryEmail_',
  'getEntryBaseUrl_',
  'appendEntryRow_',
  'legacyBonusBooleans_',
  'buildTicketSplitPlan_',
]);

function publicGet(parameter) {
  return publicApi.doGet({ parameter });
}

describe('doGet public event', () => {
  beforeEach(() => reset(publicApi.state));

  it('rejects unknown actions and blank slugs before opening a sheet', () => {
    const unknown = publicGet({ action: 'saveEventConfig', slug: 'grand-opening' });
    assert.equal(unknown.status, 400);
    assert.deepEqual(unknown.body, { ok: false, error: 'unknown_action' });

    const missingEvent = publicGet({ action: 'getEvent', slug: '' });
    assert.equal(missingEvent.status, 400);
    assert.equal(missingEvent.body.error, 'missing_slug');

    const missingFeed = publicGet({ action: 'getPublicWinnersFeed' });
    assert.equal(missingFeed.status, 400);
    assert.equal(missingFeed.body.error, 'missing_slug');

    assert.deepEqual(publicApi.state.sheets, []);
    assert.deepEqual(publicApi.state.winners, []);
    assert.deepEqual(publicApi.state.parses, []);
  });

  it('returns 404 for an unknown slug and 403 for an inactive event without loading pools', () => {
    publicApi.state.events = [EVENT_HEADERS.slice(), eventRow({ slug: 'other-event' })];
    const missing = publicGet({ action: 'getEvent', slug: 'grand-opening' });
    assert.equal(missing.status, 404);
    assert.equal(missing.body.error, 'event_not_found');
    assert.deepEqual(publicApi.state.parses, []);

    for (const active of ['FALSE', '', 'yes', false]) {
      publicApi.state.sheets = [];
      publicApi.state.parses = [];
      publicApi.state.events = [EVENT_HEADERS.slice(), eventRow({ active })];
      publicApi.state.raffles = [RAFFLE_HEADERS.slice(), raffleRow({ title: 'Should stay unread' })];
      const inactive = publicGet({ action: 'getEvent', slug: 'grand-opening' });
      assert.equal(inactive.status, 403, `active ${String(active)}`);
      assert.equal(inactive.body.error, 'event_inactive');
      assert.deepEqual(publicApi.state.sheets, ['Events']);
      assert.equal(JSON.stringify(inactive.body).includes('Should stay unread'), false);
      assert.equal(JSON.stringify(inactive.body).includes('event-secret'), false);
    }
  });

  it('publishes clamped defaults and keeps the admin key off the public payload', () => {
    publicApi.state.events = [
      EVENT_HEADERS.slice(),
      eventRow({
        slug: ' grand-opening ',
        name: '',
        eventName: '',
        adminKey: 'event-secret',
        bonusRulesJson: '{"review":99}',
        blockTestWrite: 'TRUE',
      }),
    ];

    const res = publicGet({ action: 'getEvent', slug: 'grand-opening' });
    assert.equal(res.status, 200);
    assert.deepEqual(res.body, {
      ok: true,
      event: {
        slug: 'grand-opening',
        name: 'Event',
        description: '',
        logoUrl: '',
        primaryColor: '#c9a227',
        secondaryColor: '#1a1a1a',
        theme: 'dark',
        active: true,
        defaultTestMode: false,
        raffles: [],
        bonuses: [{ id: 'stub-bonus', tickets: 4 }],
        paidTicketsEnabled: false,
        ticketPriceCents: 0,
        ticketCurrency: 'usd',
        paidTicketsMaxPerPurchase: 100,
        baseTicketsPerEntry: 2,
        newsletterBonusEnabled: true,
        newsletterBonusTickets: 0,
      },
    });
    assert.equal(JSON.stringify(res.body).includes('event-secret'), false);
    assert.equal(JSON.stringify(res.body).includes('blockTestWrite'), false);
    assert.equal(JSON.stringify(res.body).includes('{"review":99}'), false);
    assert.equal(publicApi.state.parses.length, 1);
    assert.equal(publicApi.state.parses[0].adminKey, 'event-secret');
    assert.deepEqual(publicApi.state.sheets, ['Events', 'Raffles']);
  });

  it('clamps price, purchase cap, theme, and name using the public read rules', () => {
    publicApi.state.events = [
      EVENT_HEADERS.slice(),
      eventRow({
        name: '',
        eventName: 'Spring Giveaway',
        description: 'Win a wrap',
        logoUrl: 'http://insecure.example/logo.png',
        primaryColor: '#112233',
        secondaryColor: '#abcdef',
        theme: 'LIGHT',
        active: 'true',
        defaultTestMode: 'TRUE',
        paidTicketsEnabled: true,
        ticketPriceCents: 12.9,
        ticketCurrency: 'USDOLLARX',
        paidTicketsMaxPerPurchase: 0.4,
        baseTicketsPerEntry: 1.9,
        newsletterBonusEnabled: 'FALSE',
        newsletterBonusTickets: 3.2,
      }),
    ];

    const res = publicGet({ action: 'getEvent', slug: 'grand-opening' });
    assert.equal(res.status, 200);
    assert.equal(res.body.event.name, 'Spring Giveaway');
    assert.equal(res.body.event.logoUrl, 'http://insecure.example/logo.png');
    assert.equal(res.body.event.theme, 'dark');
    assert.equal(res.body.event.defaultTestMode, true);
    assert.equal(res.body.event.paidTicketsEnabled, true);
    assert.equal(res.body.event.ticketPriceCents, 12);
    assert.equal(res.body.event.ticketCurrency, 'usdollar');
    assert.equal(res.body.event.paidTicketsMaxPerPurchase, 1);
    assert.equal(res.body.event.baseTicketsPerEntry, 1);
    assert.equal(res.body.event.newsletterBonusEnabled, false);
    assert.equal(res.body.event.newsletterBonusTickets, 3);

    publicApi.state.events = [
      EVENT_HEADERS.slice(),
      eventRow({
        theme: 'light',
        ticketPriceCents: -4,
        paidTicketsMaxPerPurchase: 0,
        ticketCurrency: '',
      }),
    ];
    const floors = publicGet({ action: 'getEvent', slug: 'grand-opening' });
    assert.equal(floors.body.event.theme, 'light');
    assert.equal(floors.body.event.ticketPriceCents, 0);
    assert.equal(floors.body.event.paidTicketsMaxPerPurchase, 100);
    assert.equal(floors.body.event.ticketCurrency, 'usd');

    const headers = EVENT_HEADERS.filter((header) => header !== 'newsletterBonusTickets');
    const row = headers.map((header) => {
      if (header === 'slug') return 'grand-opening';
      if (header === 'active') return 'TRUE';
      if (header === 'baseTicketsPerEntry') return -1;
      return '';
    });
    publicApi.state.events = [headers, row];
    const defaults = publicGet({ action: 'getEvent', slug: 'grand-opening' });
    assert.equal(defaults.body.event.baseTicketsPerEntry, 2);
    assert.equal(defaults.body.event.newsletterBonusTickets, 2);
  });

  it('omits inactive and other-event pools and sorts the public list', () => {
    publicApi.state.events = [EVENT_HEADERS.slice(), eventRow({ slug: ' grand-opening ' })];
    publicApi.state.raffles = [
      RAFFLE_HEADERS.slice(),
      raffleRow({
        raffleId: ' early ',
        title: 'Early',
        sortOrder: 2,
        imageUrl: 'http://cdn.example/early.png',
        drawAt: ' 2026-06-01T18:00:00.000Z ',
      }),
      raffleRow({ raffleId: 'late', title: 'Late', sortOrder: 1, active: '' }),
      raffleRow({ raffleId: 'hidden', title: 'Hidden Pool', sortOrder: 3, active: 'FALSE' }),
      raffleRow({ slug: 'other-event', raffleId: 'foreign', title: 'Foreign Pool', sortOrder: 0 }),
    ];

    const res = publicGet({ action: 'getEvent', slug: 'grand-opening' });
    assert.deepEqual(res.body.event.raffles, [
      {
        id: 'late',
        title: 'Late',
        subtitle: '',
        imageUrl: '',
        valueLabel: '',
        sortOrder: 1,
        drawAt: '',
      },
      {
        id: 'early',
        title: 'Early',
        subtitle: '',
        imageUrl: 'http://cdn.example/early.png',
        valueLabel: '',
        sortOrder: 2,
        drawAt: '2026-06-01T18:00:00.000Z',
      },
    ]);
    const encoded = JSON.stringify(res.body);
    assert.equal(encoded.includes('Hidden Pool'), false);
    assert.equal(encoded.includes('Foreign Pool'), false);
  });

  it('passes a winners-feed slug through and turns sheet failures into 500', () => {
    const feed = publicGet({ action: 'getPublicWinnersFeed', slug: 'grand-opening' });
    assert.equal(feed.status, 200);
    assert.deepEqual(feed.body, { ok: true, via: 'winners', slug: 'grand-opening' });
    assert.deepEqual(publicApi.state.winners, ['grand-opening']);
    assert.deepEqual(publicApi.state.sheets, []);

    publicApi.state.events = null;
    const missingSheet = publicGet({ action: 'getEvent', slug: 'grand-opening' });
    assert.equal(missingSheet.status, 500);
    assert.equal(missingSheet.body.error, 'Missing sheet: Events');
  });
});

describe('doPost action routing', () => {
  beforeEach(() => reset(postApi.state));

  it('rejects invalid JSON and unknown actions before any handler', () => {
    const broken = postApi.doPost({ postData: { contents: '{' } });
    assert.equal(broken.status, 400);
    assert.deepEqual(broken.body, { ok: false, error: 'invalid_json' });

    const missingBody = postApi.doPost({});
    assert.equal(missingBody.status, 400);
    assert.equal(missingBody.body.error, 'invalid_json');

    const unknown = postApi.doPost({ postData: { contents: JSON.stringify({ action: 'dropTable' }) } });
    assert.equal(unknown.status, 400);
    assert.equal(unknown.body.error, 'unknown_action');
    assert.deepEqual(postApi.state.posts, []);
  });

  it('dispatches each action to its own handler and wraps handler failures', () => {
    for (const [action] of POST_ACTIONS) {
      postApi.state.posts = [];
      const payload = { action, slug: 'grand-opening', n: 1 };
      const res = postApi.doPost({ postData: { contents: JSON.stringify(payload) } });
      assert.equal(res.status, 200, action);
      assert.equal(res.body.via, action);
      assert.deepEqual(postApi.state.posts, [`${action}:grand-opening`]);
    }

    postApi.state.throwOn = 'refundPaidPurchase';
    postApi.state.posts = [];
    const failed = postApi.doPost({
      postData: { contents: JSON.stringify({ action: 'refundPaidPurchase', slug: 'grand-opening' }) },
    });
    assert.equal(failed.status, 500);
    assert.deepEqual(failed.body, { ok: false, error: 'boom' });
    assert.deepEqual(postApi.state.posts, ['refundPaidPurchase:grand-opening']);
  });
});

describe('handleGetAdminEventConfig_', () => {
  beforeEach(() => reset(adminApi.state));

  it('rejects a blank slug, a wrong key, and a blank key before loading pools', () => {
    const blank = adminApi.handleGetAdminEventConfig_({ slug: '', adminKey: 'event-secret' });
    assert.equal(blank.status, 401);
    assert.equal(blank.body.error, 'unauthorized');
    assert.deepEqual(adminApi.state.sheets, []);

    adminApi.state.events = [EVENT_HEADERS.slice(), eventRow()];
    const wrong = adminApi.handleGetAdminEventConfig_({ slug: 'grand-opening', adminKey: 'nope' });
    assert.equal(wrong.status, 401);
    assert.deepEqual(adminApi.state.sheets, ['Events']);
    assert.equal(JSON.stringify(wrong.body).includes('event-secret'), false);

    adminApi.state.sheets = [];
    adminApi.state.events = [EVENT_HEADERS.slice(), eventRow({ adminKey: '' })];
    const empty = adminApi.handleGetAdminEventConfig_({ slug: 'grand-opening', adminKey: '' });
    assert.equal(empty.status, 401);
    assert.deepEqual(adminApi.state.sheets, ['Events']);
  });

  it('accepts a trimmed event key or the master key and returns 404 if the row disappears', () => {
    adminApi.state.events = [EVENT_HEADERS.slice(), eventRow({ adminKey: '  event-secret  ' })];
    const trimmed = adminApi.handleGetAdminEventConfig_({
      slug: 'grand-opening',
      adminKey: ' event-secret ',
    });
    assert.equal(trimmed.status, 200);
    assert.equal(trimmed.body.event.blockTestWrite, false);

    adminApi.state.sheets = [];
    adminApi.state.masterKey = 'master-secret';
    adminApi.state.events = [EVENT_HEADERS.slice(), eventRow({ adminKey: 'event-secret' })];
    const master = adminApi.handleGetAdminEventConfig_({
      slug: 'grand-opening',
      adminKey: ' master-secret ',
    });
    assert.equal(master.status, 200);

    adminApi.state.sheets = [];
    adminApi.state.masterKey = 'master-secret';
    adminApi.state.dropEventsAfterRead = true;
    adminApi.state.raffles = [RAFFLE_HEADERS.slice(), raffleRow({ title: 'Unread pool' })];
    const raced = adminApi.handleGetAdminEventConfig_({
      slug: 'grand-opening',
      adminKey: 'master-secret',
    });
    assert.equal(raced.status, 404);
    assert.equal(raced.body.error, 'event_not_found');
    assert.deepEqual(adminApi.state.sheets, ['Events', 'Events']);
    assert.equal(JSON.stringify(raced.body).includes('Unread pool'), false);
  });

  it('returns an inactive event, raw bonus JSON, and inactive pools without writing', () => {
    adminApi.state.events = [
      EVENT_HEADERS.slice(),
      eventRow({
        slug: ' grand-opening ',
        name: '',
        description: 'Staff notes',
        theme: 'blue',
        active: 'FALSE',
        blockTestWrite: 'TRUE',
        bonusRulesJson: '{',
        paidTicketsEnabled: 'TRUE',
        ticketPriceCents: -4,
        ticketCurrency: 'USD',
        paidTicketsMaxPerPurchase: 2.9,
        baseTicketsPerEntry: 0,
        newsletterBonusEnabled: 'TRUE',
        newsletterBonusTickets: 5,
        adminKey: 'event-secret',
      }),
    ];
    adminApi.state.raffles = [
      RAFFLE_HEADERS.slice(),
      raffleRow({ raffleId: 'live', title: 'Live', sortOrder: 2, active: 'TRUE' }),
      raffleRow({
        raffleId: 'hidden',
        title: 'Hidden Pool',
        sortOrder: 1,
        active: 'FALSE',
        drawAt: ' 2026-07-01T18:00:00.000Z ',
      }),
      raffleRow({ slug: 'other-event', raffleId: 'foreign', title: 'Foreign Pool' }),
    ];

    const res = adminApi.handleGetAdminEventConfig_({
      slug: 'grand-opening',
      adminKey: 'event-secret',
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.slug, 'grand-opening');
    assert.equal(res.body.event.active, false);
    assert.equal(res.body.event.theme, 'dark');
    assert.equal(res.body.event.blockTestWrite, true);
    assert.equal(res.body.event.bonusRulesJson, '{');
    assert.equal(res.body.event.ticketPriceCents, 0);
    assert.equal(res.body.event.ticketCurrency, 'usd');
    assert.equal(res.body.event.paidTicketsMaxPerPurchase, 2);
    assert.equal(res.body.event.baseTicketsPerEntry, 2);
    assert.equal(res.body.event.newsletterBonusEnabled, true);
    assert.equal(res.body.event.newsletterBonusTickets, 5);
    assert.equal(res.body.event.name, '');
    assert.deepEqual(res.body.raffles.map((pool) => [pool.id, pool.raffleId, pool.active, pool.title]), [
      ['hidden', 'hidden', false, 'Hidden Pool'],
      ['live', 'live', true, 'Live'],
    ]);
    assert.equal(res.body.raffles[0].drawAt, '2026-07-01T18:00:00.000Z');
    assert.equal(JSON.stringify(res.body).includes('event-secret'), false);
    assert.equal(JSON.stringify(res.body).includes('Foreign Pool'), false);
    assert.deepEqual(adminApi.state.mutations, []);
    assert.deepEqual(adminApi.state.appends, []);
    assert.equal(adminApi.state.events[1][EVENT_HEADERS.indexOf('theme')], 'blue');
  });
});

describe('runEntryWritesAndMaybeEmail_', () => {
  const raffles = [{ id: 'pool-b' }, { id: 'pool-a' }, { id: 'pool-c' }];

  function write(overrides) {
    const args = {
      slug: 'grand-opening',
      name: 'Pat Lee',
      phoneNorm: '5551234567',
      email: ' pat.lee@example.com ',
      payload: {},
      event: { name: 'Spring Giveaway' },
      totalEntries: 5,
      ticketMode: 'single',
      raffleId: 'pool-a',
      raffles,
      testMode: false,
      ip: '203.0.113.8',
      ua: 'Mozilla/5.0',
      entryToken: 'tok/1',
      sendMagicEmail: true,
      newsletterOptIn: false,
      newsletterBonusEarned: 0,
      bonusById: { review: true, instagram: false, story_tag: true },
      bonusProofTrimmed: { review: 'https://example.com/proof' },
      ...overrides,
    };
    return writeApi.runEntryWritesAndMaybeEmail_(
      args.slug,
      args.name,
      args.phoneNorm,
      args.email,
      args.payload,
      args.event,
      [],
      args.bonusById,
      args.bonusProofTrimmed,
      args.totalEntries,
      args.ticketMode,
      args.raffleId,
      args.raffles,
      args.testMode,
      args.ip,
      args.ua,
      args.entryToken,
      args.sendMagicEmail,
      args.newsletterOptIn,
      args.newsletterBonusEarned,
    );
  }

  function extras(row) {
    return JSON.parse(row[13]);
  }

  beforeEach(() => {
    reset(writeApi.state);
    writeApi.state.entryBaseUrl = ' https://raffle.example.com/ ';
  });

  it('writes one single-pool row and sends one encoded magic link', () => {
    const res = write({ newsletterOptIn: true, newsletterBonusEarned: 3.9 });
    assert.equal(res.status, 200);
    assert.deepEqual(res.body, {
      ok: true,
      totalEntries: 5,
      ticketMode: 'single',
      testMode: false,
      magicLinkSent: true,
      entryToken: 'tok/1',
    });
    assert.equal(writeApi.state.appends.length, 1);
    const row = writeApi.state.appends[0];
    assert.equal(row[0] instanceof Date, true);
    assert.equal(row[1], 'grand-opening');
    assert.equal(row[2], 'Pat Lee');
    assert.equal(row[3], '5551234567');
    assert.equal(row[4], ' pat.lee@example.com ');
    assert.equal(row[5], 'pool-a');
    assert.deepEqual(row.slice(6, 9), ['FALSE', 'TRUE', 'FALSE']);
    assert.equal(row[9], 5);
    assert.equal(row[10], 'FALSE');
    assert.equal(row[11], '203.0.113.8');
    assert.equal(row[12], 'Mozilla/5.0');
    assert.deepEqual(extras(row), {
      review: true,
      instagram: false,
      story_tag: true,
      __entryToken: 'tok/1',
      __newsletterOptIn: true,
      __newsletterBonusEarned: 3,
      __bonusProof: { review: 'https://example.com/proof' },
    });
    assert.equal(writeApi.state.emails.length, 1);
    assert.equal(writeApi.state.emails[0].to, 'pat.lee@example.com');
    assert.equal(writeApi.state.emails[0].subject, 'Your raffle entry — Spring Giveaway');
    assert.equal(
      writeApi.state.emails[0].body.includes(
        'https://raffle.example.com/e/grand-opening/my-entry?token=tok%2F1',
      ),
      true,
    );
    assert.match(writeApi.state.emails[0].body, /^Hi Pat Lee,\n\n/);
    assert.deepEqual(writeApi.state.mutations, []);
  });

  it('skips the magic link for test mode, a disabled send flag, a missing base URL, and a blank address', () => {
    const testMode = write({ testMode: true });
    assert.equal(testMode.body.testMode, true);
    assert.equal(testMode.body.magicLinkSent, false);
    assert.equal(writeApi.state.appends[0][10], 'TRUE');
    assert.deepEqual(writeApi.state.emails, []);

    writeApi.state.appends = [];
    const noSend = write({ sendMagicEmail: false });
    assert.equal(noSend.body.magicLinkSent, false);
    assert.equal(writeApi.state.appends.length, 1);
    assert.deepEqual(writeApi.state.emails, []);

    writeApi.state.appends = [];
    writeApi.state.entryBaseUrl = '';
    const noBase = write();
    assert.equal(noBase.status, 200);
    assert.equal(noBase.body.magicLinkSent, false);
    assert.deepEqual(writeApi.state.emails, []);

    writeApi.state.entryBaseUrl = 'https://raffle.example.com';
    const noAddress = writeApi.trySendManageEntryEmail_('', 'Pat', 'Spring', 'grand-opening', 'tok');
    assert.equal(noAddress, false);
    assert.deepEqual(writeApi.state.emails, []);
  });

  it('writes every positive split weight once, preserves the ticket total, and emails once', () => {
    const even = write({
      ticketMode: 'split',
      totalEntries: 4,
      payload: {},
      raffleId: '',
      newsletterOptIn: false,
      newsletterBonusEarned: -2,
      bonusProofTrimmed: {},
    });
    assert.equal(even.status, 200);
    assert.equal(even.body.ticketMode, 'split');
    assert.equal(even.body.poolsEntered, 3);
    assert.equal(even.body.totalEntries, 4);
    assert.equal(writeApi.state.appends.length, 3);
    assert.deepEqual(
      writeApi.state.appends.map((row) => row[5]),
      ['pool-b', 'pool-a', 'pool-c'],
    );
    const weights = writeApi.state.appends.map((row) => row[9]);
    assert.equal(weights.reduce((sum, weight) => sum + weight, 0), 4);
    assert.equal(extras(writeApi.state.appends[0]).__split, true);
    assert.equal(extras(writeApi.state.appends[0]).__splitEvenly, true);
    assert.deepEqual(extras(writeApi.state.appends[0]).__splitRaffleIds, ['pool-b', 'pool-a', 'pool-c']);
    assert.equal(extras(writeApi.state.appends[0]).__newsletterBonusEarned, undefined);
    assert.equal(extras(writeApi.state.appends[0]).__bonusProof, undefined);
    assert.equal(writeApi.state.emails.length, 1);

    writeApi.state.appends = [];
    writeApi.state.emails = [];
    const custom = write({
      ticketMode: 'split',
      totalEntries: 5,
      payload: { splitEvenly: false, ticketSplit: { 'pool-b': 5, 'pool-a': 0, 'pool-c': 0 } },
    });
    assert.equal(custom.status, 200);
    assert.equal(custom.body.poolsEntered, 1);
    assert.equal(writeApi.state.appends.length, 1);
    assert.equal(writeApi.state.appends[0][5], 'pool-b');
    assert.equal(writeApi.state.appends[0][9], 5);
    assert.equal(extras(writeApi.state.appends[0]).__splitEvenly, false);
    assert.deepEqual(extras(writeApi.state.appends[0]).__splitRaffleIds, ['pool-b']);
    assert.equal(writeApi.state.emails.length, 1);
  });

  it('does not write or email when the split cannot be built or the sheet append fails', () => {
    const noPools = write({ ticketMode: 'split', raffles: [] });
    assert.equal(noPools.status, 400);
    assert.equal(noPools.body.code, 'split');
    assert.equal(noPools.body.error, 'Could not build ticket split.');
    assert.deepEqual(writeApi.state.appends, []);
    assert.deepEqual(writeApi.state.emails, []);

    const badPool = write({
      ticketMode: 'split',
      payload: { splitRaffleIds: ['pool-a', 'missing'] },
    });
    assert.equal(badPool.status, 400);
    assert.equal(badPool.body.code, 'split');
    assert.equal(badPool.body.error, 'Invalid pool in selection: missing');
    assert.deepEqual(writeApi.state.appends, []);
    assert.deepEqual(writeApi.state.emails, []);

    writeApi.state.appendThrows = 'sheet locked';
    const locked = write();
    assert.equal(locked.status, 400);
    assert.deepEqual(locked.body, { ok: false, error: 'sheet locked', code: 'split' });
    assert.deepEqual(writeApi.state.emails, []);

    writeApi.state.appendThrows = '';
    writeApi.state.mailThrows = true;
    const mailed = write();
    assert.equal(mailed.status, 200);
    assert.equal(mailed.body.ok, true);
    assert.equal(mailed.body.magicLinkSent, false);
    assert.equal(writeApi.state.appends.length, 1);
    assert.deepEqual(writeApi.state.emails, []);
  });
});
