import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { beforeEach, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

/**
 * Executes Apps Script save-config validation in place. Code.gs is not an ES
 * module, and open bugfix PRs already edit it. Sheet writes are stubbed.
 * Id and image checks are the real script helpers.
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

function loadSave() {
  const body = [
    'var saveFixture = {',
    '  masterKey: "",',
    '  event: null,',
    '  lookups: 0,',
    '  failLookupAt: 0,',
    '  writes: [],',
    '  raffleWrites: [],',
    '  writeError: null,',
    '  rafflesOut: [],',
    '};',
    'function jsonResponse(obj, status) {',
    '  return { status: status || 200, body: obj };',
    '}',
    'function getAdminMasterKey_() { return saveFixture.masterKey || ""; }',
    'function findEventRow_(slug) {',
    '  saveFixture.lookups += 1;',
    '  if (saveFixture.failLookupAt && saveFixture.lookups === saveFixture.failLookupAt) return null;',
    '  var ev = saveFixture.event;',
    '  if (!ev || String(slug).trim() !== String(ev.slug).trim()) return null;',
    '  return { headers: ev.headers, record: ev.record };',
    '}',
    'function updateEventCellsForSlug_(slug, patch) {',
    '  if (saveFixture.writeError) throw saveFixture.writeError;',
    '  saveFixture.writes.push({ slug: slug, patch: patch });',
    '}',
    'function replaceRafflesForSlug_(slug, raffles) {',
    '  saveFixture.raffleWrites.push({ slug: slug, raffles: raffles });',
    '}',
    'function getRafflesAllForSlug_() { return saveFixture.rafflesOut || []; }',
    sliceFunction('recordToObject_'),
    sliceFunction('isValidRaffleId_'),
    sliceFunction('isSafeHttpsImageUrl_'),
    sliceFunction('getBaseTicketsPerEntry_'),
    sliceFunction('getNewsletterBonusTickets_'),
    sliceFunction('isNewsletterBonusEnabled_'),
    sliceFunction('validateAdminKey_'),
    sliceFunction('handleSaveEventConfig_'),
    'return { handleSaveEventConfig: handleSaveEventConfig_, fixture: saveFixture };',
  ].join('\n');
  return new Function(body)();
}

const { handleSaveEventConfig, fixture } = loadSave();

function useEvent(fields) {
  const headers = Object.keys(fields);
  fixture.event = {
    slug: fields.slug,
    headers,
    record: headers.map((header) => fields[header]),
  };
}

function prize(overrides = {}) {
  return {
    raffleId: 'grand-prize',
    title: 'Grand prize',
    subtitle: '',
    imageUrl: '',
    valueLabel: '',
    drawAt: '',
    ...overrides,
  };
}

function save(data) {
  return handleSaveEventConfig({
    slug: 'grand-opening',
    adminKey: 'event-secret',
    event: {},
    raffles: [prize()],
    ...data,
  });
}

beforeEach(() => {
  fixture.masterKey = '';
  fixture.lookups = 0;
  fixture.failLookupAt = 0;
  fixture.writes = [];
  fixture.raffleWrites = [];
  fixture.writeError = null;
  fixture.rafflesOut = [{ raffleId: 'from-sheet', title: 'From sheet' }];
  useEvent({
    slug: 'grand-opening',
    adminKey: 'event-secret',
    name: 'Grand Opening',
    theme: 'light',
    active: 'TRUE',
    defaultTestMode: 'false',
    paidTicketsEnabled: true,
    ticketPriceCents: -4,
    ticketCurrency: '',
    paidTicketsMaxPerPurchase: 0,
    baseTicketsPerEntry: 1.9,
    newsletterBonusEnabled: 'TRUE',
    newsletterBonusTickets: 3.2,
  });
});

describe('handleSaveEventConfig_ access', () => {
  it('rejects a blank slug and a key that matches neither secret, and does not write', () => {
    assert.deepEqual(save({ slug: '' }).body, { ok: false, error: 'unauthorized' });
    assert.equal(save({ slug: '' }).status, 401);
    assert.equal(save({ adminKey: 'nope' }).status, 401);
    assert.equal(save({ slug: 'other-event' }).status, 401);
    assert.equal(fixture.writes.length, 0);
    assert.equal(fixture.raffleWrites.length, 0);
  });

  it('returns event_not_found only when the row disappears after the key check', () => {
    fixture.failLookupAt = 2;
    const missing = save({});
    assert.equal(missing.status, 404);
    assert.deepEqual(missing.body, { ok: false, error: 'event_not_found' });
    assert.equal(fixture.writes.length, 0);
  });
});

describe('handleSaveEventConfig_ event patch', () => {
  it('rejects a non-https logo before theme cleanup or raffle checks', () => {
    const event = { logoUrl: 'http://example.com/logo.png', theme: 'blue', bonusRulesJson: '{' };
    const result = save({ event, raffles: [] });
    assert.equal(result.status, 400);
    assert.deepEqual(result.body, { ok: false, error: 'image_url_must_be_https_or_empty' });
    assert.equal(event.theme, 'blue');
    assert.equal(fixture.writes.length, 0);
  });

  it('rejects bonus JSON that does not parse and allows blank or valid JSON', () => {
    assert.equal(save({ event: { bonusRulesJson: '{' } }).body.error, 'invalid_bonus_rules_json');
    assert.equal(save({ event: { bonusRulesJson: '   ' } }).status, 200);
    assert.equal(save({ event: { bonusRulesJson: '{"review":1}' } }).status, 200);
  });

  it('strips a theme that is neither light nor dark, and writes light through', () => {
    const dropped = { theme: 'blue', logoUrl: '  https://cdn.example.com/logo.png' };
    assert.equal(save({ event: dropped }).status, 200);
    assert.equal(Object.hasOwn(dropped, 'theme'), false);
    assert.deepEqual(fixture.writes[0], { slug: 'grand-opening', patch: dropped });

    fixture.writes = [];
    const kept = { theme: 'light' };
    assert.equal(save({ event: kept }).status, 200);
    assert.equal(fixture.writes[0].patch.theme, 'light');
  });
});

describe('handleSaveEventConfig_ raffle rows', () => {
  it('requires an array of 1 to 24 prizes', () => {
    for (const raffles of [undefined, null, {}, 'grand-prize', []]) {
      const result = save({ raffles });
      assert.equal(result.status, 400);
      assert.equal(result.body.error, 'need_at_least_one_raffle');
    }
    const tooMany = Array.from({ length: 25 }, (_, i) => prize({ raffleId: `prize-${i}`, title: `Prize ${i}` }));
    assert.equal(save({ raffles: tooMany }).body.error, 'too_many_raffles');
    assert.equal(fixture.writes.length, 0);

    const exactly24 = Array.from({ length: 24 }, (_, i) => prize({ raffleId: `prize-${i}`, title: `Prize ${i}` }));
    assert.equal(save({ raffles: exactly24 }).status, 200);
    assert.equal(fixture.raffleWrites[0].raffles.length, 24);
  });

  it('rejects bad ids, duplicates after trim, and title or subtitle bounds', () => {
    assert.deepEqual(
      save({ raffles: [prize({ raffleId: 'has space' })] }).body,
      { ok: false, error: 'invalid_raffle_id', raffleIndex: 0 },
    );
    assert.equal(
      save({ raffles: [prize({ raffleId: 'a'.repeat(49) })] }).body.error,
      'invalid_raffle_id',
    );
    assert.equal(save({ raffles: [prize({ raffleId: '', id: '' })] }).body.error, 'invalid_raffle_id');

    const dup = save({
      raffles: [prize(), prize({ raffleId: ' grand-prize ', title: 'Second' })],
    });
    assert.deepEqual(dup.body, { ok: false, error: 'duplicate_raffle_id', raffleId: 'grand-prize' });

    assert.equal(save({ raffles: [prize({ title: '   ' })] }).body.error, 'invalid_raffle_title');
    assert.equal(save({ raffles: [prize({ title: 'a'.repeat(201) })] }).body.error, 'invalid_raffle_title');
    assert.equal(
      save({ raffles: [prize(), prize({ raffleId: 'door', title: '' })] }).body.raffleIndex,
      1,
    );
    assert.equal(save({ raffles: [prize({ subtitle: 's'.repeat(501) })] }).body.error, 'invalid_raffle_subtitle');
    assert.equal(save({ raffles: [prize({ title: 'a'.repeat(200), subtitle: 's'.repeat(500) })] }).status, 200);
  });

  it('rejects unsafe images, long value labels, and unparseable draw times', () => {
    assert.deepEqual(
      save({ raffles: [prize({ imageUrl: 'http://example.com/p.png' })] }).body,
      { ok: false, error: 'image_url_must_be_https_or_empty', raffleIndex: 0 },
    );
    assert.equal(
      save({ raffles: [prize({ imageUrl: `https://example.com/${'a'.repeat(2048)}` })] }).body.error,
      'image_url_must_be_https_or_empty',
    );
    assert.equal(save({ raffles: [prize({ valueLabel: 'v'.repeat(161) })] }).body.error, 'invalid_raffle_value_label');
    assert.equal(save({ raffles: [prize({ drawAt: 'x'.repeat(51) })] }).body.error, 'invalid_raffle_draw_at');
    assert.equal(save({ raffles: [prize({ drawAt: 'not-a-date' })] }).body.error, 'invalid_raffle_draw_at');

    const ok = save({
      raffles: [prize({
        id: 'door-prize',
        raffleId: '',
        imageUrl: ' /raffle-images/grand-opening/prize.jpg',
        valueLabel: 'v'.repeat(160),
        drawAt: ' 2026-04-01T18:00:00.000Z',
      })],
    });
    assert.equal(ok.status, 200);
    assert.equal(fixture.writes.length, 1);
  });
});

describe('handleSaveEventConfig_ write result', () => {
  it('returns the sheet error and a 500 when the row is gone after the write', () => {
    fixture.writeError = new Error('sheet locked');
    const failed = save({});
    assert.equal(failed.status, 500);
    assert.deepEqual(failed.body, { ok: false, error: 'sheet locked' });
    assert.equal(fixture.raffleWrites.length, 0);

    fixture.writeError = null;
    fixture.lookups = 0;
    fixture.failLookupAt = 3;
    const gone = save({});
    assert.equal(gone.status, 500);
    assert.equal(gone.body.error, 'event_not_found_after_save');
  });

  it('echoes clamped ticket fields and the post-save raffle read', () => {
    const result = save({ slug: ' grand-opening ', adminKey: '  event-secret  ' });
    assert.equal(result.status, 200);
    assert.equal(result.body.ok, true);
    assert.equal(result.body.slug, ' grand-opening ');
    assert.deepEqual(result.body.raffles, [{ raffleId: 'from-sheet', title: 'From sheet' }]);
    assert.equal(result.body.event.name, 'Grand Opening');
    assert.equal(result.body.event.theme, 'light');
    assert.equal(result.body.event.active, true);
    assert.equal(result.body.event.defaultTestMode, false);
    assert.equal(result.body.event.paidTicketsEnabled, true);
    assert.equal(result.body.event.primaryColor, '#c9a227');
    assert.equal(result.body.event.ticketPriceCents, 0);
    assert.equal(result.body.event.ticketCurrency, 'usd');
    assert.equal(result.body.event.paidTicketsMaxPerPurchase, 100);
    assert.equal(result.body.event.baseTicketsPerEntry, 1);
    assert.equal(result.body.event.newsletterBonusEnabled, true);
    assert.equal(result.body.event.newsletterBonusTickets, 3);
    assert.equal(fixture.writes[0].slug, ' grand-opening ');
  });
});
