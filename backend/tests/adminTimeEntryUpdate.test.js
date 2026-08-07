import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveAdminTimeEntryUpdate } from '../utils/adminTimeEntryUpdate.js';

const closedHistorical = {
  id: 1,
  user_id: 9,
  clock_in: '2026-07-20T20:00:00.000Z',
  clock_out: '2026-07-20T23:00:00.000Z',
  break_minutes: 0,
  notes: null,
  week_ending_date: '2026-07-26',
};

test('rejects clearing clock_out on a historical closed entry (phantom reopen)', () => {
  const result = resolveAdminTimeEntryUpdate({
    currentEntry: closedHistorical,
    clock_out: null,
    todayHouston: '2026-07-30',
  });
  assert.equal(result.ok, false);
  assert.match(result.error, /reopen|open/i);
});

test('rejects empty-string clock_out on a historical closed entry', () => {
  const result = resolveAdminTimeEntryUpdate({
    currentEntry: closedHistorical,
    clock_out: '',
    todayHouston: '2026-07-30',
  });
  assert.equal(result.ok, false);
});

test('allows keeping a closed historical entry closed and restamps week ending from clock_in', () => {
  const result = resolveAdminTimeEntryUpdate({
    currentEntry: closedHistorical,
    clock_in: '2026-07-21T14:00:00.000Z',
    clock_out: '2026-07-21T22:00:00.000Z',
    todayHouston: '2026-07-30',
  });
  assert.equal(result.ok, true);
  assert.equal(result.weekEnding, '2026-07-26');
  assert.equal(result.becomesOpen, false);
});

test('rejects clock_out before clock_in on update', () => {
  const result = resolveAdminTimeEntryUpdate({
    currentEntry: closedHistorical,
    clock_out: '2026-07-20T19:00:00.000Z',
    todayHouston: '2026-07-30',
  });
  assert.equal(result.ok, false);
  assert.match(result.error, /clock_out must be after/i);
});

test('allows open update only when clock_in is today Houston', () => {
  const todayOpen = {
    ...closedHistorical,
    clock_in: '2026-07-30T19:00:00.000Z',
    clock_out: '2026-07-30T20:00:00.000Z',
  };
  const result = resolveAdminTimeEntryUpdate({
    currentEntry: todayOpen,
    clock_out: null,
    todayHouston: '2026-07-30',
  });
  assert.equal(result.ok, true);
  assert.equal(result.becomesOpen, true);
  assert.equal(result.nextClockOut, null);
  assert.equal(result.weekEnding, '2026-08-02');
});

test('omitted clock_out keeps existing value', () => {
  const result = resolveAdminTimeEntryUpdate({
    currentEntry: closedHistorical,
    notes: 'adjusted',
    todayHouston: '2026-07-30',
  });
  assert.equal(result.ok, true);
  assert.equal(result.nextClockOut, closedHistorical.clock_out);
});
