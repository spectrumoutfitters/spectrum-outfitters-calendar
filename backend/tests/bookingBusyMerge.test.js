import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

/**
 * Load mergeIntervals without importing googleCalendarService.js.
 * That module opens SQLite and Google clients on import.
 * The helper is nested inside queryCalendarFreeBusy and is not exported.
 */
function loadMergeIntervals() {
  const src = fs.readFileSync(path.join(here, '../utils/googleCalendarService.js'), 'utf8');
  const signature = 'function mergeIntervals(intervals)';
  const start = src.indexOf(signature);
  if (start < 0) throw new Error(`missing ${signature}`);
  const body = src.slice(start, endOfBrace(src, src.indexOf('{', start)));

  if (!body.includes('a.start.localeCompare(b.start)')) {
    throw new Error('slice missed the start-time sort');
  }
  if (!body.includes('curStartMs <= lastEndMs')) {
    throw new Error('slice missed the overlap join');
  }
  if (!body.includes('out.push({ ...cur })')) {
    throw new Error('slice missed the gap split');
  }
  if (body.includes('freebusy.query') || body.includes('getAuthedCalendarClient') || body.includes('await ')) {
    throw new Error('slice pulled in the Google free/busy request');
  }

  return new Function(`${body}\nreturn mergeIntervals;`)();
}

/**
 * Same half-open check the public booking flow uses after the merge:
 * startMs < busyEnd && busyStart < endMs.
 */
function loadOverlapsInterval() {
  const src = fs.readFileSync(path.join(here, '../utils/customerBookingService.js'), 'utf8');
  const signature = 'function overlapsInterval(startMs, endMs, intervals)';
  const start = src.indexOf(signature);
  if (start < 0) throw new Error(`missing ${signature}`);
  const body = src.slice(start, endOfBrace(src, src.indexOf('{', start)));

  if (!body.includes('startMs < be && bs < endMs')) {
    throw new Error('slice missed the booking overlap predicate');
  }
  if (body.includes('db.') || body.includes('await ') || body.includes('queryCalendarFreeBusy')) {
    throw new Error('slice pulled in booking I/O');
  }

  return new Function(`${body}\nreturn overlapsInterval;`)();
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
  throw new Error('unterminated function');
}

const mergeIntervals = loadMergeIntervals();
const overlapsInterval = loadOverlapsInterval();

function busy(start, end) {
  return { start: `2026-08-06T${start}:00.000Z`, end: `2026-08-06T${end}:00.000Z` };
}

function slotHits(start, end, intervals) {
  return overlapsInterval(
    Date.parse(`2026-08-06T${start}:00.000Z`),
    Date.parse(`2026-08-06T${end}:00.000Z`),
    intervals
  );
}

describe('booking busy-interval merge', () => {
  it('returns no busy time for an empty list', () => {
    const merged = mergeIntervals([]);
    assert.deepEqual(merged, []);
    assert.equal(slotHits('09:00', '09:30', merged), false);
  });

  it('keeps the earlier start when a contained block is seen first', () => {
    // Inner block arrives before the outer block that actually started earlier.
    // Without sorting, the 09:00-10:00 portion is absorbed and the shop looks free.
    const merged = mergeIntervals([
      busy('10:00', '10:30'),
      busy('09:00', '12:00'),
    ]);

    assert.equal(slotHits('09:15', '09:45', merged), true);
    assert.equal(slotHits('11:00', '11:30', merged), true);
    assert.equal(slotHits('12:15', '12:45', merged), false);
  });

  it('keeps both sides of a gap when the later block is seen first', () => {
    const merged = mergeIntervals([
      busy('11:00', '12:00'),
      busy('09:00', '10:00'),
    ]);

    assert.equal(slotHits('09:15', '09:45', merged), true);
    assert.equal(slotHits('10:15', '10:45', merged), false);
    assert.equal(slotHits('11:15', '11:45', merged), true);
    assert.equal(slotHits('10:30', '11:15', merged), true);
  });

  it('keeps a one-minute gap bookable', () => {
    const merged = mergeIntervals([
      busy('10:01', '11:00'),
      busy('09:00', '10:00'),
    ]);

    assert.equal(slotHits('10:00', '10:01', merged), false);
    assert.equal(slotHits('09:30', '09:45', merged), true);
    assert.equal(slotHits('10:15', '10:30', merged), true);
  });

  it('covers a chain that only overlaps across three calendars', () => {
    // No single calendar covers 10:50-11:10, and the last block is the only one past 11:00.
    const merged = mergeIntervals([
      busy('10:45', '12:00'),
      busy('09:00', '10:00'),
      busy('09:30', '11:00'),
    ]);

    assert.equal(slotHits('09:10', '09:20', merged), true);
    assert.equal(slotHits('10:50', '11:10', merged), true);
    assert.equal(slotHits('11:30', '11:45', merged), true);
    assert.equal(slotHits('12:15', '12:30', merged), false);
  });
});
