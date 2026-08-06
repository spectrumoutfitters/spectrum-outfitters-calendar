import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { overlapsInterval } from '../utils/bookingBusyOverlap.js';

describe('overlapsInterval', () => {
  const slotStart = Date.parse('2026-08-06T15:00:00.000Z');
  const slotEnd = Date.parse('2026-08-06T15:30:00.000Z');

  it('returns false for empty/null intervals', () => {
    assert.equal(overlapsInterval(slotStart, slotEnd, null), false);
    assert.equal(overlapsInterval(slotStart, slotEnd, []), false);
  });

  it('detects overlapping busy blocks', () => {
    assert.equal(
      overlapsInterval(slotStart, slotEnd, [
        { start: '2026-08-06T15:15:00.000Z', end: '2026-08-06T16:00:00.000Z' }
      ]),
      true
    );
  });

  it('allows adjacent (touching) intervals without overlap', () => {
    assert.equal(
      overlapsInterval(slotStart, slotEnd, [
        { start: '2026-08-06T14:00:00.000Z', end: '2026-08-06T15:00:00.000Z' }
      ]),
      false
    );
    assert.equal(
      overlapsInterval(slotStart, slotEnd, [
        { start: '2026-08-06T15:30:00.000Z', end: '2026-08-06T16:00:00.000Z' }
      ]),
      false
    );
  });

  it('skips busy entries with unparseable dates', () => {
    assert.equal(
      overlapsInterval(slotStart, slotEnd, [
        { start: 'not-a-date', end: '2026-08-06T16:00:00.000Z' },
        { start: '2026-08-06T15:00:00.000Z', end: 'bad' }
      ]),
      false
    );
  });

  it('returns true when any one of multiple intervals overlaps', () => {
    assert.equal(
      overlapsInterval(slotStart, slotEnd, [
        { start: '2026-08-06T13:00:00.000Z', end: '2026-08-06T13:30:00.000Z' },
        { start: '2026-08-06T15:00:00.000Z', end: '2026-08-06T15:05:00.000Z' }
      ]),
      true
    );
  });
});
