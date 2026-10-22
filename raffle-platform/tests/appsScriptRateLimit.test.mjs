import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

/**
 * Executes rateLimitOk_ from Code.gs. Submit, magic-link read, and manage-entry
 * rewrite all return 429 when this returns false. Those handler tests stub the
 * function, so a change to the 10-hit hour window would not fail them.
 * Code.gs is not edited here.
 */
const HOUR_MS = 60 * 60 * 1000;
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

function createScriptCache() {
  const data = new Map();
  const puts = [];
  const cache = {
    get(key) {
      return data.has(key) ? data.get(key) : null;
    },
    put(key, value, ttlSeconds) {
      puts.push({ key, value, ttlSeconds });
      data.set(key, value);
    },
  };
  return {
    cache,
    puts,
    seed(key, value) {
      data.set(key, value);
    },
    raw(key) {
      return data.has(key) ? data.get(key) : null;
    },
  };
}

function loadRateLimit(scriptCache, now) {
  const marker = 'function rateLimitOk_(';
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, 'Code.gs is missing rateLimitOk_');
  assert.equal(source.indexOf(marker, start + marker.length), -1, 'Code.gs defines rateLimitOk_ twice');
  const open = source.indexOf('{', start);
  const end = endOfFunction(source, open);
  const body = source.slice(start, end + 1);
  const CacheService = { getScriptCache: () => scriptCache };
  const DateShim = { now: () => now.value };
  return new Function('CacheService', 'Date', `${body}\nreturn rateLimitOk_;`)(CacheService, DateShim);
}

describe('rateLimitOk_', () => {
  it('stores the first hit for an hour and shares one bucket across a missing IP', () => {
    const clock = { value: 1_800_000_000_000 };
    const scriptCache = createScriptCache();
    const rateLimitOk = loadRateLimit(scriptCache.cache, clock);

    assert.equal(rateLimitOk('203.0.113.10'), true);
    assert.equal(rateLimitOk(''), true);
    assert.equal(rateLimitOk(null), true);

    assert.deepEqual(JSON.parse(scriptCache.raw('rl:203.0.113.10')), [clock.value]);
    assert.deepEqual(JSON.parse(scriptCache.raw('rl:unknown')), [clock.value, clock.value]);
    assert.deepEqual(scriptCache.puts.map((put) => put.ttlSeconds), [3600, 3600, 3600]);
    assert.equal(scriptCache.raw('203.0.113.10'), null);
  });

  it('allows 10 hits in the hour and rejects the 11th without rewriting the cache', () => {
    const clock = { value: 1_800_000_000_000 };
    const scriptCache = createScriptCache();
    const rateLimitOk = loadRateLimit(scriptCache.cache, clock);
    const ip = '203.0.113.20';

    for (let hit = 0; hit < 10; hit += 1) {
      assert.equal(rateLimitOk(ip), true);
      clock.value += 1_000;
    }

    const stored = scriptCache.raw('rl:203.0.113.20');
    const putsBeforeReject = scriptCache.puts.length;
    clock.value += 60_000;
    assert.equal(rateLimitOk(ip), false);
    assert.equal(scriptCache.puts.length, putsBeforeReject);
    assert.equal(scriptCache.raw('rl:203.0.113.20'), stored);
    assert.equal(JSON.parse(stored).length, 10);

    assert.equal(rateLimitOk('203.0.113.21'), true);
    assert.deepEqual(JSON.parse(scriptCache.raw('rl:203.0.113.21')), [clock.value]);
  });

  it('drops a hit that is exactly one hour old and then accepts a new one', () => {
    const clock = { value: 1_800_000_000_000 };
    const scriptCache = createScriptCache();
    const rateLimitOk = loadRateLimit(scriptCache.cache, clock);
    const ip = '203.0.113.30';
    const kept = [];
    for (let hit = 0; hit < 9; hit += 1) {
      kept.push(clock.value - HOUR_MS + 1 + hit);
    }
    scriptCache.seed('rl:203.0.113.30', JSON.stringify([clock.value - HOUR_MS, ...kept]));

    assert.equal(rateLimitOk(ip), true);
    assert.deepEqual(JSON.parse(scriptCache.raw('rl:203.0.113.30')), [...kept, clock.value]);
  });

  it('still blocks when every stored hit is one millisecond inside the hour', () => {
    const clock = { value: 1_800_000_000_000 };
    const scriptCache = createScriptCache();
    const rateLimitOk = loadRateLimit(scriptCache.cache, clock);
    const inside = Array.from({ length: 10 }, (_, index) => clock.value - HOUR_MS + 1 + index);
    scriptCache.seed('rl:203.0.113.31', JSON.stringify(inside));

    assert.equal(rateLimitOk('203.0.113.31'), false);
    assert.equal(scriptCache.puts.length, 0);
    assert.deepEqual(JSON.parse(scriptCache.raw('rl:203.0.113.31')), inside);
  });

  it('opens the window again once every stored hit is an hour old', () => {
    const clock = { value: 1_800_000_000_000 };
    const scriptCache = createScriptCache();
    const rateLimitOk = loadRateLimit(scriptCache.cache, clock);
    const ip = '203.0.113.40';
    const burst = Array.from({ length: 10 }, () => clock.value);
    scriptCache.seed('rl:203.0.113.40', JSON.stringify(burst));

    assert.equal(rateLimitOk(ip), false);
    clock.value += HOUR_MS;
    assert.equal(rateLimitOk(ip), true);
    assert.deepEqual(JSON.parse(scriptCache.raw('rl:203.0.113.40')), [clock.value]);
  });

  it('treats corrupt cache JSON as an empty window', () => {
    const clock = { value: 1_800_000_000_000 };
    const scriptCache = createScriptCache();
    const rateLimitOk = loadRateLimit(scriptCache.cache, clock);
    scriptCache.seed('rl:203.0.113.50', '{');

    assert.equal(rateLimitOk('203.0.113.50'), true);
    assert.deepEqual(JSON.parse(scriptCache.raw('rl:203.0.113.50')), [clock.value]);
    assert.equal(scriptCache.puts[0].ttlSeconds, 3600);
  });
});
