import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

/**
 * Paid tickets are written only after HMAC verification, and the Entries row
 * is what later refunds and insights use to count money. Code.gs is not an ES
 * module, and other PRs already edit the apply/refund handlers, so these tests
 * execute the signature check and the row writer in place.
 */
const codePath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '../google-apps-script/Code.gs',
);
const source = fs.readFileSync(codePath, 'utf8');

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

function loadPaidLedger() {
  const src = [
    'var SHEET_ENTRIES = "Entries";',
    'var fixture = { secret: "", sheet: true, appended: [], hmacCalls: [], nowMs: null };',
    'var RealDate = OuterDate;',
    'function ShopDate(value) {',
    '  if (arguments.length === 0) {',
    '    return fixture.nowMs == null ? new RealDate() : new RealDate(fixture.nowMs);',
    '  }',
    '  return new RealDate(value);',
    '}',
    'var Date = ShopDate;',
    'var PropertiesService = {',
    '  getScriptProperties: function () {',
    '    return {',
    '      getProperty: function (key) {',
    '        if (key === "PAID_PURCHASE_SECRET") return fixture.secret;',
    '        return null;',
    '      }',
    '    };',
    '  }',
    '};',
    'var Utilities = {',
    '  computeHmacSha256Signature: function (payload, secret) {',
    '    fixture.hmacCalls.push({ payload: String(payload), secret: String(secret) });',
    '    var buf = crypto.createHmac("sha256", String(secret)).update(String(payload), "utf8").digest();',
    '    var out = [];',
    '    for (var i = 0; i < buf.length; i++) out.push(buf[i]);',
    '    return out;',
    '  }',
    '};',
    'function getSpreadsheet_() {',
    '  return {',
    '    getSheetByName: function (name) {',
    '      if (!fixture.sheet || name !== SHEET_ENTRIES) return null;',
    '      return {',
    '        appendRow: function (row) { fixture.appended.push(row); }',
    '      };',
    '    }',
    '  };',
    '}',
    sliceFunction('bytesToHex_'),
    sliceFunction('constantTimeEqualHex_'),
    sliceFunction('getPaidPurchaseSecret_'),
    sliceFunction('verifyPaidPurchaseSignature_'),
    sliceFunction('appendEntry_'),
    sliceFunction('appendPaidEntryRow_'),
    'return { fixture, verifyPaidPurchaseSignature_, appendPaidEntryRow_ };',
  ].join('\n');
  return new Function('crypto', 'OuterDate', src)(crypto, Date);
}

function hmacHex(payload, secret) {
  return crypto.createHmac('sha256', secret).update(payload, 'utf8').digest('hex');
}

describe('verifyPaidPurchaseSignature_', () => {
  const payload = '{"slug":"grand-opening", "totalPaidTickets":2}';
  const secret = 'paid-secret';

  it('rejects every payload when the shared secret is missing, without computing an HMAC', () => {
    for (const missing of ['', null]) {
      const { fixture, verifyPaidPurchaseSignature_ } = loadPaidLedger();
      fixture.secret = missing;
      assert.equal(verifyPaidPurchaseSignature_(payload, hmacHex(payload, 'anything')), false);
      assert.deepEqual(fixture.hmacCalls, []);
    }
  });

  it('accepts only the lowercase hex HMAC of the exact payload string', () => {
    const { fixture, verifyPaidPurchaseSignature_ } = loadPaidLedger();
    fixture.secret = secret;
    const hex = hmacHex(payload, secret);

    assert.equal(verifyPaidPurchaseSignature_(payload, hex), true);
    assert.equal(verifyPaidPurchaseSignature_(payload, hex.toUpperCase()), false);
    const flipped = hex.endsWith('0') ? `${hex.slice(0, -1)}1` : `${hex.slice(0, -1)}0`;
    assert.equal(verifyPaidPurchaseSignature_(payload, flipped), false);
    assert.equal(verifyPaidPurchaseSignature_(payload, ''), false);
    assert.equal(verifyPaidPurchaseSignature_(null, hex), false);
    assert.deepEqual(fixture.hmacCalls, [
      { payload, secret },
      { payload, secret },
      { payload, secret },
      { payload, secret },
      { payload: '', secret },
    ]);
  });

  it('signs a missing payload as an empty string', () => {
    const { fixture, verifyPaidPurchaseSignature_ } = loadPaidLedger();
    fixture.secret = secret;
    assert.equal(verifyPaidPurchaseSignature_(null, hmacHex('', secret)), true);
    assert.deepEqual(fixture.hmacCalls, [{ payload: '', secret }]);
  });
});

