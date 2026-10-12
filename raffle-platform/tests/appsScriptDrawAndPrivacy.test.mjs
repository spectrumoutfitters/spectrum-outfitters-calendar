import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

/**
 * Loads pure functions from the Apps Script source so a regression in the
 * live draw, email mask, or ticket defaults fails here. Code.gs is not an
 * ES module, and several open PRs already edit it, so these tests execute
 * the functions in place instead of copying them.
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

function loadFunction(name) {
  const marker = `function ${name}(`;
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, `Code.gs is missing ${name}`);
  assert.equal(source.indexOf(marker, start + marker.length), -1, `Code.gs defines ${name} twice`);
  const open = source.indexOf('{', start);
  const end = endOfFunction(source, open);
  const body = source.slice(start, end + 1);
  return new Function(`${body}\nreturn ${name};`)();
}

const weightedPick = loadFunction('weightedPick_');
const maskEmail = loadFunction('maskEmail_');
const getBaseTicketsPerEntry = loadFunction('getBaseTicketsPerEntry_');
const getNewsletterBonusTickets = loadFunction('getNewsletterBonusTickets_');
const isNewsletterBonusEnabled = loadFunction('isNewsletterBonusEnabled_');
const isValidRaffleId = loadFunction('isValidRaffleId_');
const constantTimeEqualHex = loadFunction('constantTimeEqualHex_');
const bytesToHex = loadFunction('bytesToHex_');
const parseEntryExtrasJson = loadFunction('parseEntryExtrasJson_');

function withRandom(value, fn) {
  const original = Math.random;
  Math.random = () => value;
  try {
    return fn();
  } finally {
    Math.random = original;
  }
}

describe('weightedPick_', () => {
  const pool = [
    { weight: 1, name: 'Ada' },
    { weight: 3, name: 'Grace' },
  ];

  it('returns null when there is nobody to draw or every weight is non-positive', () => {
    let calls = 0;
    const original = Math.random;
    Math.random = () => {
      calls += 1;
      return 0;
    };
    try {
      assert.equal(weightedPick([]), null);
      assert.equal(weightedPick([{ weight: 0, name: 'Zero' }]), null);
      assert.equal(weightedPick([{ weight: -2, name: 'Neg' }]), null);
      assert.equal(weightedPick([{ weight: -5, name: 'A' }, { weight: 3, name: 'B' }]), null);
    } finally {
      Math.random = original;
    }
    assert.equal(calls, 0);
  });

  it('gives each entrant a bucket equal to their ticket weight, inclusive on the upper edge', () => {
    // total = 4. r = 0 lands on the first ticket. r = 1 is still Ada (r <= acc).
    assert.equal(withRandom(0, () => weightedPick(pool)).name, 'Ada');
    assert.equal(withRandom(0.25, () => weightedPick(pool)).name, 'Ada');
    // Just past Ada's 1 ticket, the remaining 3 belong to Grace.
    assert.equal(withRandom(0.25 + 1e-10, () => weightedPick(pool)).name, 'Grace');
    assert.equal(withRandom(0.999, () => weightedPick(pool)).name, 'Grace');
  });

  it('returns the last entrant when the roll falls past every cumulative weight', () => {
    assert.equal(withRandom(1.1, () => weightedPick(pool)).name, 'Grace');
  });

  it('always returns the only entrant with tickets', () => {
    const solo = [{ weight: 7, name: 'Solo', phone: '555' }];
    assert.equal(withRandom(0, () => weightedPick(solo)), solo[0]);
    assert.equal(withRandom(0.999, () => weightedPick(solo)), solo[0]);
  });
});

describe('maskEmail_', () => {
  it('hides the local part and keeps the domain', () => {
    // One or two characters before @ show only the first. Three or more show the first two.
    assert.equal(maskEmail('a@example.com'), 'a***@example.com');
    assert.equal(maskEmail('ab@example.com'), 'a***@example.com');
    assert.equal(maskEmail('ada@example.com'), 'ad***@example.com');
    assert.equal(maskEmail('grace@example.com'), 'gr***@example.com');
    assert.equal(maskEmail('  Jo@Shop.com '), 'J***@Shop.com');
  });

  it('does not invent a domain when the address has no @', () => {
    assert.equal(maskEmail(''), '');
    assert.equal(maskEmail(null), '');
    assert.equal(maskEmail(undefined), '');
    assert.equal(maskEmail('   '), '');
    assert.equal(maskEmail('not-an-email'), 'n***');
    assert.equal(maskEmail('@example.com'), '@***');
  });
});

describe('Apps Script ticket defaults', () => {
  it('falls back to 2 base tickets unless the value is a whole number of at least 1', () => {
    assert.equal(getBaseTicketsPerEntry(null), 2);
    assert.equal(getBaseTicketsPerEntry({}), 2);
    assert.equal(getBaseTicketsPerEntry({ baseTicketsPerEntry: 0 }), 2);
    assert.equal(getBaseTicketsPerEntry({ baseTicketsPerEntry: '' }), 2);
    assert.equal(getBaseTicketsPerEntry({ baseTicketsPerEntry: -4 }), 2);
    assert.equal(getBaseTicketsPerEntry({ baseTicketsPerEntry: 'abc' }), 2);
    assert.equal(getBaseTicketsPerEntry({ baseTicketsPerEntry: Infinity }), 2);
    assert.equal(getBaseTicketsPerEntry({ baseTicketsPerEntry: 1.9 }), 1);
    assert.equal(getBaseTicketsPerEntry({ baseTicketsPerEntry: '5' }), 5);
  });

  it('defaults a missing newsletter bonus to 2 tickets and keeps an explicit 0', () => {
    // Number(null) is 0, which is a legal bonus. A missing field is NaN and falls back to 2.
    assert.equal(getNewsletterBonusTickets({}), 2);
    assert.equal(getNewsletterBonusTickets(undefined), 2);
    assert.equal(getNewsletterBonusTickets(null), 0);
    assert.equal(getNewsletterBonusTickets({ newsletterBonusTickets: -1 }), 2);
    assert.equal(getNewsletterBonusTickets({ newsletterBonusTickets: 'nope' }), 2);
    assert.equal(getNewsletterBonusTickets({ newsletterBonusTickets: 0 }), 0);
    assert.equal(getNewsletterBonusTickets({ newsletterBonusTickets: '' }), 0);
    assert.equal(getNewsletterBonusTickets({ newsletterBonusTickets: 3.9 }), 3);
    assert.equal(getNewsletterBonusTickets({ newsletterBonusTickets: '4' }), 4);
  });

  it('treats a blank newsletter flag as enabled and only the string TRUE as on', () => {
    assert.equal(isNewsletterBonusEnabled(null), true);
    assert.equal(isNewsletterBonusEnabled({}), true);
    assert.equal(isNewsletterBonusEnabled({ newsletterBonusEnabled: '' }), true);
    assert.equal(isNewsletterBonusEnabled({ newsletterBonusEnabled: null }), true);
    assert.equal(isNewsletterBonusEnabled({ newsletterBonusEnabled: true }), true);
    assert.equal(isNewsletterBonusEnabled({ newsletterBonusEnabled: 'TRUE' }), true);
    assert.equal(isNewsletterBonusEnabled({ newsletterBonusEnabled: false }), false);
    assert.equal(isNewsletterBonusEnabled({ newsletterBonusEnabled: 'false' }), false);
    assert.equal(isNewsletterBonusEnabled({ newsletterBonusEnabled: 'FALSE' }), false);
    assert.equal(isNewsletterBonusEnabled({ newsletterBonusEnabled: 'yes' }), false);
    assert.equal(isNewsletterBonusEnabled({ newsletterBonusEnabled: 1 }), false);
  });
});

describe('isValidRaffleId_', () => {
  it('allows 1–48 letters, numbers, dashes, and underscores', () => {
    assert.equal(isValidRaffleId('a'), true);
    assert.equal(isValidRaffleId('ok_name-1'), true);
    assert.equal(isValidRaffleId(`  ${'a'.repeat(48)}  `), true);
    assert.equal(isValidRaffleId('a'.repeat(49)), false);
    assert.equal(isValidRaffleId(''), false);
    assert.equal(isValidRaffleId(null), false);
    assert.equal(isValidRaffleId('has space'), false);
    assert.equal(isValidRaffleId('dot.name'), false);
    assert.equal(isValidRaffleId('../x'), false);
  });
});

describe('paid purchase signature compare', () => {
  it('hex-encodes HMAC bytes with a leading zero nibble', () => {
    assert.equal(bytesToHex([]), '');
    assert.equal(bytesToHex([0, 15, 255]), '000fff');
    assert.equal(bytesToHex([10, 11]), '0a0b');
    assert.equal(bytesToHex([-1, 256]), 'ff00');
  });

  it('accepts only the same hex string and rejects a different length', () => {
    assert.equal(constantTimeEqualHex('ab', 'ab'), true);
    assert.equal(constantTimeEqualHex('ab', 'AB'), false);
    assert.equal(constantTimeEqualHex('abc', 'abd'), false);
    assert.equal(constantTimeEqualHex('ab', 'abc'), false);
    assert.equal(constantTimeEqualHex('', ''), true);
    assert.equal(constantTimeEqualHex(null, ''), true);
  });
});

describe('parseEntryExtrasJson_', () => {
  it('keeps object extras and drops arrays, scalars, and broken JSON', () => {
    assert.deepEqual(parseEntryExtrasJson(null), {});
    assert.deepEqual(parseEntryExtrasJson(''), {});
    assert.deepEqual(parseEntryExtrasJson('{bad'), {});
    assert.deepEqual(parseEntryExtrasJson('[]'), {});
    assert.deepEqual(parseEntryExtrasJson('null'), {});
    assert.deepEqual(parseEntryExtrasJson('"paid"'), {});
    assert.deepEqual(parseEntryExtrasJson('{"__paid":true,"__stripeSessionId":"cs_1"}'), {
      __paid: true,
      __stripeSessionId: 'cs_1',
    });
  });
});
