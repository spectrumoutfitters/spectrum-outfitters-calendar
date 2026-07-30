import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveAdminCreatedTimeEntry } from '../utils/adminTimeEntryCreate.js';

test('rejects open entry when clock_in is a past Houston day', () => {
  // 2026-07-20 15:00 CDT = 2026-07-20T20:00:00.000Z
  const result = resolveAdminCreatedTimeEntry({
    clock_in: '2026-07-20T20:00:00.000Z',
    clock_out: null,
    todayHouston: '2026-07-30'
  });
  assert.equal(result.ok, false);
  assert.match(result.error, /open time entry/i);
});

test('rejects open entry when clock_in is a future Houston day', () => {
  const result = resolveAdminCreatedTimeEntry({
    clock_in: '2026-08-01T15:00:00.000Z',
    clock_out: null,
    todayHouston: '2026-07-30'
  });
  assert.equal(result.ok, false);
});

test('allows open entry for today Houston and stamps week ending from clock_in', () => {
  // 2026-07-30 14:00 CDT = 2026-07-30T19:00:00.000Z (Thursday → week ending Sunday 2026-08-02)
  const result = resolveAdminCreatedTimeEntry({
    clock_in: '2026-07-30T19:00:00.000Z',
    clock_out: null,
    todayHouston: '2026-07-30'
  });
  assert.equal(result.ok, true);
  assert.equal(result.resolvedClockOut, null);
  assert.equal(result.clockInHoustonDate, '2026-07-30');
  assert.equal(result.weekEnding, '2026-08-02');
});

test('closed historical entry uses clock_in Houston week ending, not today', () => {
  // Monday Jul 20 2026 afternoon CDT → week ending Sunday Jul 26
  const result = resolveAdminCreatedTimeEntry({
    clock_in: '2026-07-20T20:00:00.000Z',
    clock_out: '2026-07-20T23:00:00.000Z',
    todayHouston: '2026-07-30'
  });
  assert.equal(result.ok, true);
  assert.equal(result.weekEnding, '2026-07-26');
  assert.equal(result.clockInHoustonDate, '2026-07-20');
});

test('rejects clock_out before or equal to clock_in', () => {
  const equal = resolveAdminCreatedTimeEntry({
    clock_in: '2026-07-20T20:00:00.000Z',
    clock_out: '2026-07-20T20:00:00.000Z',
    todayHouston: '2026-07-30'
  });
  assert.equal(equal.ok, false);
  assert.match(equal.error, /clock_out must be after/i);

  const before = resolveAdminCreatedTimeEntry({
    clock_in: '2026-07-20T20:00:00.000Z',
    clock_out: '2026-07-20T19:00:00.000Z',
    todayHouston: '2026-07-30'
  });
  assert.equal(before.ok, false);
});

test('UTC midnight near Houston day boundary maps to correct Houston calendar day', () => {
  // 2026-07-25T01:00:00Z = Fri Jul 24 8pm CDT — not Jul 25 in Houston
  const result = resolveAdminCreatedTimeEntry({
    clock_in: '2026-07-25T01:00:00.000Z',
    clock_out: '2026-07-25T02:00:00.000Z',
    todayHouston: '2026-07-30'
  });
  assert.equal(result.ok, true);
  assert.equal(result.clockInHoustonDate, '2026-07-24');
  // Fri Jul 24 week ending Sunday Jul 26
  assert.equal(result.weekEnding, '2026-07-26');
});
