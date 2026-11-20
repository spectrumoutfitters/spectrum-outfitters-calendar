import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const sourcePath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '../utils/valorPayRevenue.js'
);

const ENV_KEYS = ['VALOR_TXN_LIST_URL', 'VALOR_API_BASE_URL'];

/**
 * Load the URL builder for the Valor transaction-list request.
 * The helpers are not exported. The module also aggregates payments and posts
 * card-shaped bodies, so the test executes only these two functions.
 */
function loadTxnListUrl() {
  const src = fs.readFileSync(sourcePath, 'utf8');
  const defaultLine = constLine(src, 'DEFAULT_BASE_URL');
  const queryLine = constLine(src, 'TXN_LIST_QUERY');
  const getBase = sliceFunction(src, 'function getBaseUrl()');
  const getTxn = sliceFunction(src, 'function getTxnListUrl()');

  if (!queryLine.includes("'txnfetch'")) {
    throw new Error('slice missed the txnfetch query name');
  }
  if (!getBase.includes('VALOR_API_BASE_URL') || !getBase.includes('.replace(/\\/$/, \'\')')) {
    throw new Error('slice missed the base URL trailing-slash strip');
  }
  if (!getTxn.includes('VALOR_TXN_LIST_URL') || !getTxn.includes("base.includes('?')")) {
    throw new Error('slice missed the override or query join');
  }
  if (!getTxn.includes('getBaseUrl()')) {
    throw new Error('slice missed the base URL call');
  }
  const combined = `${defaultLine}\n${queryLine}\n${getBase}\n${getTxn}`;
  if (combined.includes('fetch(') || combined.includes('cardnumber') || combined.includes('isValorPayDisabled')) {
    throw new Error('slice pulled in the Valor request or the disable flag');
  }

  return new Function(`${combined}\nreturn getTxnListUrl;`)();
}

function constLine(src, name) {
  const marker = `const ${name} =`;
  const start = src.indexOf(marker);
  if (start < 0) throw new Error(`missing ${marker}`);
  const end = src.indexOf('\n', start);
  if (end < 0) throw new Error(`unterminated ${marker}`);
  return src.slice(start, end);
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
  throw new Error('unterminated Valor URL helper');
}

const getTxnListUrl = loadTxnListUrl();

function withValorEnv(env, fn) {
  const saved = new Map(ENV_KEYS.map((key) => [key, process.env[key]]));
  try {
    for (const key of ENV_KEYS) {
      if (env[key] === undefined) delete process.env[key];
      else process.env[key] = env[key];
    }
    return fn();
  } finally {
    for (const [key, value] of saved) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

describe('Valor transaction list URL', { concurrency: 1 }, () => {
  it('returns an explicit list URL unchanged, even when a base URL is also set', () => {
    const override = 'https://secure.example/?transactionlist=';
    withValorEnv(
      {
        VALOR_TXN_LIST_URL: override,
        VALOR_API_BASE_URL: 'https://other.example/api?sale='
      },
      () => {
        assert.equal(getTxnListUrl(), override);
      }
    );
  });

  it('joins txnfetch with ? and strips one trailing slash when the base has no query', () => {
    const expected = 'https://pay.example:4430/?txnfetch=';
    for (const base of ['https://pay.example:4430', 'https://pay.example:4430/']) {
      for (const override of [undefined, '']) {
        withValorEnv({ VALOR_API_BASE_URL: base, VALOR_TXN_LIST_URL: override }, () => {
          assert.equal(getTxnListUrl(), expected);
        });
      }
    }
  });

  it('joins txnfetch with & when the base already has a query string', () => {
    const expected = 'https://pay.example:4430/?saleapi=&txnfetch=';
    for (const base of [
      'https://pay.example:4430/?saleapi=',
      'https://pay.example:4430/?saleapi=/'
    ]) {
      withValorEnv({ VALOR_API_BASE_URL: base }, () => {
        assert.equal(getTxnListUrl(), expected);
      });
    }
  });
});
