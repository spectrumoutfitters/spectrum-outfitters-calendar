import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DateTime, Settings } from 'luxon';

const sourcePath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '../utils/customerBookingService.js'
);

/**
 * Load the real generator without importing the booking service.
 * That module opens the database at import time.
 */
function loadGenerateCandidateSlotsUtc() {
  const src = fs.readFileSync(sourcePath, 'utf8');
  const start = src.indexOf('function parseHm(hmStr)');
  const end = src.indexOf('export async function computeAvailableBookingSlots()');
  if (start < 0 || end < start) {
    throw new Error('generateCandidateSlotsUtc markers moved in customerBookingService.js');
  }
  const fnSrc = src.slice(start, end);
  return new Function('DateTime', `${fnSrc}\nreturn generateCandidateSlotsUtc;`)(DateTime);
}

const generateCandidateSlotsUtc = loadGenerateCandidateSlotsUtc();
const originalNow = Settings.now;

function pinUtc(iso) {
  const ms = Date.parse(iso);
  Settings.now = () => ms;
}

function ranges(slots) {
  return slots.map((slot) => [slot.startIso, slot.endIso]);
}

describe('generateCandidateSlotsUtc', { concurrency: false }, () => {
  after(() => {
    Settings.now = originalNow;
  });

  it('uses Luxon weekdays and emits exact UTC ranges for a weekday block', () => {
    pinUtc('2026-03-02T15:00:00.000Z');
    const slots = generateCandidateSlotsUtc({
      timezone: 'America/Chicago',
      horizonDays: 1,
      slotMinutes: 30,
      weeklyHoursObj: {
        0: [{ start: '08:00', end: '09:00' }],
        1: [{ start: '08:00', end: '09:00' }],
        7: [{ start: '08:00', end: '17:00' }],
      },
    });

    assert.deepEqual(ranges(slots), [
      ['2026-03-02T14:00:00.000Z', '2026-03-02T14:30:00.000Z'],
      ['2026-03-02T14:30:00.000Z', '2026-03-02T15:00:00.000Z'],
    ]);
    for (const slot of slots) {
      assert.equal(slot.endMs - slot.startMs, 30 * 60 * 1000);
      assert.equal(slot.startMs, Date.parse(slot.startIso));
      assert.equal(slot.endMs, Date.parse(slot.endIso));
    }
  });

  it('drops closed, reversed, short, and unparseable blocks, then sorts the rest', () => {
    pinUtc('2026-03-02T15:00:00.000Z');
    const slots = generateCandidateSlotsUtc({
      timezone: 'America/Chicago',
      horizonDays: 1,
      slotMinutes: 30,
      weeklyHoursObj: {
        1: [
          { start: '08:00', end: '08:00' },
          { start: '10:00', end: '09:00' },
          { start: '12:00', end: '12:20' },
          { start: 'bad', end: '13:00' },
          { start: '14:00', end: '15:00' },
          { start: '13:00', end: '14:00' },
        ],
      },
    });

    assert.deepEqual(ranges(slots), [
      ['2026-03-02T19:00:00.000Z', '2026-03-02T19:30:00.000Z'],
      ['2026-03-02T19:30:00.000Z', '2026-03-02T20:00:00.000Z'],
      ['2026-03-02T20:00:00.000Z', '2026-03-02T20:30:00.000Z'],
      ['2026-03-02T20:30:00.000Z', '2026-03-02T21:00:00.000Z'],
    ]);
  });

  it('keeps spring-forward slots at real elapsed minutes and skips the missing hour', () => {
    pinUtc('2026-03-08T18:00:00.000Z');
    const slots = generateCandidateSlotsUtc({
      timezone: 'America/Chicago',
      horizonDays: 1,
      slotMinutes: 60,
      weeklyHoursObj: { 7: [{ start: '01:00', end: '04:00' }] },
    });

    assert.equal(slots.length, 2);
    assert.deepEqual(ranges(slots), [
      ['2026-03-08T07:00:00.000Z', '2026-03-08T08:00:00.000Z'],
      ['2026-03-08T08:00:00.000Z', '2026-03-08T09:00:00.000Z'],
    ]);

    const firstStart = DateTime.fromISO(slots[0].startIso, { zone: 'utc' }).setZone('America/Chicago');
    const firstEnd = DateTime.fromISO(slots[0].endIso, { zone: 'utc' }).setZone('America/Chicago');
    assert.equal(firstStart.toFormat('HH:mm'), '01:00');
    assert.equal(firstEnd.toFormat('HH:mm'), '03:00');
    assert.equal(firstStart.offset, -360);
    assert.equal(firstEnd.offset, -300);
    assert.equal(slots[0].endMs - slots[0].startMs, 60 * 60 * 1000);
    assert.equal(slots[1].endMs - slots[1].startMs, 60 * 60 * 1000);

    const secondStart = DateTime.fromISO(slots[1].startIso, { zone: 'utc' }).setZone('America/Chicago');
    assert.equal(secondStart.toFormat('HH:mm'), '03:00');
  });

  it('offers the repeated hour on the fall-back Sunday as its own 60-minute slot', () => {
    pinUtc('2026-11-01T18:00:00.000Z');
    const slots = generateCandidateSlotsUtc({
      timezone: 'America/Chicago',
      horizonDays: 1,
      slotMinutes: 60,
      weeklyHoursObj: { 7: [{ start: '01:00', end: '03:00' }] },
    });

    assert.equal(slots.length, 3);
    assert.deepEqual(ranges(slots), [
      ['2026-11-01T06:00:00.000Z', '2026-11-01T07:00:00.000Z'],
      ['2026-11-01T07:00:00.000Z', '2026-11-01T08:00:00.000Z'],
      ['2026-11-01T08:00:00.000Z', '2026-11-01T09:00:00.000Z'],
    ]);

    const repeatedStart = DateTime.fromISO(slots[0].startIso, { zone: 'utc' }).setZone('America/Chicago');
    const repeatedEnd = DateTime.fromISO(slots[0].endIso, { zone: 'utc' }).setZone('America/Chicago');
    assert.equal(repeatedStart.toFormat('HH:mm'), '01:00');
    assert.equal(repeatedEnd.toFormat('HH:mm'), '01:00');
    assert.equal(repeatedStart.offset, -300);
    assert.equal(repeatedEnd.offset, -360);
    for (const slot of slots) {
      assert.equal(slot.endMs - slot.startMs, 60 * 60 * 1000);
    }
  });

  it('still lists earlier slots from today and does not reach past the horizon', () => {
    pinUtc('2026-03-06T23:30:00.000Z');
    const slots = generateCandidateSlotsUtc({
      timezone: 'America/Chicago',
      horizonDays: 2,
      slotMinutes: 60,
      weeklyHoursObj: {
        5: [{ start: '08:00', end: '09:00' }],
        6: [],
        7: [{ start: '10:00', end: '11:00' }],
      },
    });

    assert.deepEqual(ranges(slots), [
      ['2026-03-06T14:00:00.000Z', '2026-03-06T15:00:00.000Z'],
    ]);
  });

  it('returns no slots for a zero horizon or a weekday with no interval list', () => {
    pinUtc('2026-01-01T12:00:00.000Z');
    assert.deepEqual(
      generateCandidateSlotsUtc({
        timezone: 'America/Chicago',
        horizonDays: 0,
        slotMinutes: 30,
        weeklyHoursObj: { 4: [{ start: '08:00', end: '09:00' }] },
      }),
      []
    );
    assert.deepEqual(
      generateCandidateSlotsUtc({
        timezone: 'America/Chicago',
        horizonDays: 1,
        slotMinutes: 30,
        weeklyHoursObj: { 4: '08:00-09:00' },
      }),
      []
    );
  });
});