describe('appendPaidEntryRow_', () => {
  const baseArgs = [
    'grand-opening',
    'Ada Lovelace',
    '5551112222',
    'ada@example.com',
    'grand-prize',
    4,
    '203.0.113.8',
    'stripe-webhook',
    'tok/1',
  ];

  it('writes one Entries row whose extras are the paid-ticket ledger', () => {
    const { fixture, appendPaidEntryRow_ } = loadPaidLedger();
    appendPaidEntryRow_(...baseArgs, {
      stripeSessionId: 'cs_test_1',
      paidAt: '2026-07-04T15:00:00.000Z',
      amountTotal: 12.9,
      currency: 'USD',
    });

    assert.equal(fixture.appended.length, 1);
    const row = fixture.appended[0];
    assert.equal(row.length, 14);
    assert.ok(row[0] instanceof Date);
    assert.equal(row[1], 'grand-opening');
    assert.equal(row[2], 'Ada Lovelace');
    assert.equal(row[3], '5551112222');
    assert.equal(row[4], 'ada@example.com');
    assert.equal(row[5], 'grand-prize');
    assert.deepEqual(row.slice(6, 9), ['FALSE', 'FALSE', 'FALSE']);
    assert.equal(row[9], 4);
    assert.equal(row[10], 'FALSE');
    assert.equal(row[11], '203.0.113.8');
    assert.equal(row[12], 'stripe-webhook');
    assert.deepEqual(JSON.parse(row[13]), {
      __paid: true,
      __paidTickets: 4,
      __stripeSessionId: 'cs_test_1',
      __purchaseAt: '2026-07-04T15:00:00.000Z',
      __paidAmountCents: 12,
      __paidCurrency: 'usd',
      __entryToken: 'tok/1',
    });
  });

  it('keeps a zero charge and omits amount, currency, and token when they are blank', () => {
    const { fixture, appendPaidEntryRow_ } = loadPaidLedger();
    appendPaidEntryRow_(
      'grand-opening',
      null,
      null,
      null,
      'door-prize',
      1,
      null,
      null,
      '',
      {
        stripeSessionId: 'cs_zero',
        paidAt: '2026-07-04T15:00:00.000Z',
        amountTotal: 0,
        currency: '',
      },
    );

    const row = fixture.appended[0];
    assert.equal(row[2], '');
    assert.equal(row[3], '');
    assert.equal(row[4], '');
    assert.equal(row[11], '');
    assert.equal(row[12], '');
    assert.deepEqual(JSON.parse(row[13]), {
      __paid: true,
      __paidTickets: 1,
      __stripeSessionId: 'cs_zero',
      __purchaseAt: '2026-07-04T15:00:00.000Z',
      __paidAmountCents: 0,
    });
  });

  it('omits cents when amountTotal is missing and stamps purchase time from the clock', () => {
    const { fixture, appendPaidEntryRow_ } = loadPaidLedger();
    fixture.nowMs = Date.parse('2026-08-01T18:30:00.000Z');
    appendPaidEntryRow_(...baseArgs, {
      stripeSessionId: 'cs_live',
      paidAt: '',
    });
    const row = fixture.appended[0];
    assert.equal(row[0].toISOString(), '2026-08-01T18:30:00.000Z');
    const extras = JSON.parse(row[13]);
    assert.deepEqual(extras, {
      __paid: true,
      __paidTickets: 4,
      __stripeSessionId: 'cs_live',
      __purchaseAt: '2026-08-01T18:30:00.000Z',
      __entryToken: 'tok/1',
    });
    assert.equal(Object.hasOwn(extras, '__paidAmountCents'), false);
    assert.equal(Object.hasOwn(extras, '__paidCurrency'), false);
  });

  it('throws before appending when the Entries sheet is missing', () => {
    const { fixture, appendPaidEntryRow_ } = loadPaidLedger();
    fixture.sheet = false;
    assert.throws(
      () => appendPaidEntryRow_(...baseArgs, { stripeSessionId: 'cs_test_1', paidAt: '2026-07-04T15:00:00.000Z' }),
      /Missing sheet: Entries/,
    );
    assert.deepEqual(fixture.appended, []);
  });
});
