import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { beforeEach, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

/**
 * Admin stats (`handleAdminStats_`) is the smaller totals endpoint: unique
 * phones, entry rows, and per-pool ticket sums. Insights already covers refunds
 * and test-row exclusion, so these cases use non-test rows only and do not
 * assert whether a test row would be counted.
 * Code.gs is not edited. Sheet reads are stubbed.
 */
const codePath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '../google-apps-script/Code.gs',
);
const source = fs.readFileSync(codePath, 'utf8');

const FIXED_NOW = '2026-06-15T12:00:00.000Z';

function previousCodeChar(text, index) {
  for (let i = index - 1; i >= 0; i -= 1) {
    const c = text[i];
    if (c !== ' ' && c !== '\t' && c !== '\n' && c !== '\r') return c;
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
  assert.notEqual(previousCodeChar(source, start), '.', `${name} is a method, not a top-level function`);
  const open = source.indexOf('{', start);
  const end = endOfFunction(source, open);
  const nextTop = source.indexOf('\nfunction ', start);
  assert.ok(nextTop === -1 || nextTop > end, `scanner swallowed the function after ${name}`);
  return source.slice(start, end + 1);
}

function loadStats() {
  const body = [
    'var statsFixture = {',
    '  masterKey: "",',
    '  event: null,',
    '  rows: [],',
    '  raffles: [],',
    '  entryReads: 0,',
    '  raffleReads: 0,',
    '  entrySlug: null,',
    '  raffleSlug: null,',
    '  nowMs: 0',
    '};',
    'var RealDate = OuterDate;',
    'function ShopDate(value) {',
    '  if (arguments.length === 0) return new RealDate(statsFixture.nowMs);',
    '  return new RealDate(value);',
    '}',
    'var Date = ShopDate;',
    'function jsonResponse(obj, status) {',
    '  return { status: status || 200, body: obj };',
    '}',
    'function getAdminMasterKey_() { return statsFixture.masterKey || ""; }',
    'function findEventRow_(slug) {',
    '  var ev = statsFixture.event;',
    '  if (!ev || String(slug).trim() !== String(ev.slug).trim()) return null;',
    '  return { headers: ev.headers, record: ev.record };',
    '}',
    'function readEntriesForSlug_(slug) {',
    '  statsFixture.entryReads += 1;',
    '  statsFixture.entrySlug = slug;',
    '  return statsFixture.rows || [];',
    '}',
    'function getRafflesForSlug_(slug) {',
    '  statsFixture.raffleReads += 1;',
    '  statsFixture.raffleSlug = slug;',
    '  return statsFixture.raffles || [];',
    '}',
    sliceFunction('recordToObject_'),
    sliceFunction('validateAdminKey_'),
    sliceFunction('handleAdminStats_'),
    'return { handleAdminStats_, fixture: statsFixture };',
  ].join('\n');
  return new Function('OuterDate', body)(Date);
}

const { handleAdminStats_, fixture } = loadStats();

function useEvent(fields) {
  const headers = Object.keys(fields);
  fixture.event = {
    slug: fields.slug,
    headers,
    record: headers.map((header) => fields[header]),
  };
}

function entryRow({ slug = 'grand-opening', phone = '', raffleId = '', tickets = 0 } = {}) {
  const row = Array(14).fill('');
  row[1] = slug;
  row[3] = phone;
  row[5] = raffleId;
  row[9] = tickets;
  row[10] = 'FALSE';
  return row;
}

beforeEach(() => {
  fixture.masterKey = '';
  fixture.entryReads = 0;
  fixture.raffleReads = 0;
  fixture.entrySlug = null;
  fixture.raffleSlug = null;
  fixture.nowMs = Date.parse(FIXED_NOW);
  fixture.rows = [];
  fixture.raffles = [
    { id: 'grand-prize', title: 'Grand prize' },
    { id: 'door-prize', title: 'Door prize' },
    { id: 'unused-pool', title: 'Unused pool' },
    { id: 'blank-title', title: '' },
  ];
  useEvent({ slug: 'grand-opening', adminKey: 'event-secret' });
});

describe('handleAdminStats_ access', () => {
  it('rejects a missing slug or a wrong key before reading entries or prize pools', () => {
    fixture.rows = [entryRow({ phone: '5125550100', raffleId: 'grand-prize', tickets: 4 })];

    assert.deepEqual(handleAdminStats_({}), {
      status: 401,
      body: { ok: false, error: 'unauthorized' },
    });
    assert.deepEqual(handleAdminStats_({ slug: 'grand-opening', adminKey: 'nope' }), {
      status: 401,
      body: { ok: false, error: 'unauthorized' },
    });
    assert.equal(fixture.entryReads, 0);
    assert.equal(fixture.raffleReads, 0);
  });
});

describe('handleAdminStats_ totals', () => {
  it('counts each phone once, sums pool tickets, and skips pools that have no rows', () => {
    fixture.rows = [
      entryRow({ phone: '5125550100', raffleId: 'grand-prize', tickets: 2 }),
      entryRow({ phone: '5125550100', raffleId: 'grand-prize', tickets: 1.5 }),
      entryRow({ phone: '5125550199', raffleId: 'door-prize', tickets: 3 }),
      entryRow({ phone: '5125550100', raffleId: 'door-prize', tickets: 'nope' }),
      entryRow({ slug: 'other-event', phone: '5125550177', raffleId: 'grand-prize', tickets: 9 }),
      entryRow({ phone: '5125550199', raffleId: 'mystery', tickets: 4 }),
      entryRow({ phone: '5125550101', raffleId: 'blank-title', tickets: '2' }),
    ];

    const result = handleAdminStats_({ slug: 'grand-opening', adminKey: 'event-secret' });

    assert.equal(result.status, 200);
    assert.equal(result.body.ok, true);
    assert.deepEqual(result.body.stats, {
      slug: 'grand-opening',
      totalParticipants: 3,
      uniqueParticipants: 3,
      entryRowCount: 6,
      entriesByRaffle: {
        'grand-prize': { raffleTitle: 'Grand prize', tickets: 3.5, people: 1 },
        'door-prize': { raffleTitle: 'Door prize', tickets: 3, people: 2 },
        mystery: { raffleTitle: 'mystery', tickets: 4, people: 1 },
        'blank-title': { raffleTitle: 'blank-title', tickets: 2, people: 1 },
      },
      lastUpdated: FIXED_NOW,
    });
    assert.equal(Object.hasOwn(result.body.stats.entriesByRaffle, 'unused-pool'), false);
    assert.equal(fixture.entryReads, 1);
    assert.equal(fixture.raffleReads, 1);
    assert.equal(fixture.entrySlug, 'grand-opening');
    assert.equal(fixture.raffleSlug, 'grand-opening');
  });

  it('returns zero totals when the authorized event has no entry rows', () => {
    const result = handleAdminStats_({ slug: 'grand-opening', adminKey: 'event-secret' });

    assert.equal(result.status, 200);
    assert.deepEqual(result.body.stats, {
      slug: 'grand-opening',
      totalParticipants: 0,
      uniqueParticipants: 0,
      entryRowCount: 0,
      entriesByRaffle: {},
      lastUpdated: FIXED_NOW,
    });
    assert.equal(fixture.entryReads, 1);
    assert.equal(fixture.raffleReads, 1);
  });
});
