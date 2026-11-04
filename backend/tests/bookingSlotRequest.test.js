import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DateTime } from 'luxon';

const sourcePath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '../utils/customerBookingService.js'
);

/**
 * Load the booking request helpers without importing the service.
 * That module opens the database at import time.
 */
function loadBookingSlotHelpers() {
  const src = fs.readFileSync(sourcePath, 'utf8');
  const normalizeStart = src.indexOf(
    'function normalizeSlotFromRequest(slot_start_iso, slotMinutes, tz)'
  );
  const normalizeEnd = src.indexOf('export async function submitCustomerBooking(payload)', normalizeStart);
  const escapeStart = src.indexOf('function escapeHtml(s)');
  const escapeEnd = src.indexOf('export async function getAdminBookingSnapshot()', escapeStart);
  if (normalizeStart < 0 || normalizeEnd < normalizeStart || escapeStart < 0 || escapeEnd < escapeStart) {
    throw new Error('booking slot helper markers moved in customerBookingService.js');
  }
  const normalizeSlotFromRequest = new Function(
    'DateTime',
    `${src.slice(normalizeStart, normalizeEnd)}\nreturn normalizeSlotFromRequest;`
  )(DateTime);
  const escapeHtml = new Function(`${src.slice(escapeStart, escapeEnd)}\nreturn escapeHtml;`)();
  return { normalizeSlotFromRequest, escapeHtml };
}

const { normalizeSlotFromRequest, escapeHtml } = loadBookingSlotHelpers();

describe('normalizeSlotFromRequest', () => {
  it('keeps the offset instant and stores the timezone as a label', () => {
    const fromOffset = normalizeSlotFromRequest('2026-03-02T08:00:00-06:00', 30, 'America/New_York');
    const fromZulu = normalizeSlotFromRequest('2026-03-02T14:00:00.000Z', 30, 'America/Chicago');

    assert.deepEqual(
      [fromOffset.startISO, fromOffset.endISO],
      ['2026-03-02T14:00:00.000Z', '2026-03-02T14:30:00.000Z']
    );
    assert.equal(fromOffset.tzLocalLabel, 'America/New_York');
    assert.equal(fromOffset.startMs, Date.parse(fromOffset.startISO));
    assert.equal(fromOffset.endMs, Date.parse(fromOffset.endISO));
    assert.equal(fromOffset.endMs - fromOffset.startMs, 30 * 60 * 1000);
    assert.equal(fromZulu.startISO, fromOffset.startISO);
    assert.equal(fromZulu.startMs, fromOffset.startMs);
    assert.equal(fromZulu.endISO, fromOffset.endISO);
    assert.equal(fromZulu.tzLocalLabel, 'America/Chicago');
  });

  it('rejects blank, padded, and unparseable slot strings', () => {
    assert.equal(normalizeSlotFromRequest(null, 30, 'America/Chicago'), null);
    assert.equal(normalizeSlotFromRequest(undefined, 30, 'America/Chicago'), null);
    assert.equal(normalizeSlotFromRequest('', 30, 'America/Chicago'), null);
    assert.equal(normalizeSlotFromRequest('not-a-date', 30, 'America/Chicago'), null);
    assert.equal(normalizeSlotFromRequest(' 2026-03-02T14:00:00.000Z', 30, 'America/Chicago'), null);
  });

  it('adds real minutes across the spring-forward jump', () => {
    const slot = normalizeSlotFromRequest('2026-03-08T01:30:00-06:00', 60, 'America/Chicago');

    assert.deepEqual(
      [slot.startISO, slot.endISO],
      ['2026-03-08T07:30:00.000Z', '2026-03-08T08:30:00.000Z']
    );
    assert.equal(slot.endMs - slot.startMs, 60 * 60 * 1000);

    const startLocal = DateTime.fromISO(slot.startISO, { zone: 'utc' }).setZone('America/Chicago');
    const endLocal = DateTime.fromISO(slot.endISO, { zone: 'utc' }).setZone('America/Chicago');
    assert.equal(startLocal.toFormat('HH:mm'), '01:30');
    assert.equal(endLocal.toFormat('HH:mm'), '03:30');
    assert.equal(startLocal.offset, -360);
    assert.equal(endLocal.offset, -300);
  });

  it('uses the request offset to choose which fall-back hour was booked', () => {
    const firstHour = normalizeSlotFromRequest('2026-11-01T01:30:00-05:00', 60, 'America/Chicago');
    const secondHour = normalizeSlotFromRequest('2026-11-01T01:30:00-06:00', 30, 'America/Chicago');

    assert.equal(firstHour.endISO, '2026-11-01T07:30:00.000Z');
    assert.equal(secondHour.startISO, '2026-11-01T07:30:00.000Z');
    assert.equal(firstHour.endMs, secondHour.startMs);
    assert.equal(firstHour.endMs - firstHour.startMs, 60 * 60 * 1000);
    assert.equal(secondHour.endMs - secondHour.startMs, 30 * 60 * 1000);
    assert.notEqual(firstHour.startMs, secondHour.startMs);

    const firstStart = DateTime.fromISO(firstHour.startISO, { zone: 'utc' }).setZone('America/Chicago');
    const firstEnd = DateTime.fromISO(firstHour.endISO, { zone: 'utc' }).setZone('America/Chicago');
    assert.equal(firstStart.toFormat('HH:mm'), '01:30');
    assert.equal(firstEnd.toFormat('HH:mm'), '01:30');
    assert.equal(firstStart.offset, -300);
    assert.equal(firstEnd.offset, -360);
  });
});

describe('escapeHtml', () => {
  it('escapes the characters interpolated into the booking email', () => {
    assert.equal(
      escapeHtml('Tom & <Jerry> "drop-off"'),
      'Tom &amp; &lt;Jerry&gt; &quot;drop-off&quot;'
    );
    assert.equal(
      escapeHtml('<img src=x onerror="alert(1)">'),
      '&lt;img src=x onerror=&quot;alert(1)&quot;&gt;'
    );
  });

  it('escapes ampersands before the other characters and leaves apostrophes', () => {
    assert.equal(escapeHtml('&lt;'), '&amp;lt;');
    assert.equal(escapeHtml("O'Brien — oil change"), "O'Brien — oil change");
    assert.equal(escapeHtml(''), '');
  });
});
