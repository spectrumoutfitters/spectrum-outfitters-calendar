import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  clampBookingBufferBeforeMinutes,
  clampBookingHorizonDays,
  clampBookingSlotMinutes,
  uniqCalendarIds,
} from '../utils/bookingConfigClamp.js';

describe('uniqCalendarIds', () => {
  it('trims, drops blanks/non-strings, and dedupes preserving order', () => {
    assert.deepEqual(
      uniqCalendarIds([
        ' primary ',
        'primary',
        '',
        '  ',
        'team@example.com',
        null,
        42,
        'team@example.com',
        'secondary',
      ]),
      ['primary', 'team@example.com', 'secondary']
    );
  });

  it('returns empty array for null/undefined input', () => {
    assert.deepEqual(uniqCalendarIds(null), []);
    assert.deepEqual(uniqCalendarIds(undefined), []);
  });
});

describe('clampBookingSlotMinutes', () => {
  it('defaults invalid values to 30', () => {
    assert.equal(clampBookingSlotMinutes(undefined), 30);
    assert.equal(clampBookingSlotMinutes(''), 30);
    assert.equal(clampBookingSlotMinutes('nope'), 30);
  });

  it('floors below 15 and ceilings above 480', () => {
    assert.equal(clampBookingSlotMinutes(5), 15);
    assert.equal(clampBookingSlotMinutes(15), 15);
    assert.equal(clampBookingSlotMinutes(60), 60);
    assert.equal(clampBookingSlotMinutes(480), 480);
    assert.equal(clampBookingSlotMinutes(999), 480);
  });
});

describe('clampBookingHorizonDays', () => {
  it('defaults invalid values to 21 and clamps to 1..60', () => {
    assert.equal(clampBookingHorizonDays(null), 21);
    assert.equal(clampBookingHorizonDays(0), 21);
    assert.equal(clampBookingHorizonDays(1), 1);
    assert.equal(clampBookingHorizonDays(45), 45);
    assert.equal(clampBookingHorizonDays(60), 60);
    assert.equal(clampBookingHorizonDays(90), 60);
  });
});

describe('clampBookingBufferBeforeMinutes', () => {
  it('defaults invalid values to 0 and clamps to 0..120', () => {
    assert.equal(clampBookingBufferBeforeMinutes(undefined), 0);
    assert.equal(clampBookingBufferBeforeMinutes(-5), 0);
    assert.equal(clampBookingBufferBeforeMinutes(15), 15);
    assert.equal(clampBookingBufferBeforeMinutes(120), 120);
    assert.equal(clampBookingBufferBeforeMinutes(240), 120);
  });
});
