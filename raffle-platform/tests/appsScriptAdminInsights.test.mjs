import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { beforeEach, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

/**
 * Loads the admin insights aggregator from Apps Script. Code.gs is not an ES
 * module, and open bugfix PRs already edit it, so these tests execute the
 * function in place. Sheet reads are stubbed; the ticket, refund, and revenue
 * rules stay the ones in the script.
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

function loadInsights() {
  const body = [
    'var insightFixture = { masterKey: "", event: null, rows: [], raffles: [] };',
    'function jsonResponse(obj, status) {',
    '  return { status: status || 200, body: obj };',
    '}',
    'function getAdminMasterKey_() { return insightFixture.masterKey || ""; }',
    'function findEventRow_(slug) {',
    '  var ev = insightFixture.event;',
    '  if (!ev || String(slug).trim() !== String(ev.slug).trim()) return null;',
    '  return { headers: ev.headers, record: ev.record };',
    '}',
    'function readEntriesForSlug_() { return insightFixture.rows || []; }',
    'function getRafflesAllForSlug_() { return insightFixture.raffles || []; }',
    'function getEntriesExtrasColumnIndex_() { return 13; }',
    sliceFunction('recordToObject_'),
    sliceFunction('parseEntryExtrasJson_'),
    sliceFunction('maskEmail_'),
    sliceFunction('validateAdminKey_'),
    sliceFunction('handleAdminInsights_'),
    'return { handleAdminInsights: handleAdminInsights_, fixture: insightFixture };',
  ].join('\n');
  return new Function(body)();
}

const { handleAdminInsights, fixture } = loadInsights();

const EXTRAS_COLUMN = 13;

function useEvent(fields) {
  const headers = Object.keys(fields);
  fixture.event = {
    slug: fields.slug,
    headers,
    record: headers.map((header) => fields[header]),
  };
}

function entryRow(partial) {
  const row = Array(EXTRAS_COLUMN + 1).fill('');
  row[0] = partial.ts;
  row[1] = partial.slug ?? 'grand-opening';
  row[2] = partial.name ?? '';
  row[3] = partial.phone ?? '';
  row[4] = partial.email ?? '';
  row[5] = partial.raffleId ?? '';
  row[9] = partial.tickets ?? 0;
  row[10] = partial.isTest ?? 'FALSE';
  if (typeof partial.extras === 'string') row[EXTRAS_COLUMN] = partial.extras;
  else row[EXTRAS_COLUMN] = JSON.stringify(partial.extras ?? {});
  return row;
}

function run(adminKey, slug = 'grand-opening') {
  return handleAdminInsights({ slug, adminKey });
}

beforeEach(() => {
  fixture.masterKey = '';
  fixture.rows = [];
  fixture.raffles = [
    { raffleId: 'grand-prize', title: 'Grand prize', drawAt: '2026-04-01T18:00:00.000Z', active: true },
    { raffleId: 'door-prize', title: 'Door prize', drawAt: '', active: false },
  ];
  useEvent({
    slug: 'grand-opening',
    name: 'Grand Opening',
    adminKey: 'event-secret',
    ticketCurrency: 'USD',
    paidTicketsEnabled: 'TRUE',
    ticketPriceCents: 500,
  });
});

describe('handleAdminInsights_ access', () => {
  it('rejects a missing slug, an unknown event, and a key that matches neither secret', () => {
    assert.deepEqual(run('event-secret', ''), {
      status: 401,
      body: { ok: false, error: 'unauthorized' },
    });
    assert.deepEqual(run('event-secret', 'missing-event'), {
      status: 401,
      body: { ok: false, error: 'unauthorized' },
    });
    assert.equal(run('nope').status, 401);
    assert.equal(run('').status, 401);
    fixture.masterKey = 'master-secret';
    assert.equal(run('master-secret', 'missing-event').status, 401);
  });

  it('accepts a trimmed per-event key and the master key', () => {
    const perEvent = run('  event-secret  ');
    assert.equal(perEvent.status, 200);
    assert.equal(perEvent.body.ok, true);
    assert.equal(perEvent.body.insights.slug, 'grand-opening');

    fixture.masterKey = 'master-secret';
    const master = run('  master-secret');
    assert.equal(master.status, 200);
    assert.equal(master.body.insights.eventName, 'Grand Opening');

    useEvent({
      slug: 'grand-opening',
      name: 'Grand Opening',
      adminKey: '   ',
      ticketCurrency: 'USD',
      paidTicketsEnabled: 'TRUE',
      ticketPriceCents: 500,
    });
    assert.equal(run('').status, 401);
    assert.equal(run('master-secret').status, 200);
  });
});

describe('handleAdminInsights_ event money flags', () => {
  it('normalizes the paid-ticket switch, price, and currency', () => {
    const enabledCases = [
      ['TRUE', true],
      [true, true],
      ['true', true],
      ['FALSE', false],
      ['', false],
      ['1', false],
    ];
    for (const [raw, expected] of enabledCases) {
      useEvent({
        slug: 'grand-opening',
        name: 'Grand Opening',
        adminKey: 'event-secret',
        ticketCurrency: 'USD',
        paidTicketsEnabled: raw,
        ticketPriceCents: 500,
      });
      assert.equal(run('event-secret').body.insights.paidTicketsEnabled, expected, String(raw));
    }

    const priceCases = [
      [500, 500],
      ['500', 500],
      [10.9, 10],
      [-4, 0],
      ['nope', 0],
    ];
    for (const [raw, expected] of priceCases) {
      useEvent({
        slug: 'grand-opening',
        name: 'Grand Opening',
        adminKey: 'event-secret',
        ticketCurrency: 'USD',
        paidTicketsEnabled: 'TRUE',
        ticketPriceCents: raw,
      });
      assert.equal(run('event-secret').body.insights.ticketPriceCents, expected, String(raw));
    }

    useEvent({
      slug: 'grand-opening',
      name: 'Grand Opening',
      adminKey: 'event-secret',
      ticketCurrency: '',
      paidTicketsEnabled: 'FALSE',
      ticketPriceCents: 0,
    });
    assert.equal(run('event-secret').body.insights.currency, 'usd');

    useEvent({
      slug: 'grand-opening',
      name: 'Grand Opening',
      adminKey: 'event-secret',
      ticketCurrency: 'usdollar-long',
      paidTicketsEnabled: 'FALSE',
      ticketPriceCents: 0,
    });
    assert.equal(run('event-secret').body.insights.currency, 'usdollar');
  });

  it('keeps an empty pool list with zero totals when nobody has entered', () => {
    const insights = run('event-secret').body.insights;
    assert.deepEqual(insights.totals, {
      uniqueParticipants: 0,
      paidParticipants: 0,
      totalTickets: 0,
      freeTickets: 0,
      paidTickets: 0,
      paidPurchases: 0,
      totalRevenueCents: 0,
      revenueByCurrency: {},
      newsletterOptIns: 0,
      newsletterBonusTickets: 0,
    });
    assert.deepEqual(insights.pools.map((pool) => pool.raffleId), ['grand-prize', 'door-prize']);
    assert.equal(insights.pools[0].tickets, 0);
    assert.equal(insights.pools[0].active, true);
    assert.equal(insights.pools[1].active, false);
    assert.deepEqual(insights.recentEntries, []);
    assert.deepEqual(insights.topEntrants, []);
    assert.deepEqual(insights.revenueByDay, []);
  });
});

describe('handleAdminInsights_ ticket and revenue totals', () => {
  const tBroken = new Date('2026-03-13T12:00:00.000Z');
  const tGhost = new Date('2026-03-14T12:00:00.000Z');
  const tEuro = new Date('2026-03-14T20:00:00.000Z');
  const tPatFree = new Date('2026-03-15T15:00:00.000Z');
  const tPatNamed = new Date('2026-03-15T16:00:00.000Z');
  const tSessionFirst = new Date('2026-03-16T02:30:00.000Z');
  const tNoSession = new Date('2026-03-16T18:00:00.000Z');
  const tSessionSecond = new Date('2026-03-17T12:00:00.000Z');
  const tLegacy = new Date('2026-03-17T18:00:00.000Z');
  const tRefund = new Date('2026-03-18T12:00:00.000Z');

  function loadSampleRows() {
    fixture.rows = [
      entryRow({
        ts: tPatFree,
        phone: '5550001111',
        raffleId: 'grand-prize',
        tickets: 2,
        extras: { __newsletterOptIn: true, __newsletterBonusEarned: 2 },
      }),
      entryRow({
        ts: tPatNamed,
        name: 'Pat Lee',
        email: 'pat.lee@example.com',
        phone: '5550001111',
        raffleId: 'door-prize',
        tickets: 1,
        extras: { __newsletterOptIn: true, __newsletterBonusEarned: 5 },
      }),
      entryRow({
        ts: tSessionFirst,
        name: 'Sam',
        email: 'sam@example.com',
        phone: '5550002222',
        raffleId: 'grand-prize',
        tickets: 3,
        extras: {
          __paid: true,
          __stripeSessionId: 'sess_1',
          __paidAmountCents: 1500.9,
          __paidCurrency: 'USD',
          __newsletterOptIn: true,
          __newsletterBonusEarned: 99,
        },
      }),
      entryRow({
        ts: tSessionSecond,
        name: 'Sam',
        email: 'sam@example.com',
        phone: '5550002222',
        raffleId: 'door-prize',
        tickets: 1,
        extras: {
          __paid: true,
          __stripeSessionId: 'sess_1',
          __paidAmountCents: 1500.9,
          __paidCurrency: 'USD',
        },
      }),
      entryRow({
        ts: tEuro,
        name: 'Eu',
        email: 'eu@example.com',
        phone: '5550003333',
        raffleId: 'grand-prize',
        tickets: 2,
        extras: {
          __paid: true,
          __stripeSessionId: 'sess_2',
          __paidAmountCents: 800,
          __paidCurrency: 'eur',
        },
      }),
      entryRow({
        ts: tRefund,
        name: 'Refunded',
        email: 'refund@example.com',
        phone: '5550004444',
        raffleId: 'grand-prize',
        tickets: 9,
        extras: {
          __paid: true,
          __refunded: true,
          __stripeSessionId: 'sess_3',
          __paidAmountCents: 9000,
          __paidCurrency: 'USD',
          __newsletterOptIn: true,
          __newsletterBonus: true,
          __newsletterBonusTickets: 4,
        },
      }),
      entryRow({
        ts: new Date('2026-03-20T12:00:00.000Z'),
        phone: '5550009991',
        raffleId: 'grand-prize',
        tickets: 100,
        isTest: 'TRUE',
        extras: { __paid: true, __stripeSessionId: 'sess_test', __paidAmountCents: 99999 },
      }),
      entryRow({
        ts: new Date('2026-03-21T12:00:00.000Z'),
        phone: '5550009992',
        raffleId: 'grand-prize',
        tickets: 400,
        isTest: true,
      }),
      entryRow({
        ts: new Date('2026-03-22T12:00:00.000Z'),
        phone: '5550009993',
        raffleId: 'grand-prize',
        tickets: 50,
        isTest: 'true',
      }),
      entryRow({
        ts: tGhost,
        name: 'Ghost',
        phone: '5550005555',
        raffleId: 'ghost',
        tickets: 5,
      }),
      entryRow({
        ts: tNoSession,
        name: 'No Session',
        email: 'nosession@example.com',
        phone: '5550006666',
        raffleId: 'grand-prize',
        tickets: 6,
        extras: { __paid: true, __paidAmountCents: 4000, __paidCurrency: 'USD' },
      }),
      entryRow({
        ts: new Date('2026-03-23T12:00:00.000Z'),
        slug: 'other-event',
        phone: '5550000000',
        raffleId: 'grand-prize',
        tickets: 80,
      }),
      entryRow({
        ts: tLegacy,
        name: 'Legacy',
        phone: '5550007777',
        raffleId: 'door-prize',
        tickets: 7,
        extras: { __newsletterBonus: true, __newsletterBonusTickets: 3 },
      }),
      entryRow({
        ts: tBroken,
        name: 'Broken',
        phone: '5550008888',
        raffleId: 'grand-prize',
        tickets: 1,
        extras: '{',
      }),
    ];
  }

  it('counts each purchase once and leaves out tests, refunds, and other events', () => {
    loadSampleRows();
    const result = run('event-secret');
    assert.equal(result.status, 200);
    const insights = result.body.insights;

    assert.equal(insights.currency, 'usd');
    assert.equal(insights.ticketPriceCents, 500);
    assert.deepEqual(insights.totals, {
      uniqueParticipants: 7,
      paidParticipants: 3,
      totalTickets: 28,
      freeTickets: 16,
      paidTickets: 12,
      paidPurchases: 2,
      totalRevenueCents: 2300,
      revenueByCurrency: { usd: 1500, eur: 800 },
      newsletterOptIns: 2,
      newsletterBonusTickets: 8,
    });
    assert.deepEqual(insights.revenueByDay, [
      { day: '2026-03-14', amountCents: 800 },
      { day: '2026-03-16', amountCents: 1500 },
    ]);
    assert.deepEqual(insights.pools, [
      {
        raffleId: 'grand-prize',
        title: 'Grand prize',
        drawAt: '2026-04-01T18:00:00.000Z',
        active: true,
        tickets: 14,
        freeTickets: 3,
        paidTickets: 11,
        people: 5,
        paidPeople: 3,
        paidPurchases: 2,
        paidRevenueCents: 2300,
      },
      {
        raffleId: 'door-prize',
        title: 'Door prize',
        drawAt: '',
        active: false,
        tickets: 9,
        freeTickets: 8,
        paidTickets: 1,
        people: 3,
        paidPeople: 1,
        paidPurchases: 0,
        paidRevenueCents: 0,
      },
      {
        raffleId: 'ghost',
        title: 'ghost',
        drawAt: '',
        active: false,
        tickets: 5,
        freeTickets: 5,
        paidTickets: 0,
        people: 1,
        paidPeople: 0,
        paidPurchases: 0,
        paidRevenueCents: 0,
      },
    ]);
    assert.deepEqual(insights.topEntrants, [
      { phoneLast4: '7777', name: 'Legacy', emailMasked: '', tickets: 7, freeTickets: 7, paidTickets: 0, paidCents: 0 },
      { phoneLast4: '6666', name: 'No Session', emailMasked: 'no***@example.com', tickets: 6, freeTickets: 0, paidTickets: 6, paidCents: 0 },
      { phoneLast4: '5555', name: 'Ghost', emailMasked: '', tickets: 5, freeTickets: 5, paidTickets: 0, paidCents: 0 },
      { phoneLast4: '2222', name: 'Sam', emailMasked: 'sa***@example.com', tickets: 4, freeTickets: 0, paidTickets: 4, paidCents: 1500 },
      { phoneLast4: '1111', name: 'Pat Lee', emailMasked: 'pa***@example.com', tickets: 3, freeTickets: 3, paidTickets: 0, paidCents: 0 },
      { phoneLast4: '3333', name: 'Eu', emailMasked: 'e***@example.com', tickets: 2, freeTickets: 0, paidTickets: 2, paidCents: 800 },
      { phoneLast4: '8888', name: 'Broken', emailMasked: '', tickets: 1, freeTickets: 1, paidTickets: 0, paidCents: 0 },
    ]);
    assert.deepEqual(insights.recentEntries, [
      {
        ts: tRefund.toISOString(),
        name: 'Refunded',
        emailMasked: 're***@example.com',
        phoneLast4: '4444',
        raffleId: 'grand-prize',
        tickets: 9,
        paid: true,
        refunded: true,
        stripeSessionId: 'sess_3',
        paidAmountCents: 9000,
        currency: 'usd',
      },
      {
        ts: tLegacy.toISOString(),
        name: 'Legacy',
        emailMasked: '',
        phoneLast4: '7777',
        raffleId: 'door-prize',
        tickets: 7,
        paid: false,
        refunded: false,
        stripeSessionId: '',
        paidAmountCents: 0,
        currency: '',
      },
      {
        ts: tSessionSecond.toISOString(),
        name: 'Sam',
        emailMasked: 'sa***@example.com',
        phoneLast4: '2222',
        raffleId: 'door-prize',
        tickets: 1,
        paid: true,
        refunded: false,
        stripeSessionId: 'sess_1',
        paidAmountCents: 1500,
        currency: 'usd',
      },
      {
        ts: tNoSession.toISOString(),
        name: 'No Session',
        emailMasked: 'no***@example.com',
        phoneLast4: '6666',
        raffleId: 'grand-prize',
        tickets: 6,
        paid: true,
        refunded: false,
        stripeSessionId: '',
        paidAmountCents: 4000,
        currency: 'usd',
      },
      {
        ts: tSessionFirst.toISOString(),
        name: 'Sam',
        emailMasked: 'sa***@example.com',
        phoneLast4: '2222',
        raffleId: 'grand-prize',
        tickets: 3,
        paid: true,
        refunded: false,
        stripeSessionId: 'sess_1',
        paidAmountCents: 1500,
        currency: 'usd',
      },
      {
        ts: tPatNamed.toISOString(),
        name: 'Pat Lee',
        emailMasked: 'pa***@example.com',
        phoneLast4: '1111',
        raffleId: 'door-prize',
        tickets: 1,
        paid: false,
        refunded: false,
        stripeSessionId: '',
        paidAmountCents: 0,
        currency: '',
      },
      {
        ts: tPatFree.toISOString(),
        name: '',
        emailMasked: '',
        phoneLast4: '1111',
        raffleId: 'grand-prize',
        tickets: 2,
        paid: false,
        refunded: false,
        stripeSessionId: '',
        paidAmountCents: 0,
        currency: '',
      },
      {
        ts: tEuro.toISOString(),
        name: 'Eu',
        emailMasked: 'e***@example.com',
        phoneLast4: '3333',
        raffleId: 'grand-prize',
        tickets: 2,
        paid: true,
        refunded: false,
        stripeSessionId: 'sess_2',
        paidAmountCents: 800,
        currency: 'eur',
      },
      {
        ts: tGhost.toISOString(),
        name: 'Ghost',
        emailMasked: '',
        phoneLast4: '5555',
        raffleId: 'ghost',
        tickets: 5,
        paid: false,
        refunded: false,
        stripeSessionId: '',
        paidAmountCents: 0,
        currency: '',
      },
      {
        ts: tBroken.toISOString(),
        name: 'Broken',
        emailMasked: '',
        phoneLast4: '8888',
        raffleId: 'grand-prize',
        tickets: 1,
        paid: false,
        refunded: false,
        stripeSessionId: '',
        paidAmountCents: 0,
        currency: '',
      },
    ]);
    for (const entry of insights.recentEntries) {
      assert.equal(Object.hasOwn(entry, 'tsMs'), false);
    }
    assert.match(insights.lastUpdated, /^\d{4}-\d{2}-\d{2}T/);
  });

  it('keeps the 50 newest rows and the 25 entrants with the most tickets', () => {
    const rows = [];
    for (let i = 0; i < 51; i += 1) {
      rows.push(entryRow({
        ts: new Date(Date.UTC(2026, 0, 1, 0, i)),
        name: `N${i}`,
        phone: String(3000 + i),
        raffleId: 'grand-prize',
        tickets: 1,
      }));
    }
    for (let tickets = 1; tickets <= 26; tickets += 1) {
      rows.push(entryRow({
        ts: new Date(Date.UTC(2025, 0, 1)),
        name: `E${tickets}`,
        phone: String(5000 + tickets),
        raffleId: 'door-prize',
        tickets,
      }));
    }
    fixture.rows = rows;

    const insights = run('event-secret').body.insights;
    assert.equal(insights.recentEntries.length, 50);
    assert.equal(insights.recentEntries[0].name, 'N50');
    assert.equal(insights.recentEntries.at(-1).name, 'N1');
    assert.equal(insights.recentEntries.some((entry) => entry.name === 'N0'), false);
    assert.equal(insights.topEntrants.length, 25);
    assert.equal(insights.topEntrants[0].tickets, 26);
    assert.equal(insights.topEntrants.at(-1).tickets, 2);
    assert.equal(insights.topEntrants.some((entrant) => entrant.tickets === 1 && entrant.name === 'E1'), false);
  });
});
