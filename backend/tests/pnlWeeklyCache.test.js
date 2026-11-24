import { afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const compliancePath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '../routes/compliance.js'
);

const PNL_CACHE_TTL_MS = 5 * 60 * 1000;
const realNow = Date.now;

/**
 * The weekly P&L cache lives in compliance.js. Importing that route opens
 * SQLite, so these tests execute only the cache map and its two helpers.
 */
function loadPnlWeeklyCache() {
  const src = fs.readFileSync(compliancePath, 'utf8');
  const block = sliceCache(src);
  if (!block.includes('pnlWeeklyCache.delete(weekEndDate)')) {
    throw new Error('slice missed cache expiry delete');
  }
  if (!block.includes('Date.now()') || !block.includes('5 * 60 * 1000')) {
    throw new Error('slice missed the five-minute TTL');
  }
  if (block.includes('db.') || block.includes('router.') || block.includes('res.json')) {
    throw new Error('slice pulled the weekly P&L route into the cache');
  }
  return new Function(
    `${block}
return { getCachedPnlWeekly, setCachedPnlWeekly };`
  )();
}

function sliceCache(src) {
  const start = src.indexOf('const pnlWeeklyCache = new Map();');
  if (start < 0) throw new Error('missing pnlWeeklyCache');
  const setStart = src.indexOf('function setCachedPnlWeekly(', start);
  if (setStart < 0) throw new Error('missing setCachedPnlWeekly');
  const body = src.indexOf('{', setStart);
  return src.slice(start, endOfBrace(src, body));
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
  throw new Error('unterminated P&L cache helper');
}

afterEach(() => {
  Date.now = realNow;
});

function at(ms) {
  Date.now = () => ms;
}

describe('weekly P&L cache', () => {
  const week = '2026-11-20';
  const priorWeek = '2026-11-13';

  it('returns null when that Friday has not been stored', () => {
    const { getCachedPnlWeekly } = loadPnlWeeklyCache();
    assert.equal(getCachedPnlWeekly(week), null);
  });

  it('returns the stored report through the five-minute TTL', () => {
    const { getCachedPnlWeekly, setCachedPnlWeekly } = loadPnlWeeklyCache();
    const report = {
      week_ending_date: week,
      summary: { total_revenue: 4200, net_profit_loss: 875.5 }
    };
    at(1_000_000);
    setCachedPnlWeekly(week, report);

    at(1_000_000 + PNL_CACHE_TTL_MS);
    assert.deepEqual(getCachedPnlWeekly(week), report);
  });

  it('keeps each Friday independent and drops only the week older than five minutes', () => {
    const { getCachedPnlWeekly, setCachedPnlWeekly } = loadPnlWeeklyCache();
    const current = { week_ending_date: week, summary: { net_profit_loss: 100 } };
    const previous = { week_ending_date: priorWeek, summary: { net_profit_loss: -40 } };
    const t0 = 5_000_000;
    at(t0);
    setCachedPnlWeekly(priorWeek, previous);
    at(t0 + 4 * 60 * 1000);
    setCachedPnlWeekly(week, current);

    at(t0 + PNL_CACHE_TTL_MS + 1);
    assert.equal(getCachedPnlWeekly(priorWeek), null);
    assert.deepEqual(getCachedPnlWeekly(week), current);
  });

  it('deletes an expired week so a later read cannot revive the stale report', () => {
    const { getCachedPnlWeekly, setCachedPnlWeekly } = loadPnlWeeklyCache();
    const stale = { week_ending_date: week, summary: { net_profit_loss: 10 } };
    const fresh = { week_ending_date: week, summary: { net_profit_loss: 99 } };
    const t0 = 9_000_000;
    at(t0);
    setCachedPnlWeekly(week, stale);

    at(t0 + PNL_CACHE_TTL_MS + 1);
    assert.equal(getCachedPnlWeekly(week), null);

    at(t0 + 60_000);
    assert.equal(getCachedPnlWeekly(week), null);

    at(t0 + PNL_CACHE_TTL_MS + 2);
    setCachedPnlWeekly(week, fresh);
    assert.deepEqual(getCachedPnlWeekly(week), fresh);
  });
});
