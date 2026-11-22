import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const routesDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '../routes'
);

/**
 * Load the auto slug used for /secure/:slug payment links.
 * It is not exported. The route opens SQLite on import, so the test
 * executes only this function with a scripted crypto.randomBytes.
 */
function loadSlugGenerator(crypto) {
  const src = fs.readFileSync(path.join(routesDir, 'shortLinks.js'), 'utf8');
  const fn = sliceFunction(src, 'function generateRandomSlug()');
  if (!fn.includes('randomBytes(6)') || !fn.includes(".toString('base64url')")) {
    throw new Error('slice missed crypto slug generation');
  }
  if (!fn.includes(".replace(/[^a-zA-Z0-9]/g, '')") || !fn.includes('.toLowerCase()')) {
    throw new Error('slice missed alphanumeric lowercasing');
  }
  if (fn.includes('db.') || fn.includes('router.') || fn.includes('INSERT')) {
    throw new Error('slice pulled in the short-link route');
  }
  return new Function('crypto', `${fn}\nreturn generateRandomSlug;`)(crypto);
}

/**
 * Load the affiliate quote-link token. Same constraint: affiliates.js
 * opens SQLite on import, so only makeToken runs.
 */
function loadTokenMaker(crypto) {
  const src = fs.readFileSync(path.join(routesDir, 'affiliates.js'), 'utf8');
  const fn = sliceFunction(src, 'function makeToken(');
  if (!fn.includes('randomBytes(bytes)') || !fn.includes(".toString('hex')")) {
    throw new Error('slice missed hex token generation');
  }
  if (fn.includes('db.') || fn.includes('router.') || fn.includes('INSERT')) {
    throw new Error('slice pulled in the affiliate route');
  }
  return new Function('crypto', `${fn}\nreturn makeToken;`)(crypto);
}

function sliceFunction(src, signature) {
  const start = src.indexOf(signature);
  if (start < 0) throw new Error(`missing ${signature}`);
  return src.slice(start, endOfBrace(src, src.indexOf('{', start)));
}

function endOfBrace(src, open) {
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    const ch = src[i];
    if (ch === '{') depth += 1;
    else if (ch === '}') {
      depth -= 1;
      if (depth === 0) return i + 1;
    }
  }
  throw new Error('unterminated public link token helper');
}

function scriptedCrypto(queued) {
  const calls = [];
  const pending = queued.map((bytes) => Buffer.from(bytes));
  return {
    calls,
    randomBytes(size) {
      calls.push(size);
      const next = pending.shift();
      if (!next) throw new Error(`unexpected randomBytes(${size})`);
      if (next.length !== size) {
        throw new Error(`randomBytes(${size}) stubbed with ${next.length} bytes`);
      }
      return next;
    }
  };
}

describe('generateRandomSlug', () => {
  it('lowercases a fully alphanumeric payment slug from 6 crypto bytes', () => {
    const bytes = [1, 0, 3, 7, 11, 13];
    assert.equal(Buffer.from(bytes).toString('base64url'), 'AQADBwsN');
    const crypto = scriptedCrypto([bytes]);
    const generateRandomSlug = loadSlugGenerator(crypto);

    assert.equal(generateRandomSlug(), 'aqadbwsn');
    assert.deepEqual(crypto.calls, [6]);
  });

  it('strips base64url dashes and underscores from an auto payment slug', () => {
    const bytes = [21, 0, 63, 147, 231, 17];
    assert.equal(Buffer.from(bytes).toString('base64url'), 'FQA_k-cR');
    const crypto = scriptedCrypto([bytes]);
    const generateRandomSlug = loadSlugGenerator(crypto);

    assert.equal(generateRandomSlug(), 'fqakcr');
    assert.deepEqual(crypto.calls, [6]);
  });
});

describe('makeToken', () => {
  it('encodes an affiliate link token as lowercase hex of the requested bytes', () => {
    const bytes = [0x0a, 0x1b, 0x2c, 0x3d, 0x4e, 0x5f, 0x60, 0x71, 0x82, 0x93];
    const crypto = scriptedCrypto([bytes]);
    const makeToken = loadTokenMaker(crypto);

    assert.equal(makeToken(10), '0a1b2c3d4e5f60718293');
    assert.deepEqual(crypto.calls, [10]);
  });

  it('uses the byte-count argument instead of a fixed token size', () => {
    const crypto = scriptedCrypto([[0xde, 0xad, 0xbe, 0xef]]);
    const makeToken = loadTokenMaker(crypto);

    assert.equal(makeToken(4), 'deadbeef');
    assert.deepEqual(crypto.calls, [4]);
  });
});
